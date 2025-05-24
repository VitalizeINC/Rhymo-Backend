import controller from './controller.js';
import Word from '../../../models/word.js';
class wordManageController extends controller {
    async suggestWord(req, res, next) {
        let search = new RegExp(req.query.string, 'gi');
        let words = await Word.find({ word: search }).limit(5)
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
    async saveWord(req, res, next) {
        let fullWord = req.body.word.s;
        let check = await Word.findOne({ fullWord })
        if (check) return res.status(409).json('این کلمه در پایگاه داده وجود دارد')
        let word = this.solidWord(fullWord);

        let newWord = new Word({
            fullWord,
            word,
            heja: req.body.word.wordDetails,
            avaString: req.body.word.phonemes.join(","),
            ava: req.body.word.phonemes,
            hejaCounter: req.body.word.phonemes.length
        })
        let newWordParts = fullWord.split(' ')
        for (let i = 0; i < newWordParts.length; i++) {
            let check = await Word.findOne({ fullWord: newWordParts[i] })
            if (check) continue
            let solidWordPart = this.solidWord(newWordParts[i])
            let newWordPart = new Word({
                fullWord: newWordParts[i],
                word: solidWordPart,
                heja: req.body.word.wordDetailsParts[i],
                avaString: req.body.word.phonemesParts[i].join(","),
                ava: req.body.word.phonemesParts[i],
                hejaCounter: req.body.word.phonemesParts[i].length
            })
            await newWordPart.save();
        }
        await newWord.save();
        let resMessage = `${word} با موفقیت ذخیره شد` + "\n" + newWordParts.map(part => `${part} با موفقیت ذخیره شد`).join('\n')
        res.status(200).json(resMessage)
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
        let ryhmeAva = []
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
                        ryhmeAva.push(avaa)
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
            ryhmeAva,
            heja,
            start: first,
            end: last,
            ids

        }
    }
}

export default new wordManageController();