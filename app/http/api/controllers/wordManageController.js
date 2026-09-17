import controller from './controller.js';
import Word from '../../../models/word.js';
import Batch from '../../../models/batch.js';
import WordBatch from '../../../models/wordBatch.js';
import applyOrthographyFixes from '../../../helpers/wordBatchPreprocessor.js';
import englishRhymeController from './englishRhymeController.js';
import WordBank from '../../../models/wordBank.js';
import mongoose from 'mongoose';

const longVowels = ['آ', 'و', 'ی', 'ا']
const shortVowels = [String.fromCharCode(1614), String.fromCharCode(1615), String.fromCharCode(1616)]
// Arabic marks that sit on a letter rather than being one: fathatan…sukun, plus
// shadda and the hamza carriers. Stripped before consonants are counted.
const DIACRITIC_MARKS = [1611, 1612, 1613, 1614, 1615, 1616, 1617, 1618, 1619, 1620, 1621, 1648, 1652]
    .map(c => String.fromCharCode(c))


class wordManageController extends controller {
    async deleteWord(req, res, next) {
        let id = req.query.id
        await Word.deleteOne({_id: id})
        res.status(200).json("Word deleted successfully")
    }
    async updateWordStatus(req, res, next) {
        let id = req.query.id
        let approved = req.body.approved
        let level = req.body.level !== undefined ? parseInt(req.body.level) : undefined
        
        let updateData = {
            approved: approved, 
            approvedBy: approved ? (req.user?.id || null) : null, 
            approvedAt: approved ? new Date() : null
        }
        
        // Only update level if provided
        if (level !== undefined && !isNaN(level)) {
            updateData.level = level
        }
        
        await Word.updateOne({_id: id}, updateData)  
        res.status(200).json("Word status updated successfully")
    }
    async updateWord(req, res, next) {
        let id = req.query.id
        let word = await Word.findById(id)
        let check = await Word.find({ fullWordWithNimFaseleh: req.body.fullWord })
        if(check.length > 1){
            return res.status(409).json("Word already exists")
        }
        let fullWord = req.body.fullWord
        console.log("Input fullWord:", fullWord)
        let fullWordWithNimFaseleh = fullWord
        let spacePositions = []
        let nimFaselehPositions = []
        for(let i = 0; i < fullWord.length; i++){
            if(fullWord[i] == " "){
                spacePositions.push(i)
            }
        }
        for(let i = 0; i < fullWord.length; i++){
            if(fullWord[i] == String.fromCharCode(0x200C)){
                nimFaselehPositions.push(i)
            }
        }
        // replace nimFaseleh with space
        fullWord = fullWord.replace(/\u200C/g, " ");
        console.log("Processed fullWord:", fullWord)
        let updateSchema = {
            $set: {
                fullWord: fullWord,
                fullWordWithNimFaseleh: fullWordWithNimFaseleh,
                word: this.solidWord(fullWord),
                spacePositions: spacePositions,
                nimFaselehPositions: nimFaselehPositions,
                heja: req.body.heja,
                ava: req.body.ava,
                avaString: req.body.ava.join(" - "),
                hejaCounter: req.body.heja.length
            }
        }
        
        // Update level if provided
        if (req.body.level !== undefined && !isNaN(parseInt(req.body.level))) {
            updateSchema.$set.level = parseInt(req.body.level);
        }
        console.log("updateSchema", updateSchema)
        try {
            const result = await Word.updateOne({_id: id}, updateSchema)
            if (result.modifiedCount === 0) {
                return res.status(404).json("Word not found or no changes made")
            }
            res.status(200).json("Word updated successfully")
        } catch (error) {
            console.log("error", error)
            res.status(500).json({ error: "Word update failed", details: error.message })
        }
    }
    async suggestWord(req, res, next) {
        if (req.query.lang === 'en') {
            return englishRhymeController.suggestWord(req, res, next)
        }
        let search = new RegExp(`^${req.query.string}`, 'i');
        let words = await Word.find({
            lang: { $ne: 'en' },
            $or: [
              {
                $and: [
                  { word: search },
                  { word: { $not: /\s/ } }
                ]
              },
              {
                $and: [
                  { fullWord: search },
                  { fullWord: { $not: /\s/ } }
                ]
              }
            ]
          }).limit(10)
        res.status(200).json(words)
    }

    async getWords(req, res, next) {
        let search = req.query.search || ""
        let page = req.query.page || 1
        let approved = req.query.approved == "1" ? true : false
        let level = req.query.level !== undefined ? parseInt(req.query.level) : undefined
        
        // Build query object
        let query = {
            approved: approved
        }
        
        // Add search filter - search in word text or exact match in ava array
        if (search) {
            // Check if search contains commas (phoneme sequence)
            if (search.includes(',')) {
                // Split by comma and trim each phoneme for exact matching
                const searchPhonemes = search.split(',').map(p => p.trim()).filter(p => p)
                // Match exact sequence in ava array
                query.$or = [
                    { word: {$regex: search, $options: 'i'} },
                    { ava: searchPhonemes }
                ]
            } else {
                // Regular text search in word field only
                query.word = {$regex: search, $options: 'i'}
            }
        }
        
        // Add level filter if provided
        if (level !== undefined && !isNaN(level)) {
            query.level = level
        }
        
        let count = await Word.countDocuments(query)
        let words = await Word.paginate(query, { page, sort: { createdAt: -1 }, limit: 25 })
        res.status(200).json({ words: words, count: count })
    }

