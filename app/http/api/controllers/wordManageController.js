import controller from './controller.js';
import Word from '../../../models/word.js';
class wordManageController extends controller {
    async suggestWord(req, res, next) {
        let search = new RegExp(`^${req.query.string}`, 'i');
        let words = await Word.find({
            $and: [
                { word: search },
                { word: { $not: /\s/ } }
            ]
        }).limit(10)
        res.status(200).json(words)
    }

    async getWord(req, res, next) {
        let page = req.query.page || 1
        let words = await Word.paginate({}, { page, sort: { createdAt: -1 }, limit: 10 })
        res.status(200).json({ words: words })
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
        let fullWord = req.body.s;
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
    async getPartsNumber(req, res, next) {
        let filter = req.query.filter
        let id = req.query.id
        let mainWord = await Word.findById(id)
        console.log("mainWord", mainWord)
        let result = []
        let mostHejaRhyme = {}
        // Reverse loop from most heja to least heja
        for(let i = mainWord.hejaCounter; i > 1; i--){
            console.log("i", i)
            let word = await Word.findById(id)
            let response = await this.ryhmFinding(word, filter, i)
            if (i == mainWord.hejaCounter - 1) {
                mostHejaRhyme = response
            }
            response?.rhymes?.length > 0 ? result.push(i) : null
        }

        res.status(200).json({
            numbers: result,
            selectedWord: mainWord,
            mostHejaRhyme: mostHejaRhyme

        })
    }
    async getRhymes(req, res, next) {
        let filter = req.query.filter
        let word = await Word.findById(req.query.id)
        let partsNumber = req.query.partsNumber || 2
        console.log("partsNumber", partsNumber)
        let response = await this.ryhmFinding(word, filter, partsNumber)
        res.status(200).json(response)
    }
    async ryhmFinding(w, f, n) {
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
        let backupFilterAva = Object.assign([], filterAva)

        let searchChar = new RegExp(filterChar.join(""), 'gi');
        // let avaString = w.ava.splice(0, 1).join(',')
        // console.log(filterChar)
        let avaQuery = filterAva.slice(filterAva.length - rhymeHeja, filterAva.length).join(",")
        // console.log("searchAva", rhymeHeja, filterAva.length - rhymeHeja, filterAva.length, avaQuery)
        
        let searchAva = new RegExp(avaQuery);

        console.log("searchAva", searchAva)
        let words = await Word.find({ avaString: searchAva, word: searchChar }).select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter');
        // Remove words with more than rhymeHeja from result
        console.log("rhymeHeja", rhymeHeja, backupFilterAva.length)
        for(let i = rhymeHeja; i <= backupFilterAva.length; i++){
            let newFilterAva = Object.assign([], backupFilterAva)
            let newSearchAva = new RegExp(newFilterAva.splice( newFilterAva.length - (i + 1) , newFilterAva.length ).join(","));
            // console.log("newSearchAva", newSearchAva)
            let removeList = await Word.find({ avaString: newSearchAva, word: searchChar }).select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter');
            for(let j = 0; j < removeList.length; j++){
                words = words.filter(word => {
                    return word.id !== removeList[j].id
                })
            }
        }
        console.log("words", words)
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


        return {
            rhymes: response,
            fullResponse,
            rhymeAva,
            heja,
            ids,
            highlight

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
}

export default new wordManageController();