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
            let solidWordPart = this.solidWord(newWordParts[i].part)
            let newWordPart = new Word({
                fullWord: newWordParts[i].part,
                word: solidWordPart,
                heja: newWordParts[i].parts,
                avaString: newWordParts[i].phonemes.join(","),
                ava: newWordParts[i].phonemes,
                hejaCounter: newWordParts[i].phonemes.length
            })
            await newWordPart.save();
            wordDetails = [...wordDetails, ...newWordParts[i].parts]
            phonemes = [...phonemes, ...newWordParts[i].phonemes]
        }
        let fullWord = req.body.s;
        let check = await Word.findOne({ fullWord })
        if (check) {
            return res.status(200).json({
                totalId: check._id
            })
        }
        console.log(wordDetails)
        console.log(phonemes)
        let word = this.solidWord(fullWord);
        let newWord = new Word({
            fullWord,
            word,
            heja: wordDetails,
            avaString: phonemes.join(","),
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
    async getRhymes(req, res, next) {
        let filter = req.query.filter
        let word = await Word.findById(req.query.id)
        let response = await this.ryhmFinding(word, filter)
        res.status(200).json({
            selectedWord: await Word.findById(req.query.id),
            response
        })
    }
    async ryhmFinding(w, f) {
        let rhymeHeja = 2
        let filterChar = []
        f.split(",").map(x =>
            filterChar.push(`(?=.*${x})`)
        )
        let filterAva = []
        w.ava.map(y =>
            filterAva.push(`${y}`)
        )

        let searchChar = new RegExp(filterChar.join(""), 'gi');
        // let avaString = w.ava.splice(0, 1).join(',')
        console.log(filterChar)
        let searchAva = new RegExp(filterAva.splice(filterAva.length - rhymeHeja, filterAva.length - 1).join(","));
        console.log(searchAva)

        let words = await Word.find({ avaString: searchAva, word: searchChar }).select('ava avaString word fullWord heja hejaCounter');
       
        let Ids = []
        let response = []
        let fullResponse = []
        let highlight = []
        let tedadHeja = []
        let rhymeAva = []
        let heja = []
        let ids = []
        let avaOfRhyme = w.ava.splice(w.ava.length - rhymeHeja, w.ava.length)
        for(let i = 0; i < words.length; i++){
            response.push(words[i].word)
            fullResponse.push(words[i].fullWord)
            heja.push(words[i].heja)
            ids.push(words[i]._id)
            tedadHeja.push(rhymeHeja)
            rhymeAva.push(words[i].avaString)
            // find same ava in word's avaString
            const startIndex = findSubsequenceIndex(words[i].ava, avaOfRhyme);
            const lastIndex = startIndex + rhymeHeja
            // // find ava's heja in word
            let sentenceFromHejaWithSpace = words[i].heja.slice(startIndex,lastIndex).join(" ")
            let sentenceFromHejaWithoutSpace = words[i].heja.slice(startIndex,lastIndex).join("")
            // // find heja index in word
            let hejaIndexInWord = words[i].fullWord.indexOf(sentenceFromHejaWithoutSpace)
            let hejaIndexInWordEnd = hejaIndexInWord + sentenceFromHejaWithoutSpace.length - 1
            if(hejaIndexInWord == -1){
                hejaIndexInWord = words[i].fullWord.indexOf(sentenceFromHejaWithSpace)
                hejaIndexInWordEnd = hejaIndexInWord + sentenceFromHejaWithSpace.length - 1
            }
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
            ryhmes: response,
            number: tedadHeja,
            fullResponse,
            rhymeAva,
            heja,
            ids,
            highlight

        }
    }
}

export default new wordManageController();