    async removeWord(req, res, next) {
        let id = req.query.id
        let word = await Word.findById(id)
        word.delete()
        res.status(200).json()
    }
    async saveWords(req, res, next) {
        let newWordParts = req.body.data
        let wordDetails = []
        let phonemes = []
        for (let i = 0; i < newWordParts.length; i++) {
            newWordParts[i].parts = newWordParts[i].parts.map(part => part.replace(/y/g, 'ی').replace(/w/g, 'و'))
            newWordParts[i].phonemes = newWordParts[i].phonemes.map(phoneme => phoneme.replace(/y/g, 'ی').replace(/w/g, 'و'))
            newWordParts[i].part = newWordParts[i].part.replace(/y/g, 'ی').replace(/w/g, 'و')
            // Declare word in database
            if (newWordParts[i].db) {
                let word = await Word.findById(newWordParts[i].id)
                wordDetails = [...wordDetails, ...word.heja]
                phonemes = [...phonemes, ...word.ava]
                continue
            }
            // Check if word is already in database and not declared
            let check = await Word.findOne({ fullWord: newWordParts[i].part })
            if (check) {
                wordDetails = [...wordDetails, ...check.heja]
                phonemes = [...phonemes, ...check.ava]
                continue
            }
            let fullWord = newWordParts[i].part;
            let fullWordWithNimFaseleh = newWordParts[i].part;
            let spacePositions = []
            for(let i = 0; i < fullWord.length; i++){
                if(fullWord[i] == " "){
                    spacePositions.push(i)
                }
            }
            let nimFaselehPositions = []
            for(let i = 0; i < fullWord.length; i++){
                if(fullWord[i] == String.fromCharCode(0x200C)){
                    nimFaselehPositions.push(i)
                }
            }
            fullWord = fullWord.replace(/\u200C/g, " ");
            // console.log(fullWordWithNimFaseleh, "sssssssssssssssss1")
            let solidWordPart = this.solidWord(newWordParts[i].part)
            let newWordPart = new Word({
                fullWord: newWordParts[i].part,
                fullWordWithNimFaseleh: fullWordWithNimFaseleh,
                word: solidWordPart,
                heja: newWordParts[i].parts,
                avaString: newWordParts[i].phonemes.join(","),
                ava: newWordParts[i].phonemes,
                hejaCounter: newWordParts[i].phonemes.length,
                spacePositions: spacePositions,
                nimFaselehPositions: nimFaselehPositions,
                level: 1 // Default level
            })
            await newWordPart.save();
            wordDetails = [...wordDetails, ...newWordParts[i].parts]
            phonemes = [...phonemes, ...newWordParts[i].phonemes]
        }
        wordDetails = wordDetails.map(part => part.replace(/y/g, 'ی').replace(/w/g, 'و'))
        phonemes = phonemes.map(phoneme => phoneme.replace(/y/g, 'ی').replace(/w/g, 'و'))
        let fullWord = req.body.s.replace(/y/g, 'ی').replace(/w/g, 'و');
        let fullWordWithNimFaseleh = fullWord;
        let spacePositions = []
        for(let i = 0; i < fullWord.length; i++){
            if(fullWord[i] == " "){
                spacePositions.push(i)
            }
        }
        let nimFaselehPositions = []
        for(let i = 0; i < fullWord.length; i++){
            if(fullWord[i] == String.fromCharCode(0x200C)){
                nimFaselehPositions.push(i)
            }
        }
        
        // replace nimFaseleh with space
        fullWord = fullWord.replace(/\u200C/g, " ");
        // console.log(fullWordWithNimFaseleh, "sssssssssssssssss1")
        let check = await Word.findOne({ fullWord })
        if (check) {
            return res.status(200).json({
                totalId: check._id
            })
        }

        let word = this.solidWord(fullWord);


        let newWord = new Word({
            fullWord,
            fullWordWithNimFaseleh,
            word,
            heja: wordDetails,
            avaString: phonemes.join(","),
            spacePositions: spacePositions,
            nimFaselehPositions: nimFaselehPositions,
            ava: phonemes,
            hejaCounter: phonemes.length,
            level: 1 // Default level
        })
        await newWord.save();
        res.status(200).json({
            totalId: newWord._id
        })
    }

