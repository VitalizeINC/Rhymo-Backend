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

            // Helper function to show character codes for debugging
            const showCharCodes = (str, label = '') => {
                const codes = [];
                for (let i = 0; i < str.length; i++) {
                    const char = str[i];
                    const code = char.charCodeAt(0);
                    codes.push(`${char} (U+${code.toString(16).toUpperCase().padStart(4, '0')})`);
                }
                return `${label}: [${codes.join(', ')}]`;
            };

            // Get all WordBatch records (pending and processed) for reprocessing
            // We'll skip only those that have approved words
            const wordBatches = await WordBatch.find({ 
                batch: new mongoose.Types.ObjectId(batchId),
                status: { $in: ['pending', 'processed'] } // Include both pending and processed
            }).sort({ rowIndex: 1 });

            if (wordBatches.length === 0) {
                return res.json({
                    success: true,
                    message: 'No records to process',
                    processedCount: 0
                });
            }

            console.log(`\n=== BATCH PROCESSING START ===`);
            console.log(`Total WordBatch records to process: ${wordBatches.length}`);
            
            // Search for specific word if needed (for debugging)
            // Try multiple search patterns
            const searchPatterns = [
                "مَسموم",
                "مسموم",
                "کُنَندِه",
                "کننده",
                "مَسموم‌کُنَندِه",
                "مسموم‌کننده"
            ];
            
            // Find words matching any pattern
            const foundWords = wordBatches.filter(wb => {
                const grapheme = wb.organizedGrapheme;
                return searchPatterns.some(pattern => grapheme.includes(pattern));
            });
            
            if (foundWords.length > 0) {
                console.log(`\n🔍 FOUND ${foundWords.length} WORDS MATCHING SEARCH PATTERNS:`);
                foundWords.forEach((wb, idx) => {
                    console.log(`\n${idx + 1}. "${wb.organizedGrapheme}"`);
                    console.log(`   WordBatch ID: ${wb._id}, Status: ${wb.status}, RowIndex: ${wb.rowIndex}`);
                    
                    // Check for nim faseleh
                    const nimFaselehChar = String.fromCharCode(0x200C);
                    const hasNimFaseleh = wb.organizedGrapheme.includes(nimFaselehChar);
                    console.log(`   Has nim faseleh (U+200C): ${hasNimFaseleh}`);
                    
                    // Show character codes for first 20 characters
                    const preview = wb.organizedGrapheme.substring(0, 20);
                    const codes = [];
                    for (let i = 0; i < preview.length; i++) {
                        const code = preview.charCodeAt(i);
                        if (code === 0x200C || code === 0x200D || code === 0x200E || code === 0x200F) {
                            codes.push(`U+${code.toString(16).toUpperCase()} at pos ${i}`);
                        }
                    }
                    if (codes.length > 0) {
                        console.log(`   Zero-width chars: ${codes.join(', ')}`);
                    }
                });
                
                // Check specifically for the exact target word
                const exactMatch = foundWords.find(wb => 
                    wb.organizedGrapheme.includes("مَسموم") && wb.organizedGrapheme.includes("کُنَندِه")
                );
                
                if (exactMatch) {
                    console.log(`\n✅ EXACT TARGET WORD FOUND: "${exactMatch.organizedGrapheme}"`);
                } else {
                    console.log(`\n⚠️ Exact target word not found, but found similar words above`);
                }
            } else {
                console.log(`\n⚠️ NO WORDS FOUND matching search patterns: ${searchPatterns.join(', ')}`);
                console.log(`   Showing first 10 words in batch for reference:`);
                wordBatches.slice(0, 10).forEach((wb, idx) => {
                    console.log(`   ${idx + 1}. "${wb.organizedGrapheme}" (ID: ${wb._id})`);
                });
            }

            const processor = processControllerInstance;
            let processedCount = 0;
            let failedCount = 0;
            let skippedCount = 0; // Count of approved words that were skipped
            
            // Get the max rowIndex for this batch to assign new rowIndex values for parts
            const maxRowIndexDoc = await WordBatch.findOne({ 
                batch: new mongoose.Types.ObjectId(batchId) 
            }).sort({ rowIndex: -1 }).select('rowIndex');
            let nextRowIndex = (maxRowIndexDoc?.rowIndex || 0) + 1;

            // Process each WordBatch record
            for (const wordBatch of wordBatches) {
                try {
                    // Check if this is the target word for detailed logging
                    // Use more flexible matching
                    const isTargetWord = (wordBatch.organizedGrapheme.includes("مَسموم") || 
                                         wordBatch.organizedGrapheme.includes("مسموم")) &&
                                        (wordBatch.organizedGrapheme.includes("کُنَندِه") || 
                                         wordBatch.organizedGrapheme.includes("کننده"));
                    
                    if (isTargetWord) {
                        console.log(`\n🎯 === PROCESSING TARGET WORD: "${wordBatch.organizedGrapheme}" ===`);
                        console.log(`   WordBatch ID: ${wordBatch._id}`);
                        console.log(`   Status: ${wordBatch.status}`);
                        console.log(`   RowIndex: ${wordBatch.rowIndex}`);
                    }
                    
                    // Check if this word is already approved - if so, skip it
                    // Check both with nim faseleh and with space (since words might be stored either way)
                    const processedWordForCheck = wordBatch.organizedGrapheme.replace(/\u200C/g, ' ');
                    const approvedWord = await Word.findOne({ 
                        $or: [
                            { fullWord: wordBatch.organizedGrapheme, approved: true },
                            { fullWord: processedWordForCheck, approved: true }
                        ]
                    });
                    
                    if (approvedWord) {
                        if (isTargetWord) {
                            console.log(`🎯 TARGET WORD IS APPROVED - SKIPPING`);
                        }
                        skippedCount++;
                        continue; // Skip this word
                    }
                    
                    // Reset status to pending if it was previously processed (for reprocessing)
                    if (wordBatch.status === 'processed') {
                        await WordBatch.findByIdAndUpdate(wordBatch._id, {
                            status: 'pending'
                        });
                    }

                    // Create a mock request object for getWordDetails
                    let processedWordBatch = applyOrthographyFixes(wordBatch.organizedGrapheme, {
                        waw_o_exception_idx: wordBatch.wawOExceptionIdx || [],
                        silent_waw_idx: wordBatch.silentWawIdx || [],
                        spoken_A_grapheme_idx: wordBatch.spokenAGraphemeIdx || []
                    });
                    
                    if (isTargetWord) {
                        console.log(`After orthography fixes: "${processedWordBatch}"`);
                        console.log(showCharCodes(processedWordBatch, "Character codes"));
                    }
                    
                    // Check if word contains nim faseleh (0x200C)
                    const nimFaselehChar = String.fromCharCode(0x200C);
                    const hasNimFaseleh = processedWordBatch.includes(nimFaselehChar);
                    
                    // Log for target word OR any word with nim faseleh
                    const shouldLog = isTargetWord || hasNimFaseleh;
                    
                    if (shouldLog) {
                        console.log(`\n${isTargetWord ? '🎯' : '📝'} === Processing word with nim faseleh: "${wordBatch.organizedGrapheme}" ===`);
                        console.log(`   WordBatch ID: ${wordBatch._id}, Status: ${wordBatch.status}`);
                        console.log(`   Has nim faseleh (U+200C): ${hasNimFaseleh}`);
                    }
                    
                    // If word contains nim faseleh, partition it into separate words
                    if (hasNimFaseleh) {
                        if (shouldLog) {
                            console.log(`   Processing word with nim faseleh`);
                        }
                        // Split by nim faseleh to get individual parts
                        const wordParts = processedWordBatch.split(nimFaselehChar).filter(part => part.trim() !== '');
                        
                        if (shouldLog) {
                            console.log(`   Split into ${wordParts.length} parts:`, wordParts.map(p => `"${p.trim()}"`));
                        }
                        
                        // Process each part separately to save them as individual words and WordBatch records
                        for (let partIndex = 0; partIndex < wordParts.length; partIndex++) {
                            const part = wordParts[partIndex];
                            if (part.trim()) {
                                const trimmedPart = part.trim();
                                
                                if (shouldLog) {
                                    console.log(`   Processing part ${partIndex + 1}/${wordParts.length}: "${trimmedPart}"`);
                                }
                                
                                // Check if this part is already approved - if so, skip it
                                const approvedPartWord = await Word.findOne({ 
                                    fullWord: trimmedPart,
                                    approved: true 
                                });
                                
                                if (approvedPartWord) {
                                    if (shouldLog) {
                                        console.log(`   ✓ Skipping approved part: "${trimmedPart}"`);
                                    }
                                    continue; // Skip this part
                                }
                                
                                // Check if a WordBatch record already exists for this part in this batch
                                let existingWordBatch = await WordBatch.findOne({ 
                                    batch: new mongoose.Types.ObjectId(batchId),
                                    organizedGrapheme: trimmedPart
                                });
                                
                                // Check if this part already exists in Word collection (but not approved)
                                let existingWord = await Word.findOne({ 
                                    fullWord: trimmedPart,
                                    approved: false // Only consider non-approved words
                                });
                                
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
                                
                                if (shouldLog) {
                                    console.log(`   getWordDetails response for part "${trimmedPart}":`, {
                                        hasResult: !!partProcessedData?.result,
                                        resultCount: partProcessedData?.result?.length || 0,
                                        firstResult: partProcessedData?.result?.[0] ? {
                                            part: partProcessedData.result[0].part,
                                            hasParts: !!partProcessedData.result[0].parts,
                                            partsCount: partProcessedData.result[0].parts?.length || 0,
                                            hasPhonemes: !!partProcessedData.result[0].phonemes,
                                            phonemesCount: partProcessedData.result[0].phonemes?.length || 0,
                                            parts: partProcessedData.result[0].parts,
                                            phonemes: partProcessedData.result[0].phonemes
                                        } : null
                                    });
                                }
                                
                                // If the part was processed and has data
                                if (partProcessedData && partProcessedData.result && partProcessedData.result.length > 0) {
                                    const partResult = partProcessedData.result[0];
                                    
                                    // Extract parts and phonemes from the result
                                    let partParts = [];
                                    let partPhonemes = [];
                                    if (partResult.parts) partParts = partResult.parts;
                                    if (partResult.phonemes) partPhonemes = partResult.phonemes;
                                    
                                    if (partParts.length === 0 || partPhonemes.length === 0) {
                                        console.warn(`   ⚠️ Part "${trimmedPart}" has empty parts or phonemes!`);
                                        if (shouldLog) {
                                            console.warn(`      Full result:`, JSON.stringify(partResult, null, 2));
                                        }
                                    } else if (shouldLog) {
                                        console.log(`   ✓ Part "${trimmedPart}" processed successfully:`, {
                                            parts: partParts,
                                            phonemes: partPhonemes
                                        });
                                    }
                                    
                                    // Double-check it's not in Word DB (might have been added by getWordDetails if pass was true)
                                    // Check for ANY word (approved or not) to see if it exists
                                    const anyExistingWord = await Word.findOne({ 
                                        fullWord: trimmedPart
                                    });
                                    
                                    // Update existingWord to be the non-approved one (or null)
                                    existingWord = await Word.findOne({ 
                                        fullWord: trimmedPart,
                                        approved: false // Only consider non-approved words
                                    });
                                    
                                    let wordWasJustCreated = false;
                                    
                                    // Save as Word if it doesn't exist AND has valid phonemes AND is not approved
                                    if (!anyExistingWord && !approvedPartWord && partResult.parts && partResult.parts.length > 0 && 
                                        partResult.phonemes && partResult.phonemes.length > 0) {
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
                                        wordWasJustCreated = true;
                                        
                                        if (isTargetWord) {
                                            console.log(`  ✓ Saved individual part as Word: "${trimmedPart}" (ID: ${newPartWord._id})`);
                                        }
                                    }
                                    
                                    // Create WordBatch record for this part if it doesn't exist AND has valid data
                                    if (!existingWordBatch && partParts.length > 0 && partPhonemes.length > 0) {
                                        // Get phonemes for WordBatch (use the phonemes from processing)
                                        const partPhonemesForBatch = partPhonemes;
                                        
                                        const newPartWordBatch = new WordBatch({
                                            batch: new mongoose.Types.ObjectId(batchId),
                                            grapheme: trimmedPart,
                                            phoneme: partPhonemesForBatch,
                                            organizedGrapheme: trimmedPart,
                                            wawOExceptionIdx: [],
                                            silentWawIdx: [],
                                            unwrittenAPhoneIdx: [],
                                            spokenAGraphemeIdx: [],
                                            isVariant: false,
                                            variantNum: null,
                                            variantOfIndex: null,
                                            rowIndex: nextRowIndex++,
                                            status: 'processed',
                                            processedParts: partParts,
                                            processedPhonemes: partPhonemes,
                                            processedAt: new Date(),
                                            addedToWords: !!(anyExistingWord || wordWasJustCreated)  // Convert to boolean - check ANY word, not just non-approved
                                        });
                                        
                                        try {
                                            await newPartWordBatch.save();
                                            
                                            if (shouldLog) {
                                                console.log(`  ✓ Created WordBatch record for individual part: "${trimmedPart}"`);
                                            }
                                        } catch (saveError) {
                                            console.error(`  ✗ ERROR saving WordBatch for part "${trimmedPart}":`, saveError.message);
                                            if (shouldLog) {
                                                console.error(`     Full error:`, saveError);
                                            }
                                            // Don't throw - continue processing other parts
                                        }
                                    } else if (existingWordBatch && partParts.length > 0 && partPhonemes.length > 0) {
                                        // Update existing WordBatch record if needed
                                        await WordBatch.findByIdAndUpdate(existingWordBatch._id, {
                                            processedParts: partParts,
                                            processedPhonemes: partPhonemes,
                                            status: 'processed',
                                            processedAt: new Date(),
                                            addedToWords: true
                                        });
                                        
                                        if (isTargetWord) {
                                            console.log(`  ✓ Updated existing WordBatch record for part: "${trimmedPart}"`);
                                        }
                                    } else if (!partPhonemes || partPhonemes.length === 0) {
                                        // Log warning if phonemes are missing
                                        console.warn(`  ⚠️ Skipping WordBatch creation for "${trimmedPart}" - no phonemes returned from processing`);
                                    }
                                } else {
                                    if (isTargetWord) {
                                        console.warn(`  ⚠️ No valid result returned for part "${trimmedPart}"`);
                                        console.warn(`     Processed data:`, JSON.stringify(partProcessedData, null, 2));
                                    }
                                }
                            }
                        }
                    }
                    
                    // Now process the full word (with nim faseleh) - BUT DON'T SAVE IT TO WORDS
                    // We only need the processed data to update the WordBatch record
                    // Replace nim faseleh with space so getWordDetails can properly split it
                    // Also replace multiple spaces with single space
                    const processedWordForDetails = processedWordBatch.replace(/\u200C/g, ' ')
                        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
                        .trim();
                    
                    if (shouldLog) {
                        console.log(`   Processing full word`);
                        console.log(`   After replacing nim faseleh with space: "${processedWordForDetails}"`);
                    }
                    
                    // Filter out empty strings from split result
                    const partsAfterSplit = processedWordForDetails.split(' ').filter(part => part.trim() !== '');
                    
                    if (partsAfterSplit.length === 0) {
                        console.error(`✗ ERROR: No valid parts found after processing: "${processedWordBatch}"`);
                        await WordBatch.findByIdAndUpdate(wordBatch._id, {
                            status: 'failed',
                            errorMessage: 'No valid parts found after processing',
                            processedAt: new Date()
                        });
                        failedCount++;
                        continue;
                    }
                    
                    const mockReq = {
                        body: {
                            string: processedWordForDetails
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

                    // Call getWordDetails for the full word to get processing data
                    await processor.getWordDetails(mockReq, mockRes);
                    
                    if (shouldLog) {
                        console.log(`   getWordDetails response for full word:`, {
                            hasResult: !!processedData?.result,
                            resultCount: processedData?.result?.length || 0,
                            results: processedData?.result?.map(item => ({
                                part: item.part,
                                hasParts: !!item.parts,
                                partsCount: item.parts?.length || 0,
                                hasPhonemes: !!item.phonemes,
                                phonemesCount: item.phonemes?.length || 0,
                                parts: item.parts,
                                phonemes: item.phonemes
                            }))
                        });
                    }

                    // IMPORTANT: If getWordDetails saved the full word (because pass was true), DELETE IT
                    // We don't want to save full words during batch processing, only individual parts
                    if (processedData && processedData.pass && processedData.totalId) {
                        await Word.findByIdAndDelete(processedData.totalId);
                    }

                    if (processedData && processedData.result && Array.isArray(processedData.result)) {
                        // Extract parts and phonemes from the result
                        let allParts = [];
                        let allPhonemes = [];

                        processedData.result.forEach((item, index) => {
                            // Skip empty parts
                            if (!item.part || item.part.trim() === '') {
                                if (shouldLog) {
                                    console.log(`   Skipping empty part at index ${index}`);
                                }
                                return;
                            }
                            
                            if (item.parts && Array.isArray(item.parts) && item.parts.length > 0) {
                                // Filter out empty parts
                                const validParts = item.parts.filter(p => p && p.trim() !== '');
                                allParts = [...allParts, ...validParts];
                            }
                            if (item.phonemes && Array.isArray(item.phonemes) && item.phonemes.length > 0) {
                                // Filter out empty phonemes
                                const validPhonemes = item.phonemes.filter(p => p && p.trim() !== '');
                                allPhonemes = [...allPhonemes, ...validPhonemes];
                            }
                        });
                        
                        if (shouldLog) {
                            console.log(`   Extracted ${allParts.length} total parts and ${allPhonemes.length} total phonemes`);
                            console.log(`   Parts:`, allParts);
                            console.log(`   Phonemes:`, allPhonemes);
                        }

                        if (allParts.length > 0 && allPhonemes.length > 0) {
                            // Check if any of the word parts exist in Words collection
                            let anyPartExistsInWords = false;
                            if (partsAfterSplit && partsAfterSplit.length > 0) {
                                for (const part of partsAfterSplit) {
                                    const trimmedPart = part.trim();
                                    if (trimmedPart) {
                                        const partExists = await Word.findOne({ 
                                            fullWord: trimmedPart
                                        });
                                        if (partExists) {
                                            anyPartExistsInWords = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // Update the WordBatch record with error handling
                            try {
                                await WordBatch.findByIdAndUpdate(wordBatch._id, {
                                    processedParts: allParts,
                                    processedPhonemes: allPhonemes,
                                    status: 'processed',
                                    processedAt: new Date(),
                                    addedToWords: !!anyPartExistsInWords  // Explicitly set to boolean
                                }, {
                                    runValidators: false  // Skip validation to avoid issues with existing invalid data
                                });

                                if (shouldLog) {
                                    console.log(`   ✓ Successfully processed and updated WordBatch: ${wordBatch._id}`);
                                }
                                processedCount++;
                            } catch (updateError) {
                                console.error(`✗ ERROR updating WordBatch ${wordBatch._id}:`, updateError.message);
                                if (shouldLog) {
                                    console.error(`   Full error:`, updateError);
                                }
                                // Try to update with minimal fields to avoid validation errors
                                try {
                                    await WordBatch.findByIdAndUpdate(wordBatch._id, {
                                        processedParts: allParts,
                                        processedPhonemes: allPhonemes,
                                        status: 'processed',
                                        processedAt: new Date(),
                                        addedToWords: false  // Set to false as fallback
                                    }, {
                                        runValidators: false,
                                        setDefaultsOnInsert: false
                                    });
                                    processedCount++;
                                    if (shouldLog) {
                                        console.log(`   ✓ Retry update succeeded for WordBatch: ${wordBatch._id}`);
                                    }
                                } catch (retryError) {
                                    console.error(`✗ ERROR retry update failed for WordBatch ${wordBatch._id}:`, retryError.message);
                                    await WordBatch.findByIdAndUpdate(wordBatch._id, {
                                        status: 'failed',
                                        errorMessage: `Update failed: ${updateError.message}`,
                                        processedAt: new Date()
                                    }, {
                                        runValidators: false
                                    });
                                    failedCount++;
                                }
                            }
                        } else {
                            // Mark as failed if no valid data
                            console.error(`✗ ERROR: No valid parts or phonemes extracted for: "${processedWordBatch}"`);
                            if (shouldLog) {
                                console.error(`   All parts:`, allParts);
                                console.error(`   All phonemes:`, allPhonemes);
                            }
                            await WordBatch.findByIdAndUpdate(wordBatch._id, {
                                status: 'failed',
                                errorMessage: 'No valid parts or phonemes extracted from processing',
                                processedAt: new Date()
                            });
                            failedCount++;
                        }
                    } else {
                        // Mark as failed if no valid data
                        console.error(`✗ ERROR: No valid processing data returned for: "${processedWordBatch}"`);
                        if (shouldLog) {
                            console.error(`   Processed data:`, JSON.stringify(processedData, null, 2));
                        }
                        await WordBatch.findByIdAndUpdate(wordBatch._id, {
                            status: 'failed',
                            errorMessage: 'No valid processing data returned',
                            processedAt: new Date()
                        });
                        failedCount++;
                    }
                } catch (error) {
                    console.error(`✗ ERROR processing WordBatch ${wordBatch._id}:`, error.message);
                    await WordBatch.findByIdAndUpdate(wordBatch._id, {
                        status: 'failed',
                        errorMessage: error.message,
                        processedAt: new Date()
                    });
                    failedCount++;
                }
            }

            console.log(`\n=== Batch Processing Summary ===`);
            console.log(`Total records: ${wordBatches.length}`);
            console.log(`Processed: ${processedCount}`);
            console.log(`Failed: ${failedCount}`);
            console.log(`Skipped (approved): ${skippedCount}`);

            res.json({
                success: true,
                message: 'WordBatch processing completed',
                processedCount,
                failedCount,
                skippedCount,
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
