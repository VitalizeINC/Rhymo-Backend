import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import mongoose from 'mongoose';
import Batch from '../../../models/batch.js';
import WordBatch from '../../../models/wordBatch.js';
import Word from '../../../models/word.js';
import processControllerInstance from './processController.js';
import applyOrthographyFixes from '../../../helpers/wordBatchPreprocessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BatchController {
    constructor() {
        this.uploadBatch = this.uploadBatch.bind(this);
        this.getBatches = this.getBatches.bind(this);
        this.getBatchDetails = this.getBatchDetails.bind(this);
        this.processBatch = this.processBatch.bind(this);
        this.processWordBatchRecords = this.processWordBatchRecords.bind(this);
    }

    async uploadBatch(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const { originalname, filename, path: filePath, size, mimetype } = req.file;
            
            // Validate file type
            const allowedMimeTypes = [
                'text/csv',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ];
            
            if (!allowedMimeTypes.includes(mimetype)) {
                // Clean up uploaded file
                fs.unlinkSync(filePath);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid file type. Only CSV and Excel files are allowed.'
                });
            }

            // Create batch record
            const batch = new Batch({
                fileName: filename,
                originalFileName: originalname,
                filePath: filePath,
                fileSize: size,
                mimeType: mimetype,
                uploadedBy: req.user.id,
                status: 'uploaded'
            });

            await batch.save();

            // Start processing the file asynchronously
            this.processBatchFile(batch._id, filePath, mimetype);

            res.status(201).json({
                success: true,
                message: 'File uploaded successfully',
                data: {
                    batchId: batch._id,
                    fileName: originalname,
                    status: batch.status
                }
            });

        } catch (error) {
            console.error('Upload batch error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    async processBatchFile(batchId, filePath, mimeType) {
        try {
            // Update batch status to processing
            await Batch.findByIdAndUpdate(batchId, {
                status: 'processing',
                processingStartedAt: new Date()
            });

            let data = [];
            
            if (mimeType === 'text/csv') {
                data = await this.parseCSV(filePath);
            } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
                data = await this.parseExcel(filePath);
            }

            // Process and insert records in chunks for large datasets
            const validData = data.filter((row, index) => {
                // Skip empty rows or rows without required fields
                return row.grapheme && row.grapheme.trim() !== '' && 
                       row.organized_grapheme && row.organized_grapheme.trim() !== '';
            });

            console.log(`Processing ${validData.length} valid records from ${data.length} total rows`);

            // Insert records in smaller chunks to handle large datasets
            const chunkSize = 500; // Smaller chunks for better memory management
            let totalInserted = 0;
            let totalFailed = 0;

            for (let i = 0; i < validData.length; i += chunkSize) {
                const chunk = validData.slice(i, i + chunkSize);
                
                const wordBatchRecords = chunk.map((row, index) => ({
                    batch: new mongoose.Types.ObjectId(batchId),
                    grapheme: row.grapheme.trim(),
                    phoneme: this.parsePhoneme(row.phoneme),
                    organizedGrapheme: row.organized_grapheme.trim(),
                    wawOExceptionIdx: this.parseIndexArray(row.waw_o_exception_idx),
                    silentWawIdx: this.parseIndexArray(row.silent_waw_idx),
                    unwrittenAPhoneIdx: this.parseIndexArray(row.unwritten_A_phone_idx),
                    spokenAGraphemeIdx: this.parseIndexArray(row.spoken_A_grapheme_idx),
                    isVariant: row.is_variant === 'TRUE' || row.is_variant === true,
                    variantNum: row.variant_num ? parseInt(row.variant_num) : null,
                    variantOfIndex: row.variant_of_index ? parseInt(row.variant_of_index) : null,
                    rowIndex: i + index + 1,
                    status: 'pending'
                }));

                try {
                    await WordBatch.insertMany(wordBatchRecords, { ordered: false });
                    totalInserted += wordBatchRecords.length;
                    console.log(`Inserted chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(validData.length/chunkSize)}: ${wordBatchRecords.length} records`);
                } catch (chunkError) {
                    console.error(`Error inserting chunk ${Math.floor(i/chunkSize) + 1}:`, chunkError.message);
                    // Count failed records from the error
                    if (chunkError.writeErrors) {
                        totalFailed += chunkError.writeErrors.length;
                        totalInserted += (wordBatchRecords.length - chunkError.writeErrors.length);
                    } else {
                        totalFailed += wordBatchRecords.length;
                    }
                }
            }

            console.log(`Batch processing complete: ${totalInserted} inserted, ${totalFailed} failed`);

            // Update batch with actual processing results
            await Batch.findByIdAndUpdate(batchId, {
                status: totalFailed > 0 ? 'completed' : 'completed', // Still completed even with some failures
                totalRecords: validData.length,
                processedRecords: totalInserted,
                failedRecords: totalFailed,
                processingCompletedAt: new Date()
            });

        } catch (error) {
            console.error('Process batch file error:', error);
            await Batch.findByIdAndUpdate(batchId, {
                status: 'failed',
                errorMessage: error.message,
                processingCompletedAt: new Date()
            });
        }
    }

    async parseCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            
            const fileStream = createReadStream(filePath);
            const rl = createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let headers = [];
            let isFirstLine = true;

            rl.on('line', (line) => {
                if (isFirstLine) {
                    headers = this.parseCSVLine(line).map(h => h.trim());
                    isFirstLine = false;
                } else {
                    const values = this.parseCSVLine(line);
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] ? values[index].trim() : '';
                    });
                    results.push(row);
                }
            });

            rl.on('close', () => {
                resolve(results);
            });

            rl.on('error', (error) => {
                reject(error);
            });
        });
    }

    async parseExcel(filePath) {
        // For now, return empty array - Excel parsing will be implemented when xlsx package is available
        console.log('Excel parsing not yet implemented - xlsx package needed');
        return [];
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    parsePhoneme(phonemeString) {
        if (!phonemeString) return [];
        
        // Parse phoneme string like "('v', 'A', 't', 'e', 'r', 'p', 'o', 'l', 'o')"
        const match = phonemeString.match(/\(([^)]+)\)/);
        if (match) {
            return match[1].split(',').map(p => p.trim().replace(/'/g, ''));
        }
        return [];
    }

    parseIndexArray(indexString) {
        if (!indexString) return [];
        
        // Parse index string like "5,7" or "1"
        return indexString.split(',').map(idx => parseInt(idx.trim())).filter(idx => !isNaN(idx));
    }

    async getBatches(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const status = req.query.status;

            const filter = {};
            if (status) {
                filter.status = status;
            }

            const batches = await Batch.paginate(filter, {
                page,
                limit,
                sort: { createdAt: -1 },
                populate: {
                    path: 'uploadedBy',
                    select: 'name email'
                }
            });

            res.json({
                success: true,
                data: batches
            });

        } catch (error) {
            console.error('Get batches error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    async getBatchDetails(req, res) {
        try {
            const { batchId } = req.params;

            const batch = await Batch.findById(batchId)
                .populate('uploadedBy', 'name email');

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'Batch not found'
                });
            }

            // Debug: Check what's in the database
            const totalWordBatches = await WordBatch.countDocuments();
            console.log(`Total WordBatch records in database: ${totalWordBatches}`);
            
            // Try different query approaches
            let wordBatches = await WordBatch.find({ batch: new mongoose.Types.ObjectId(batchId) })
                .sort({ rowIndex: 1 });
            
            console.log(`Found ${wordBatches.length} records with ObjectId query`);
            
            if (wordBatches.length === 0) {
                // Try with string batchId
                wordBatches = await WordBatch.find({ batch: batchId })
                    .sort({ rowIndex: 1 });
                console.log(`Found ${wordBatches.length} records with string query`);
            }
            
            // Get a sample of recent WordBatch records to see the batch field format
            const sampleRecords = await WordBatch.find({}).limit(3).sort({ createdAt: -1 });
            console.log('Sample WordBatch records:', sampleRecords.map(r => ({ 
                batch: r.batch, 
                batchType: typeof r.batch,
                grapheme: r.grapheme 
            })));

            res.json({
                success: true,
                data: {
                    batch,
                    wordBatches
                }
            });

        } catch (error) {
            console.error('Get batch details error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    async processBatch(req, res) {
        try {
            const { batchId } = req.params;

            const batch = await Batch.findById(batchId);
            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'Batch not found'
                });
            }

            if (batch.status !== 'uploaded') {
                return res.status(400).json({
                    success: false,
                    message: 'Batch is already processed or processing'
                });
            }

            // Start processing
            this.processBatchFile(batchId, batch.filePath, batch.mimeType);

            res.json({
                success: true,
                message: 'Batch processing started'
            });

        } catch (error) {
            console.error('Process batch error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    async deleteBatch(req, res) {
        try {
            const { batchId } = req.params;

            const batch = await Batch.findById(batchId);
            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'Batch not found'
                });
            }

            // Delete all associated word batch records
            await WordBatch.deleteMany({ batch: batchId });

            // Delete the uploaded file
            try {
                if (fs.existsSync(batch.filePath)) {
                    fs.unlinkSync(batch.filePath);
                }
            } catch (fileError) {
                console.warn('Could not delete file:', batch.filePath, fileError.message);
            }

            // Delete the batch record
            await Batch.findByIdAndDelete(batchId);

            res.json({
                success: true,
                message: 'Batch deleted successfully'
            });

        } catch (error) {
            console.error('Delete batch error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    async processWordBatchRecords(req, res) {
        try {
            const { batchId } = req.params;

            const batch = await Batch.findById(batchId);
            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'Batch not found'
                });
            }

            // Get all pending WordBatch records for this batch
            const wordBatches = await WordBatch.find({ 
                batch: new mongoose.Types.ObjectId(batchId),
                status: 'pending'
            }).sort({ rowIndex: 1 });

            if (wordBatches.length === 0) {
                return res.json({
                    success: true,
                    message: 'No pending records to process',
                    processedCount: 0
                });
            }

            const processor = processControllerInstance;
            let processedCount = 0;
            let failedCount = 0;

            // Process each WordBatch record
            for (const wordBatch of wordBatches) {
                try {
                    // Create a mock request object for getWordDetails
                    let processedWordBatch = applyOrthographyFixes(wordBatch.organizedGrapheme, {
                        waw_o_exception_idx: wordBatch.wawOExceptionIdx || [],
                        silent_waw_idx: wordBatch.silentWawIdx || [],
                        spoken_A_grapheme_idx: wordBatch.spokenAGraphemeIdx || []
                    });
                    console.log('processedWordBatch', processedWordBatch);
                    
                    // Check if word contains nim faseleh (0x200C)
                    const nimFaselehChar = String.fromCharCode(0x200C);
                    const hasNimFaseleh = processedWordBatch.includes(nimFaselehChar);
                    
                    // If word contains nim faseleh, partition it into separate words
                    if (hasNimFaseleh) {
                        // Split by nim faseleh to get individual parts
                        const wordParts = processedWordBatch.split(nimFaselehChar);
                        
                        // Process each part separately to save them as individual words
                        for (const part of wordParts) {
                            if (part.trim()) {
                                const trimmedPart = part.trim();
                                
                                // Check if this part already exists in DB
                                let existingWord = await Word.findOne({ fullWord: trimmedPart });
                                
                                if (!existingWord) {
                                    // Process the part to get its details
                                    const partMockReq = {
                                        body: {
                                            string: trimmedPart
                                        }
                                    };
                                    
                                    let partProcessedData = null;
                                    const partMockRes = {
                                        status: () => ({
                                            json: (data) => {
                                                partProcessedData = data;
                                            }
                                        })
                                    };
                                    
                                    // Process each part to get heja and phonemes
                                    await processor.getWordDetails(partMockReq, partMockRes);
                                    
                                    // If the part was processed and has data, save it manually
                                    if (partProcessedData && partProcessedData.result && partProcessedData.result.length > 0) {
                                        const partResult = partProcessedData.result[0];
                                        
                                        // Double-check it's not in DB (might have been added by getWordDetails if pass was true)
                                        existingWord = await Word.findOne({ fullWord: trimmedPart });
                                        
                                        if (!existingWord && partResult.parts && partResult.parts.length > 0) {
                                            // Calculate space and nim faseleh positions for this part
                                            let spacePositions = [];
                                            let nimFaselehPositions = [];
                                            for(let i = 0; i < trimmedPart.length; i++){
                                                if(trimmedPart[i] === " "){
                                                    spacePositions.push(i);
                                                }
                                                if(trimmedPart[i] === nimFaselehChar){
                                                    nimFaselehPositions.push(i);
                                                }
                                            }
                                            
                                            // Create solid word (remove diacritics)
                                            const solidWord = processor.solidWord(trimmedPart);
                                            
                                            // Save the individual part as a word
                                            const newPartWord = new Word({
                                                fullWord: trimmedPart,
                                                fullWordWithNimFaseleh: trimmedPart,
                                                word: solidWord,
                                                heja: partResult.parts,
                                                avaString: partResult.phonemes.join(","),
                                                ava: partResult.phonemes,
                                                hejaCounter: partResult.phonemes.length,
                                                spacePositions: spacePositions,
                                                nimFaselehPositions: nimFaselehPositions,
                                                level: 1,
                                                addedBy: req.user?.id || null,
                                                batchId: batchId || null,
                                                batchName: null,
                                                approved: false
                                            });
                                            
                                            await newPartWord.save();
                                            console.log(`Saved individual part: ${trimmedPart}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    // Now process the full word (with nim faseleh)
                    const mockReq = {
                        body: {
                            string: processedWordBatch
                        }
                    };

                    // Create a mock response object to capture the result
                    let processedData = null;
                    const mockRes = {
                        status: () => ({
                            json: (data) => {
                                processedData = data;
                            }
                        })
                    };

                    // Call getWordDetails for the full word
                    await processor.getWordDetails(mockReq, mockRes);

                    if (processedData && processedData.result) {
                        // Extract parts and phonemes from the result
                        let allParts = [];
                        let allPhonemes = [];

                        processedData.result.forEach(item => {
                            if (item.parts) allParts = [...allParts, ...item.parts];
                            if (item.phonemes) allPhonemes = [...allPhonemes, ...item.phonemes];
                        });

                        // Update the WordBatch record
                        await WordBatch.findByIdAndUpdate(wordBatch._id, {
                            processedParts: allParts,
                            processedPhonemes: allPhonemes,
                            status: 'processed',
                            processedAt: new Date()
                        });

                        processedCount++;
                    } else {
                        // Mark as failed if no valid data
                        await WordBatch.findByIdAndUpdate(wordBatch._id, {
                            status: 'failed',
                            errorMessage: 'No valid processing data returned',
                            processedAt: new Date()
                        });
                        failedCount++;
                    }
                } catch (error) {
                    console.error(`Error processing WordBatch ${wordBatch._id}:`, error);
                    await WordBatch.findByIdAndUpdate(wordBatch._id, {
                        status: 'failed',
                        errorMessage: error.message,
                        processedAt: new Date()
                    });
                    failedCount++;
                }
            }

            res.json({
                success: true,
                message: 'WordBatch processing completed',
                processedCount,
                failedCount,
                totalRecords: wordBatches.length
            });

        } catch (error) {
            console.error('Process WordBatch records error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
}

export default new BatchController();
