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
                wordDetails = [...wordDetails, ...check.heja]
                phonemes = [...phonemes, ...check.ava]
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
        console.log(response)
        res.status(200).json({
            selectedWord: word,
            response
        })
    }
    async ryhmFinding(w, f) {
        let filterChar = []
        f.split(",").map(x =>
            filterChar.push(`(?=.*${x})`)
        )
        let filterAva = []
        w.ava.map(y =>
            filterAva.push(`(?=.*${y})`)
        )

        let searchChar = new RegExp(filterChar.join(""), 'gi');
        // let avaString = w.ava.splice(0, 1).join(',')
        console.log(filterChar)
        let searchAva = new RegExp(filterAva.splice(filterAva.length - 2, filterAva.length - 1).join(""), 'gi');
        console.log(searchAva)

        let words = await Word.find({ avaString: searchAva, word: searchChar }).select('ava word fullWord heja');
        let rhymes = []
        let Ids = []
            // console.log(words)
        let length = w.ava.length
        let avas = []
        let ava = w.ava.join("-")
        for (var i = 0; i < words.length; i++) {
            avas.push(words[i].ava.join("-"))
            Ids.push(words[i]._id)
        }
        let response = []
        let fullResponse = []
        let first = []
        let last = []
        let tedadHeja = []
        let rhymeAva = []
        let heja = []
        let ids = []
        //Ava ha amadast

        //HamHeja
        // let pointer = 0;
        // while (pointer < avas.length) {
        //     let value = avas.indexOf(ava, pointer)
        //     value != -1 ? rhymes.push({ 'id': Ids[value], 'hejaCounter': w.hejaCounter }) : pointer = avas.length
        //     if (value != -1) {
        //         // avas.splice(value, 1)
        //         // Ids.splice(value, 1)
        //         // pointer = value - 1
        //         pointer = value
        //     }
        //     pointer++
        // }

        //Kamtar 
        let flag = true
        var j = 1
        let avaa = ava.split("-")
        while (flag) {
            avaa = avaa.join("-")
            for (var i = 0; i < avas.length; i++) {
                let rhyme = avas[i].match(avaa)
                if (rhyme) {

                    if (!response.includes(words[i].word)) {
                        rhymeAva.push(avaa)
                        let rest = rhyme.input
                        let ezafeAvval = null
                        let afterRhyme = null
                            //Ezafe az avallaro bar midarim
                        if (rhyme.index != 0) {
                            let preRhyme = rhyme.input
                            ezafeAvval = preRhyme.slice(0, rhyme.index).split("-")
                            rest = preRhyme.slice(rhyme.index, rhyme.input.length)
                            if (ezafeAvval[ezafeAvval.length - 1] == "")
                                ezafeAvval = ezafeAvval.splice(ezafeAvval.length - 2, 1)
                        }

                        //Ezafe az akhararo bar midarim
                        if (avaa != rest) {
                            let splitedAva = avaa.split("-")
                            afterRhyme = rest.split("-").slice(splitedAva.length, rest.split("-").length)

                        }

                        response.push(words[i].word);
                        fullResponse.push(words[i].fullWord)
                        heja.push(words[i].heja)
                        ids.push(words[i]._id)
                        tedadHeja.push(avaa.split("-").length);
                        ezafeAvval ? first.push(ezafeAvval.length) : first.push(null)
                        afterRhyme ? last.push(afterRhyme.length) : last.push(null)

                    }
                }


            }
            avaa = avaa.split("-")
            avaa = avaa.splice(j, avaa.length)
            if (avaa.length < 2)
                flag = false;

            j++



        }

        return {
            ryhmes: response,
            number: tedadHeja,
            fullResponse,
            rhymeAva,
            heja,
            start: first,
            end: last,
            ids

        }
    }
}

export default new wordManageController();