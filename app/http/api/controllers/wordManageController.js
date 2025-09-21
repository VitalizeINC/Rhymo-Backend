import controller from './controller.js';
import Word from '../../../models/word.js';

const longVowels = ['آ', 'و', 'ی', 'ا']
const shortVowels = [String.fromCharCode(1614), String.fromCharCode(1615), String.fromCharCode(1616)]


class wordManageController extends controller {
    async deleteWord(req, res, next) {
        let id = req.query.id
        await Word.deleteOne({_id: id})
        res.status(200).json("Word deleted successfully")
    }
    async updateWordStatus(req, res, next) {
        let id = req.query.id
        let approved = req.body.approved
        await Word.updateOne({_id: id}, {approved: approved, approvedBy: req.body.approvedBy, approvedAt: new Date()})  
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
        let search = new RegExp(`^${req.query.string}`, 'i');
        let words = await Word.find({
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
        let count = await Word.countDocuments({approved: approved, word: {$regex: search, $options: 'i'}})
        let words = await Word.paginate({approved: approved, word: {$regex: search, $options: 'i'}}, { page, sort: { createdAt: -1 }, limit: 25 })
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
                nimFaselehPositions: nimFaselehPositions
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
            hejaCounter: phonemes.length
        })
        await newWord.save();
        res.status(200).json({
            totalId: newWord._id
        })
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
        if (partsNumber < 2){
            return res.status(400).json({
                error: "Parts number must be greater than 1"
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

    async ryhmFinding(w, f, n, professional=true, page=1, limit=10, endsWith="") {
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
        
        // Fetch more words than needed to account for filtering
        // We'll fetch 3x the limit to ensure we have enough after filtering
        let fetchLimit = limit * 10
        let words = []
        if(!endsWith){
            words = await Word.find({ avaString: searchAva, word: searchChar, hejaCounter: rhymeHeja })
            .select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter')
            .limit(fetchLimit);
        }else{
            const rx = new RegExp(`${avaQuery}\\s*$`, 'u');
            console.log("searchFromLastAva", rx)
            words = await Word.find({ avaString:rx, fullWord:endsWithRegex})
            .select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter')
            .limit(fetchLimit);
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
    wordPostProcessing(words, heja, ava){
        let processedWords = []
        for (let i = 0; i < words.length; i++) {
            let word = words[i]
            let isProfessional = true
            for(let j = 0; j < word.heja.length; j++){
                console.log("Checking word is professional rhyme: ", word.word)
                let hejaPart = word.heja[j]
                let lastVaj = hejaPart.split("").pop()
                let incomingHeja = Object.assign([], heja)
                let incomingHejaPart = incomingHeja[j]
                let incomingLastVaj = incomingHejaPart.split("").pop()
                let isLastVajVowel = longVowels.includes(lastVaj) || shortVowels.includes(lastVaj)
                let isIncomingLastVajVowel = longVowels.includes(incomingLastVaj) || shortVowels.includes(incomingLastVaj)
                let bothVowels = isLastVajVowel && isIncomingLastVajVowel || !isLastVajVowel && !isIncomingLastVajVowel
                if(!bothVowels){
                    console.log("Word is not professional")
                    isProfessional = false
                }
            }
            if(isProfessional){
                processedWords.push(word)
            }
        }
        return processedWords
    }
}

export default new wordManageController();