    async saveBatchWord(req, res, next) {
        try {
            let wordBatchId = req.body.wordBatchId
            let wordBatch = await WordBatch.findById(wordBatchId)
            if (!wordBatch) {
                return res.status(404).json({
                    success: false,
                    message: 'Word batch not found'
                });
            }

            // Check if this word has already been added from this batch
            if (wordBatch.addedToWords) {
                // Find the word that was already added
                const alreadyAddedWord = await Word.findOne({ 
                    $or: [
                        { fullWord: wordBatch.organizedGrapheme },
                        { wordBatchId: wordBatchId }
                    ]
                });
                
                if (alreadyAddedWord) {
                    return res.status(409).json({
                        success: false,
                        message: 'This word has already been added from this batch',
                        wordId: alreadyAddedWord._id,
                        isNew: false
                    });
                } else {
                    // If addedToWords is true but word not found, reset the flag
                    await WordBatch.findByIdAndUpdate(wordBatchId, {
                        addedToWords: false
                    });
                }
            }

            let organizedGrapheme = wordBatch.organizedGrapheme
            let processedPhoneme = wordBatch.processedPhonemes
            let processedHeja = wordBatch.processedParts
            let batchId = wordBatch.batch
            let batchName = null // batchName is not available in WordBatch model

            // Check if word already exists in database
            const existingWord = await Word.findOne({ fullWord: organizedGrapheme });
            if (existingWord) {
                // Mark this batch word as added even though word already existed
                await WordBatch.findByIdAndUpdate(wordBatchId, {
                    addedToWords: true
                });
                return res.status(200).json({
                    success: true,
                    message: 'Word already exists in database',
                    wordId: existingWord._id,
                    isNew: false
                });
            }

            // Create space and nimFaseleh positions BEFORE conversion
            let spacePositions = []
            let nimFaselehPositions = []
            for(let i = 0; i < organizedGrapheme.length; i++){
                if(organizedGrapheme[i] === " "){
                    spacePositions.push(i);
                }
                if(organizedGrapheme[i] === String.fromCharCode(0x200C)){
                    nimFaselehPositions.push(i);
                }
            }

            // Convert nim faseleh to space for fullWord
            // Use both regex and explicit character code for safety
            const fullWord = organizedGrapheme
                .replace(/\u200C/g, " ")  // Unicode escape
                .replace(/\u200C/g, " "); // Explicit character code
            
            // Recalculate spacePositions after conversion (include converted nim faseleh positions)
            const finalSpacePositions = [...spacePositions, ...nimFaselehPositions].sort((a, b) => a - b);
            
            const solidWord = this.solidWord(fullWord);

            // Debug logging (remove in production)
            console.log('Word conversion:', {
                original: organizedGrapheme,
                converted: fullWord,
                hasNimFaseleh: organizedGrapheme.includes('\u200C'),
                nimFaselehPositions: nimFaselehPositions,
                finalSpacePositions: finalSpacePositions
            });

            // Get level from request body, default to 1 if not provided
            const level = req.body.level !== undefined ? parseInt(req.body.level) : 1;

            // Create the new word
            const newWord = new Word({
                fullWord: fullWord,  // Use converted version (with spaces, not nim faseleh)
                fullWordWithNimFaseleh: organizedGrapheme,  // Keep original with nim faseleh
                word: solidWord,
                heja: processedHeja,
                avaString: processedPhoneme.join(","),
                ava: processedPhoneme,
                hejaCounter: processedHeja.length,
                spacePositions: finalSpacePositions,  // Include both original spaces and converted nim faseleh positions
                nimFaselehPositions: nimFaselehPositions,  // Positions in original string
                // Batch tracking fields
                addedBy: req.user?.id || null,
                batchId: batchId || null,
                batchName: batchName || null,
                wordBatchId: wordBatchId || null,
                approved: false,  // Don't auto-approve
                approvedBy: null,
                approvedAt: null,
                level: level
            });

            await newWord.save();

            // Update the WordBatch record to mark it as added
            await WordBatch.findByIdAndUpdate(wordBatchId, {
                status: 'processed',
                processedAt: new Date(),
                addedToWords: true
            });

            res.status(201).json({
                success: true,
                message: 'Word created successfully from batch',
                wordId: newWord._id,
                isNew: true,
                processedGrapheme: organizedGrapheme
            });

        } catch (error) {
            console.error('Error saving batch word:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating word from batch',
                error: error.message
            });
        }
    }

    async updateWordBatch(req, res, next) {
        try {
            const { wordBatchId } = req.params;
            const { processedParts, processedPhonemes } = req.body;

            // Check if word batch item exists
            const wordBatch = await WordBatch.findById(wordBatchId);
            if (!wordBatch) {
                return res.status(404).json({
                    success: false,
                    message: 'Word batch item not found'
                });
            }

            // Verify that the word hasn't been added to the words collection
            if (wordBatch.addedToWords === true) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot edit word that has already been added to words collection'
                });
            }

            // Validate request body
            const updateData = {};

            // Validate and process processedParts
            if (processedParts !== undefined) {
                if (!Array.isArray(processedParts)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid request data',
                        error: 'processedParts must be an array'
                    });
                }
                // Filter out empty strings and trim whitespace
                updateData.processedParts = processedParts
                    .map(part => typeof part === 'string' ? part.trim() : String(part).trim())
                    .filter(part => part !== '');
            }

            // Validate and process processedPhonemes
            if (processedPhonemes !== undefined) {
                if (!Array.isArray(processedPhonemes)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid request data',
                        error: 'processedPhonemes must be an array'
                    });
                }
                // Filter out empty strings and trim whitespace
                updateData.processedPhonemes = processedPhonemes
                    .map(phoneme => typeof phoneme === 'string' ? phoneme.trim() : String(phoneme).trim())
                    .filter(phoneme => phoneme !== '');
            }

            // Check if there's anything to update
            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request data',
                    error: 'At least one field (processedParts or processedPhonemes) must be provided'
                });
            }

            // Update the word batch item
            const updatedWordBatch = await WordBatch.findByIdAndUpdate(
                wordBatchId,
                updateData,
                { new: true, runValidators: true }
            );

            // Return success response
            res.status(200).json({
                success: true,
                message: 'Word batch item updated successfully',
                data: {
                    id: updatedWordBatch._id,
                    processedParts: updatedWordBatch.processedParts,
                    processedPhonemes: updatedWordBatch.processedPhonemes,
                    updatedAt: updatedWordBatch.updatedAt
                }
            });

        } catch (error) {
            console.error('Error updating word batch:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    solidWord(s) {
        let string = s.split(String.fromCharCode(1614)).join("").split(String.fromCharCode(1615)).join("")
            .split(String.fromCharCode(1616)).join("").split(String.fromCharCode(1617)).join("")
        return string
    }

    async wordPreProcessing(word, partsNumber, partsSkip) {
        let heja = []
        let ava = []
        let hejaCounter = 0
        let avaString = ""
        let spacePositions = []
        let nimFaselehPositions = []
        // از اسکیپ برو جلو پارت تا برو جلو
        for(let i = partsSkip; i < partsNumber + partsSkip; i++){
            heja.push(word.heja[i])
            ava.push(word.ava[i])
            spacePositions.push(word.spacePositions[i])
            avaString += word.ava[i] + ","
            hejaCounter++
        }
        



        let newWord = {
            fullWord: word.fullWord,
            fullWordWithNimFaseleh: word.fullWordWithNimFaseleh,
            word: word.word,
            heja,
            ava: ava,
            hejaCounter,
            spacePositions,
            nimFaselehPositions
        }
        return newWord
    }


    async getTraditionalRhymes(req, res, next) {
        if (req.query.lang === 'en') {
            return englishRhymeController.getTraditionalRhymes(req, res, next)
        }
        let id = req.query.id
        let page = parseInt(req.query.page) || 1
        let limit = parseInt(req.query.limit) || 10
        let word = await Word.findById(id)
        let partsNumber = req.query.partsNumber || 1
        let filter = req.query.filter || ""
        if(partsNumber == -1) partsNumber = 1
        let endsWith = word.fullWord.split("").slice(word.fullWord.length - partsNumber, word.fullWord.length).join("")
        console.log("endsWith", endsWith)
        let rhymes = await this.ryhmFinding(word, filter, 1, false, page, limit, endsWith)
        let vajs = word.fullWord.split("")
        rhymes.vajs = vajs
        rhymes.selectedWord = word
        // For traditional rhymes, highlight the ending part of each rhyme word
        for(let i = 0; i < rhymes.highlight.length; i++){
            let rhymeWordLength = rhymes.fullResponse[i].length
            let highlightStart = rhymeWordLength - endsWith.length
            let highlightEnd = rhymeWordLength - 1
            rhymes.highlight[i] = [highlightStart, highlightEnd]
        }
        res.status(200).json(rhymes)
    }


    async getRhymes(req, res, next) {
        if (req.query.lang === 'en') {
            return englishRhymeController.getRhymes(req, res, next)
        }
        let filter = req.query.filter
        let id = req.query.id
        let initWord = await Word.findById(id)
        if (!initWord) {
            return res.status(404).json({
                error: "Word not found"
            })
        }
        let partsNumber = parseInt(req.query.partsNumber) || initWord.hejaCounter
        if(partsNumber == -1) partsNumber = initWord.hejaCounter
        let partsSkip = parseInt(req.query.partsSkip) || 0
        // One آوا is a legitimate scope — rhyming on a single vowel is the
        // widest net there is, and the notepad's rail lets a writer ask for it.
        if (partsNumber < 1){
            return res.status(400).json({
                error: "Parts number must be at least 1"
            })
        }
        
        // Pagination parameters
        let page = parseInt(req.query.page) || 1
        let limit = parseInt(req.query.limit) || 10
        let professional = req.query.professional !== 'false' // default to true
        
        let mainWord = await this.wordPreProcessing(initWord, partsNumber, partsSkip)
        let response = await this.ryhmFinding(mainWord, filter, partsNumber, professional, page, limit)
        response.selectedWord = initWord
        res.status(200).json(response)
    }

    /**
     * Word ids in the writer's bank, optionally narrowed to some folders.
     *
     *   ''/'all'  the whole bank
     *   '<id>,…'  those drawers (plus `none` for بدون پوشه)
     */
    async bankWordIds(userId, foldersParam) {
        const query = { user: userId };
        const raw = (foldersParam || '').trim();
        if (raw && raw !== 'all') {
            const ids = [];
            let includeUncategorised = false;
            for (const token of raw.split(',').map((t) => t.trim()).filter(Boolean)) {
                if (token === 'none' || token === 'null') {
                    includeUncategorised = true;
                } else if (mongoose.Types.ObjectId.isValid(token)) {
                    ids.push(new mongoose.Types.ObjectId(token));
                }
            }
            if (ids.length && includeUncategorised) {
                query.$or = [{ folder: { $in: ids } }, { folder: null }];
            } else if (ids.length) {
                query.folder = { $in: ids };
            } else if (includeUncategorised) {
                query.folder = null;
            }
        }
        const entries = await WordBank.find(query).select('word').limit(2000);
        return entries.map((e) => e.word).filter(Boolean);
    }

    /**
     * GET /compoundRhymes?ids=<w1,w2,…>&folders=&partsNumber=&partsSkip=&page=&limit=
     *
     * قافیهٔ ترکیبی — two or more rhymes standing side by side in a line are
     * heard as one word: «بازپُرس بَخشَنده» is one sound, not two.
     *
     * So that is exactly how it is answered. The members' هجا and آوا are
     * merged into a word that exists only for the length of this request, and
     * that word is handed to the SAME rhyme search every ordinary word goes
     * through — same scope rules, same post-processing, same shape of answer.
     * Every result is therefore a real word from the dictionary; nothing is
     * assembled, and nothing is invented.
     *
     * The merged word is never written back. It is a way of hearing two words,
     * not a new entry — see test/compoundRhymes.integration.test.js.
     */
    async getCompoundRhymes(req, res, next) {
        try {
            const rawIds = (req.query.ids || '')
                .split(',')
                .map((t) => t.trim())
                .filter((t) => mongoose.Types.ObjectId.isValid(t));
            if (rawIds.length < 2) {
                return res.status(400).json({ error: 'ids must name at least two words' });
            }

            const found = await Word.find({ _id: { $in: rawIds } })
                .select('fullWord fullWordWithNimFaseleh word heja ava avaString hejaCounter spacePositions nimFaselehPositions lang');
            // Keep the caller's order: the sound of a compound is not a set.
            const byId = new Map(found.map((w) => [String(w._id), w]));
            const members = rawIds.map((id) => byId.get(id)).filter(Boolean);
            if (members.length < 2) {
                return res.status(404).json({ error: 'Words not found' });
            }
            if (members.some((w) => w.lang === 'en')) {
                return res.status(400).json({ error: 'Compound rhymes are Persian-only for now' });
            }

            // ---- the word that exists only for this request
            const ava = members.flatMap((w) => w.ava);
            const heja = members.flatMap((w) => w.heja);
            const fullWord = members.map((w) => w.fullWord).join(' ');
            const word = members.map((w) => w.word).join(' ');
            const spacePositions = [];
            let cursor = 0;
            for (const w of members) {
                for (const part of w.heja) {
                    cursor += part.length;
                    spacePositions.push(cursor);
                }
            }
            const compound = {
                _id: null,
                fullWord,
                fullWordWithNimFaseleh: fullWord,
                word,
                heja,
                ava,
                avaString: ava.join(','),
                hejaCounter: ava.length,
                spacePositions,
                nimFaselehPositions: [],
            };

            // ---- and now it is just a word
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 60, 200);
            const filter = req.query.filter || '';
            const professional = req.query.professional !== 'false';
            let partsNumber = parseInt(req.query.partsNumber);
            if (!partsNumber || partsNumber < 1) partsNumber = compound.hejaCounter;
            partsNumber = Math.min(partsNumber, compound.hejaCounter);
            const partsSkip = Math.max(0, Math.min(parseInt(req.query.partsSkip) || 0, compound.hejaCounter - partsNumber));

            // The notepad's source switch still governs: folders narrow the same
            // search to the writer's own bank.
            let restrictIds = null;
            if (typeof req.query.folders === 'string') {
                restrictIds = await this.bankWordIds(req.user.id, req.query.folders);
                if (restrictIds.length === 0) {
                    // An empty bank is an empty answer, but it must still be a
                    // complete one: the caller reads `compound` and
                    // `matchedParts` off every response.
                    return res.status(200).json({
                        rhymes: [], fullResponse: [], rhymeAva: [], heja: [], ids: [], highlight: [],
                        members: members.map((w) => ({
                            id: w._id, fullWord: w.fullWord, word: w.word, ava: w.ava, hejaCounter: w.hejaCounter,
                        })),
                        compound: {
                            fullWord, word, heja, ava,
                            avaString: compound.avaString,
                            hejaCounter: compound.hejaCounter,
                        },
                        matchedParts: partsNumber,
                        matchedWhole: partsNumber === compound.hejaCounter,
                        scoped: true,
                        selectedWord: compound,
                        pagination: {
                            currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit,
                            hasNextPage: false, hasPrevPage: false, nextPage: null, prevPage: null,
                        },
                    });
                }
            }

            // A compound is long by construction — two words' worth of syllables
            // — and almost nothing in the dictionary carries a whole five-hejā
            // sound. A writer answers a long rhyme on its tail, so when the
            // caller has not asked for a particular scope we walk inward: the
            // whole compound first, then one hejā shorter, and so on. The scope
            // that answered is reported back, so the strip can say which part of
            // the compound these rhymes actually match.
            const asked = !!parseInt(req.query.partsNumber);
            const floor = asked ? partsNumber : Math.max(2, partsNumber - 3);
            let response = null;
            let matchedParts = partsNumber;

            for (let parts = partsNumber; parts >= floor; parts -= 1) {
                const skip = asked ? partsSkip : compound.hejaCounter - parts;
                const mainWord = await this.wordPreProcessing(compound, parts, skip);
                response = await this.ryhmFinding(
                    mainWord,
                    filter,
                    parts,
                    professional,
                    page,
                    limit,
                    '',
                    restrictIds
                );
                matchedParts = parts;
                if (asked || (response.ids && response.ids.length > 0)) break;
            }

            // A member of the compound is not an answer to it.
            const memberIds = new Set(members.map((w) => String(w._id)));
            const keep = response.ids
                .map((id, i) => i)
                .filter((i) => !memberIds.has(String(response.ids[i])));
            const pick = (arr) => (Array.isArray(arr) ? keep.map((i) => arr[i]) : arr);

            return res.status(200).json({
                ...response,
                rhymes: pick(response.rhymes),
                fullResponse: pick(response.fullResponse),
                rhymeAva: pick(response.rhymeAva),
                heja: pick(response.heja),
                ids: pick(response.ids),
                highlight: pick(response.highlight),
                members: members.map((w) => ({
                    id: w._id,
                    fullWord: w.fullWord,
                    word: w.word,
                    ava: w.ava,
                    hejaCounter: w.hejaCounter,
                })),
                compound: {
                    fullWord,
                    word,
                    heja,
                    ava,
                    avaString: compound.avaString,
                    hejaCounter: compound.hejaCounter,
                },
                /** True when this search was narrowed to the writer's own bank. */
                scoped: restrictIds !== null,
                /** How many of the compound's hejā these answers actually rhyme on. */
                matchedParts,
                /** True when that is the whole compound rather than its tail. */
                matchedWhole: matchedParts === compound.hejaCounter,
                selectedWord: compound,
            });
        } catch (error) {
            console.error('getCompoundRhymes failed:', error);
            return res.status(500).json({ error: 'getCompoundRhymes failed', details: error.message });
        }
    }

    /**
     * GET /bankRhymes?id=<anchorWordId>&folders=<csv>&partsNumber=&limit=
     *
     * The same question getRhymes answers, asked of the writer's own word bank
     * instead of the whole dictionary: "which of MY words rhyme with this?"
     *
     * `folders` selects the drawers to draw from — a comma-separated list of
     * folder ids, `none` for بدون پوشه, empty/absent for the whole bank. This
     * is what stands behind the notepad's "from my folders / from everything"
     * switch.
     *
     * Matching is the same rule the dictionary search uses — the last N
     * phonemes must be identical — applied to a set small enough to compare in
     * memory. Because it works on phonemes, it is language-agnostic: an
     * English bank matches by cmudict phonemes exactly the same way.
     *
     * Shaped like getRhymes so the client can read both with one mapping.
     */
    async getBankRhymes(req, res, next) {
        try {
            const anchor = await Word.findById(req.query.id)
                .select('ava avaString word fullWord heja hejaCounter lang spacePositions nimFaselehPositions');
            if (!anchor) {
                return res.status(404).json({ error: 'Word not found' });
            }

            const limit = Math.min(parseInt(req.query.limit) || 200, 500);
            let parts = parseInt(req.query.partsNumber);
            if (!parts || parts < 1) parts = anchor.hejaCounter;
            parts = Math.min(parts, anchor.ava.length);
            if (parts < 1) {
                return res.status(400).json({ error: 'Word has no phonemes to match on' });
            }
            // Which stretch of the anchor to rhyme on. Default is its tail, the
            // same window the dictionary search uses when none is given.
            let skip = parseInt(req.query.partsSkip);
            if (Number.isNaN(skip) || skip < 0) skip = anchor.ava.length - parts;
            skip = Math.max(0, Math.min(skip, anchor.ava.length - parts));

            // ---- which drawers
            const wordIds = (await this.bankWordIds(req.user.id, req.query.folders))
                .filter((id) => String(id) !== String(anchor._id));

            const empty = {
                rhymes: [], fullResponse: [], rhymeAva: [], heja: [], ids: [], highlight: [],
                selectedWord: anchor,
                pagination: {
                    currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: limit,
                    hasNextPage: false, hasPrevPage: false, nextPage: null, prevPage: null,
                },
            };
            if (wordIds.length === 0) {
                return res.status(200).json(empty);
            }

            const candidates = await Word.find({ _id: { $in: wordIds } })
                .select('ava avaString word fullWord heja hejaCounter spacePositions nimFaselehPositions lang')
                .limit(2000);

            const tail = anchor.ava.slice(skip, skip + parts).join(',');
            const anchorLangEn = anchor.lang === 'en';

            const rhymes = [];
            const fullResponse = [];
            const rhymeAva = [];
            const heja = [];
            const ids = [];
            const highlight = [];

            for (const w of candidates) {
                if ((w.lang === 'en') !== anchorLangEn) continue;
                if (!Array.isArray(w.ava) || w.ava.length < parts) continue;
                if (w.ava.slice(w.ava.length - parts).join(',') !== tail) continue;

                rhymes.push(w.word);
                fullResponse.push(w.fullWord);
                rhymeAva.push(w.avaString);
                heja.push(w.heja);
                ids.push(w._id);

                // Same highlight geometry the dictionary search returns, so a
                // bank result renders identically to a dictionary one.
                try {
                    const startIndex = w.ava.length - parts;
                    const hejaPart = await this.rhymeProcessing(w, startIndex, startIndex + parts);
                    const from = w.fullWord.indexOf(hejaPart);
                    highlight.push(from >= 0 ? [from, from + hejaPart.length - 1] : [-1, -1]);
                } catch {
                    highlight.push([-1, -1]);
                }

                if (ids.length >= limit) break;
            }

            return res.status(200).json({
                rhymes,
                fullResponse,
                rhymeAva,
                heja,
                ids,
                highlight,
                selectedWord: anchor,
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: ids.length,
                    itemsPerPage: limit,
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextPage: null,
                    prevPage: null,
                },
            });
        } catch (error) {
            console.error('getBankRhymes failed:', error);
            return res.status(500).json({ error: 'getBankRhymes failed', details: error.message });
        }
    }

    async ryhmFinding(w, f, n, professional=true, page=1, limit=10, endsWith="", restrictIds=null) {
        console.log(n)
        let endsWithRegex = ""
        if(endsWith){
            endsWithRegex = new RegExp(`${endsWith}$`, 'u')
        }
        let rhymeHeja = n
        let filterChar = []
        f.split(",").map(x =>
            filterChar.push(`(?=.*${x})`)
        )
        let filterAva = []
        w.ava.map(y =>
            filterAva.push(`${y}`)
        )
        console.log("filterAva", filterAva)
        // let backupFilterAva = Object.assign([], filterAva)

        let searchChar = new RegExp(filterChar.join(""), 'gi');
        // let avaString = w.ava.splice(0, 1).join(',')
        // console.log(filterChar)
        let avaQuery = filterAva.slice(filterAva.length - rhymeHeja, filterAva.length).join(",")
        // console.log("searchAva", rhymeHeja, filterAva.length - rhymeHeja, filterAva.length, avaQuery)
        
        let searchAva = new RegExp(avaQuery);

        console.log("searchAva", searchAva)
        
        // The professional filter runs in JS, after the query, so paging cannot be
        // pushed down to Mongo — the whole rhyme family has to be in hand before
        // page N can be sliced out of it.
        //
        // This used to fetch `limit * 10`, which capped every answer at ten pages:
        // حَدید has 395 rhymes and the API could only ever show 100 of them, and
        // `totalItems` changed with the page size that was asked for. The largest
        // family in the Persian dictionary is under 400, so the whole family is
        // fetched and CANDIDATE_CAP is only a runaway guard.
        //
        // The sort is what makes paging safe: without it Mongo gives no order
        // guarantee, so page 2 of one request and page 2 of the next need not be
        // the same rows — and the client appends pages as the reader scrolls.
        const CANDIDATE_CAP = 2000
        let words = []
        // An optional id restriction narrows the same search to a subset of the
        // dictionary — the writer's own bank, when the notepad asks for that.
        const restrict = restrictIds && restrictIds.length ? { _id: { $in: restrictIds } } : {};
        if(!endsWith){
            words = await Word.find({ ...restrict, avaString: searchAva, word: searchChar, hejaCounter: rhymeHeja, lang: { $ne: 'en' } })
            .select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter')
            .sort({ _id: 1 })
            .limit(CANDIDATE_CAP);
        }else{
            const rx = new RegExp(`${avaQuery}\\s*$`, 'u');
            console.log("searchFromLastAva", rx)
            words = await Word.find({ ...restrict, avaString:rx, fullWord:endsWithRegex, word: searchChar, lang: { $ne: 'en' } })
            .select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter')
            .sort({ _id: 1 })
            .limit(CANDIDATE_CAP);
        }
        
        // Remove words with more than rhymeHeja from result
        // console.log("rhymeHeja", rhymeHeja, backupFilterAva.length)
        // for(let i = rhymeHeja; i < backupFilterAva.length; i++){
        //     let newFilterAva = Object.assign([], backupFilterAva)
        //     let newSearchAva = new RegExp(newFilterAva.splice( newFilterAva.length - (i + 1) , newFilterAva.length ).join(","));
        //     // console.log("newSearchAva", newSearchAva)
        //     let removeList = await Word.find({ avaString: newSearchAva, word: searchChar, hejaCounter: rhymeHeja }).select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter');
        //     for(let j = 0; j < removeList.length; j++){
        //         words = words.filter(word => {
        //             return word.id !== removeList[j].id
        //         })
        //     }
        // }

        if(professional) words = this.wordPostProcessing(words, w.heja, w.ava)

        
        let response = []
        let fullResponse = []
        let highlight = []
        let rhymeAva = []
        let heja = []
        let ids = []
        let avaOfRhyme = w.ava.splice(w.ava.length - rhymeHeja, w.ava.length)
        for(let i = 0; i < words.length; i++){
            response.push(words[i].word)
            fullResponse.push(words[i].fullWord)
            heja.push(words[i].heja)
            ids.push(words[i]._id)
            rhymeAva.push(words[i].avaString)
            // find same ava in word's avaString
            const startIndex = findSubsequenceIndex(words[i].ava, avaOfRhyme);
            const lastIndex = startIndex + rhymeHeja
            // // find ava's heja in word
            let hejaPartSentence = await this.rhymeProcessing(words[i], startIndex, lastIndex)
            // console.log("hejaPartSentence", hejaPartSentence, startIndex, lastIndex)
            // // find heja index in word
            let hejaIndexInWord = words[i].fullWord.indexOf(hejaPartSentence)
            let hejaIndexInWordEnd = hejaIndexInWord + hejaPartSentence.length - 1
            
            highlight.push([hejaIndexInWord,hejaIndexInWordEnd])
            
        }
        function findSubsequenceIndex(bigger, smaller) {
            const len = smaller.length;
            for (let i = 0; i <= bigger.length - len; i++) {
              let match = true;
              for (let j = 0; j < len; j++) {
                if (bigger[i + j] !== smaller[j]) {
                  match = false;
                  break;
                }
              }
              if (match) return i;
            }
            return -1;
          }

        // Apply pagination to filtered results
        const startIndex = (page - 1) * limit
        const endIndex = startIndex + limit
        
        const paginatedResponse = response.slice(startIndex, endIndex)
        const paginatedFullResponse = fullResponse.slice(startIndex, endIndex)
        const paginatedHighlight = highlight.slice(startIndex, endIndex)
        const paginatedRhymeAva = rhymeAva.slice(startIndex, endIndex)
        const paginatedHeja = heja.slice(startIndex, endIndex)
        const paginatedIds = ids.slice(startIndex, endIndex)

        // Calculate pagination metadata
        const totalItems = response.length
        const totalPages = Math.ceil(totalItems / limit)
        const hasNextPage = page < totalPages
        const hasPrevPage = page > 1

        return {
            rhymes: paginatedResponse,
            fullResponse: paginatedFullResponse,
            rhymeAva: paginatedRhymeAva,
            heja: paginatedHeja,
            ids: paginatedIds,
            highlight: paginatedHighlight,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage,
                hasPrevPage,
                nextPage: hasNextPage ? page + 1 : null,
                prevPage: hasPrevPage ? page - 1 : null
            }
        }
    }
    async rhymeProcessing(word, startIndex, lastIndex) {
        let hejaSentence = ""
            let cursor = 0
            let spaceCursor = 0
            let hejaPartSentence = ""
            while(cursor < word.heja.length){
                if(cursor >= startIndex && cursor <= lastIndex){
                    hejaPartSentence += word.heja[cursor]
                }
                hejaSentence += word.heja[cursor] + " "
                spaceCursor += word.heja[cursor].length
                cursor++
                // console.log("don't have nimFaseleh", word.fullWord)
                if(word.spacePositions.includes(spaceCursor) || word.nimFaselehPositions.includes(spaceCursor)){
                    hejaSentence += " "
                    spaceCursor += 1
                    if(cursor >= startIndex && cursor <= lastIndex){
                        hejaPartSentence += " "
                    }
                }
            }
        return hejaPartSentence
    }

    /*
    این فانکشن برای پردازش کلمات برای جفت های صوتی است
    برای هر کلمه بررسی میکند که آیا آخرین صوت آن کلمه با آخرین صوت جفت صوتی مطابقت دارد یا خیر
    اگر مطابقت داشته باشد کلمه پردازش شده را به آرایه اضافه میکند
    اگر مطابقت نداشته باشد کلمه را حذف میکند
    TODO:
    ممکنه برای ی و واو نیاز به پردازش مضاعف باشد تا تشخیص دهیم نقش صامتی دارد یا مصوتی 
    از روی آوا می‌توان فهمید
    */
    /**
     * صامت‌های هر هجا — how many consonants a syllable carries.
     *
     * Counting letters is not enough, because ا و ی are sometimes consonants and
     * sometimes the vowel itself. «وَر» is v+a+r — two consonants — but a letter
     * count that treats و as a vowel says one, and پَروَردِه would then pass as a
     * rhyme of مَنظَرِه when it is not.
     *
     * The آوا of the syllable settles it. اَ اِ اُ are written as marks, so every
     * letter left after stripping the marks is a consonant. Every other آوا
     * (آ او ای) is written with a letter of its own, so exactly one letter is
     * spoken as the vowel and is not counted.
     *
     * Returns null when the آوا is missing — some rows carry fewer آوا than هجا,
     * and a syllable we cannot read is not a syllable we should judge.
     */
    syllableConsonantCount(hejaPart, avaPart){
        if(!hejaPart || !avaPart) return null
        const letters = [...hejaPart].filter(ch =>
            !DIACRITIC_MARKS.includes(ch) && ch !== ' ' && ch !== '\u200c'
        )
        const vowelHasOwnLetter = !shortVowels.includes(avaPart[avaPart.length - 1])
        // A Persian syllable always opens on a consonant, so a count of zero means
        // the spelling carries a glottal onset (word-initial آ) — that is one.
        return Math.max(1, letters.length - (vowelHasOwnLetter ? 1 : 0))
    }

    /*
    قافیهٔ حرفه‌ای — دو کلمه وقتی هم‌قافیه‌اند که تعداد صامت‌های هر هجا برابر باشد،
    به جز هجای آخر که آزاد است.

        مَنظَرِه   مَن(۲) ظَ(۱) رِه(۲)
        رَفتَنَت   رَف(۲) تَ(۱) نَت(۲)      هجای آخر فرق کند هم قافیه است
        پَروَردِه  پَر(۲) وَر(۲) دِه(۲)     هجای وسط فرق دارد، قافیه نیست

    The rule this replaced compared only whether each syllable ENDED in a vowel.
    That separates CV from CVC, but it cannot tell CVC from CVCC — رَفت (three)
    passed as a match for مَن (two) — and it judged the last syllable too, which
    wrongly dropped بَندَرِ and حَضرَتِ from مَنظَرِه.

    Syllables are aligned from the END, because that is where the rhyme lives and
    because the notepad's endsWith search compares words of different lengths.
    */
    wordPostProcessing(words, heja, ava){
        const seedCounts = heja.map((h, i) => this.syllableConsonantCount(h, ava[i]))
        return words.filter(word => {
            const counts = word.heja.map((h, i) => this.syllableConsonantCount(h, word.ava[i]))
            // k counts back from the end; k = 0 is the last syllable, which is free.
            const shared = Math.min(counts.length, seedCounts.length)
            for(let k = 1; k < shared; k++){
                const mine = counts[counts.length - 1 - k]
                const theirs = seedCounts[seedCounts.length - 1 - k]
                if(mine === null || theirs === null) continue
                if(mine !== theirs) return false
            }
            return true
        })
    }
}

export default new wordManageController();