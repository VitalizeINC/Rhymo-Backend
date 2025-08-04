import controller from './controller.js';
import Word from '../../../models/word.js';

const longVowels = ['آ', 'و', 'ی', 'ا']
const shortVowels = [String.fromCharCode(1614), String.fromCharCode(1615), String.fromCharCode(1616)]



class processController extends controller {
    
    async getWordDetails(req, res, next) {
        let modalTitle = req.body.string
        // let {string, tashdid} = this.stringBootstrap(modalTitle)
        let string = modalTitle
        let stringParts = string.split(' ')
        let totalParts = []
        let totalPhonemes = []
        let result = []
        let pass = true
        
        for (let i = 0; i < stringParts.length; i++) {
            let schema = {
                id: "",
                part: stringParts[i],
                db: false,
                parts: [],
                phonemes: []
            }
            let checkInDB = await Word.findOne({ fullWord: stringParts[i] })
            if (checkInDB) {
                schema.db = true
                schema.id = checkInDB._id
                schema.parts = checkInDB.heja
                schema.phonemes = checkInDB.ava
                totalParts = [...totalParts, ...checkInDB.heja]
                totalPhonemes = [...totalPhonemes, ...checkInDB.ava]
            } else {
                console.log("Not in DB")
                pass = false
                let {string: sPart, tashdid: tashdidPart} = this.stringBootstrap(stringParts[i])
                let processPart = this.process(sPart)
                let wordDetailsPart = Array.isArray(processPart) ? processPart  : [processPart] 
                let phonemesPart = this.phoneme(sPart)
                // Replace y and w with real characters
                wordDetailsPart = wordDetailsPart.map(part => part.replace(/y/g, 'ی').replace(/w/g, 'و'))
                phonemesPart = phonemesPart.map(phoneme => phoneme.replace(/y/g, 'ی').replace(/w/g, 'و'))
                schema.parts = wordDetailsPart
                schema.phonemes = phonemesPart
                totalParts = [...totalParts, ...wordDetailsPart]
                totalPhonemes = [...totalPhonemes, ...phonemesPart]
            }
            result.push(schema)
        }
        let totalId = ""
        if (pass) {
            let fullWordWithNimFaseleh = modalTitle
            let fullWord = modalTitle
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
            fullWord = modalTitle.replace(/\u200C/g, " ")
            let check = await Word.findOne({ fullWord: modalTitle })
            if (!check) {
                
                let word = this.solidWord(modalTitle)
                let newWord = new Word({
                    fullWord: modalTitle,
                    fullWordWithNimFaseleh: fullWordWithNimFaseleh,
                    word,
                    heja: totalParts,
                    avaString: totalPhonemes.join(","),
                    ava: totalPhonemes,
                    hejaCounter: totalPhonemes.length,
                    spacePositions: spacePositions,
                    nimFaselehPositions: nimFaselehPositions
                })
                await newWord.save()
                totalId = newWord._id

            }else{
                totalId = check._id
            }
        }
        return res.status(200).json({
            modalTitle,
            result,
            pass,
            totalId
        })
    }
    phoneme(s) {
        let phonemes = []
        let value = 0
        let ph = this.checkChar(s, value)
        let checkNotA = ''
        do {
            let MosavetKootah
            if (ph.before == String.fromCharCode(1614) || ph.before == String.fromCharCode(1615) || ph.before == String.fromCharCode(1616)) {
                MosavetKootah = ph.before
            }
            if (ph.key == 'ی' && ph.before == 'ی') ph = this.checkChar(s, ph.value + 1)
            checkNotA = Array.isArray(ph.key) ? (ph.key[0] == 'ا' ? ph.key[0] = '' : ph.key[0] = 'ا') : '';
            ph != "" ? (ph.key == String.fromCharCode(1614) && ph.before != 'ا' ? ph.key = 'ا' + String.fromCharCode(1614) : null) : null
            ph != "" ? (ph.key == String.fromCharCode(1615) && ph.before != 'ا' ? ph.key = 'ا' + String.fromCharCode(1615) : null) : null
            ph != "" ? (ph.key == String.fromCharCode(1616) && ph.before != 'ا' ? ph.key = 'ا' + String.fromCharCode(1616) : null) : null
            ph != "" ? (ph.key == 'ی' && ph.before != 'ا' ? ph.key = 'ا' + (MosavetKootah || '') + 'ی' : null) : null
            ph != "" ? (ph.key == 'و' && ph.before != 'ا' ? ph.key = 'ا' + (MosavetKootah || '') + 'و' : null) : null
            ph != "" ? (ph.key == 'ا' ? ph.key = 'آ' : null) : null
            ph ? (ph.before == 'ا' ? phonemes.push(ph.before + checkNotA + ph.key) : phonemes.push(ph.key)) : null
            console.log(ph)
            value = ph.value

            ph = this.checkChar(s, value + 1)
        }
        while (s.length > value)
        if (s[0] == 'آ') {
            phonemes[0] = phonemes[0].replace('ا', 'آ')
        }
        return phonemes

    }
    process(s) {
        let array = []
        let string = s
        let Mosavet1 = this.checkChar(string, 0)
        let Mosavet2 = this.checkChar(string, Mosavet1.value + 1)
        console.log("Mosavet1", Mosavet1)
        console.log("Mosavet2", Mosavet2)
        if (!Mosavet2) return string
            //Part 1
        let heja = string.slice(0, Mosavet2.value - 1)
            // heja[0] == 'ا' ? array.push() : array.push(heja)
        if (heja[0] == 'ا') {
            if (heja[1] && !this.checkNextChar(heja[1], 1, 'ا')) {
                heja = heja.split("")
                heja[0] = 'آ'
                heja = heja.join("")
            } else if (heja == 'ا') {
                heja = 'آ'
            }
        }
        
        array.push(heja)

        //Tekrar
        let pointer = Mosavet1.value
        let lastPointer
        let charAfterMosavet
        
        while (pointer || pointer == 0) {
            Mosavet1 = this.checkChar(string, pointer)
            Mosavet2 = this.checkChar(string, Mosavet1.value + 1)
            heja = string.slice(Mosavet2.value - 1, Mosavet2.value + 1)
            array[0][0] == 'آ' ? null : charAfterMosavet = array[array.length - 1].search(string[Mosavet2.value - 2])
            if (charAfterMosavet == -1) {
                array[array.length - 1] += string[Mosavet2.value - 2]
            }
            
            heja != "" ? array.push(heja) : null

            if (pointer) {

                lastPointer = pointer
            }
            pointer = Mosavet2.value



        }


        if (lastPointer != string.length - 1) {

            while (lastPointer != string.length - 1) {

                array[array.length - 1] += string[lastPointer + 1]
                lastPointer++
            }
        }

        return array

    }



    checkChar(string, counter) {
        for (var i = counter; i < string.length; i++) {
            if (string[i] == 'آ')
                if (this.checkNextChar(string[i + 1], i + 1, string[i])) return this.checkNextChar(string[i + 1], i + 1, string[i]);
                else return { key: 'آ', value: i }
            if (string[i] == 'ا')
                if (this.checkNextChar(string[i + 1], i + 1, string[i])) return this.checkNextChar(string[i + 1], i + 1, string[i]);
                else return { key: 'ا', value: i }
            if (string[i] == 'ی')
                if (string[i - 1] == String.fromCharCode(1618)) return this.checkNextChar(string[i + 1], i + 1, string[i])
                else if (string[i + 1] == String.fromCharCode(1618)) return this.checkNextChar(string[i + 2], i + 2, string[i])
                else if (this.checkNextChar(string[i + 1], i + 1, string[i])) return this.checkNextChar(string[i + 1], i + 1, string[i]);  
                else return { key: 'ی', value: i }
            if (string[i] == 'و')
                if (this.checkNextChar(string[i + 1], i + 1, string[i])) return this.checkNextChar(string[i + 1], i + 1, string[i]);
                else return { key: 'و', value: i }
            if (string[i] == String.fromCharCode(1614))
                return { key: String.fromCharCode(1614), value: i }
            if (string[i] == String.fromCharCode(1615))
                return { key: String.fromCharCode(1615), value: i }
            if (string[i] == String.fromCharCode(1616))
                return { key: String.fromCharCode(1616), value: i }

        }
        return false
    }
    checkNextChar(char, i, before) {
        console.log(char, i, before)
        if (before == 'ا') {
            if (char == String.fromCharCode(1614)) return { key: String.fromCharCode(1614), value: i, before }
            if (char == String.fromCharCode(1615)) return { key: String.fromCharCode(1615), value: i, before }
            if (char == String.fromCharCode(1616)) return { key: String.fromCharCode(1616), value: i, before }
            if (char == 'ی') return { key: 'ی', value: i, before }
        } else if (before == 'آ') {
            if (char == 'ی') return { key: 'ی', value: i, before }
        } else {
            if (char == 'ا') return { key: 'ا', value: i, before }
            if (char == 'ی') return { key: 'ی', value: i, before }
            if (char == 'و') return { key: 'و', value: i, before }
            if (char == String.fromCharCode(1614)) return { key: String.fromCharCode(1614), value: i, before }
            if (char == String.fromCharCode(1615)) return { key: String.fromCharCode(1615), value: i, before }
            if (char == String.fromCharCode(1616)) return { key: String.fromCharCode(1616), value: i, before }
        }
        return false

    }
    stringBootstrap(string) {
        
        // Check Nim Fasele
        for (var i = 0; i < string.length; i++) {
            if (string[i] == String.fromCharCode(0x200C)) {
                string = string.split("")
                string[i] = ' '
                string = string.join("")
            }
        }
        //CheckTashdid
        let tashdid = -1
        for (var i = 0; i < string.length; i++) {
            if (string[i] == String.fromCharCode(1617)) {
                string = string.split("")
                string[i] = string[i - 1]
                string = string.join("")
                tashdid = i
            }
        }
        console.log("Before",string)
        string = this.checkYaAndVav(string)
        
        console.log("After",string)

        return {
            string,
            tashdid
        }
    }
    solidWord(s) {
        let string = s.split(String.fromCharCode(1614)).join("").split(String.fromCharCode(1615)).join("")
            .split(String.fromCharCode(1616)).join("").split(String.fromCharCode(1617)).join("")
        return string
    }
    checkYaAndVav = (s) => {
        let string = s
        for(let i = 0; i < string.length; i++){
            // Check Ya
            // اگر ی اول کلمه باشد نقش صامتی دارد
            if(string[i] == 'ی'){
                if(i == 0) {
                    string = string.split("")
                    string[i] = 'y'
                    string = string.join("")
                    continue
                }
                // اگر ای اول کلمه باشد نقش مصوتی دارد
                if(i == 1 && string[i-1] == 'ا'){
                    continue
                }
                let before = string[i-1]
                const isLongVowel = longVowels.some(vowel => vowel == before)
                const isShortVowel = shortVowels.some(vowel => vowel == before)
                let beforeBefore = string.length > 2 ? string[i-2] : null
                const isBeforeBeforeLongVowel = longVowels.some(vowel => vowel == beforeBefore)
                const isBeforeBeforeShortVowel = shortVowels.some(vowel => vowel == beforeBefore)
                // اگر دو حرف قبل ی مصوت باشد ی تبدیل به دو واج مجزا نمیشه
                const exceptionForYaDuplication = isBeforeBeforeLongVowel || isBeforeBeforeShortVowel
                
                // before not be short vowel or long vowel: Samet
                // اگر ی بین یک صامت و یک مصوّت بلند قرار بگیره، معمولاً در آوا به صورت دو واج مجزا ظاهر می‌شه
                if (!isLongVowel && !isShortVowel && !exceptionForYaDuplication){
                    
                    if (i + 1 < string.length){
                        let after = string[i+1]
                        const isAfterLongVowel = longVowels.some(vowel => vowel == after)
                        if (isAfterLongVowel){
                            string = string.split("")
                            string[i] = 'یy'
                            string = string.join("")
                        }
                    }

                }
                if(!isLongVowel && !isShortVowel && exceptionForYaDuplication){
                    // اگر قبلی صامت بود ولی ی آخرین حرف بود همون مصوت در نظر بگیر
                    if(i == string.length - 1){
                        continue
                    }
                    // اگر قبلی صامت بود ولی مصوت قبل صامت قبلی بود ی در نقش صامت میاد
                    if(exceptionForYaDuplication){
                        string = string.split("")
                        string[i] = 'y'
                        string = string.join("")
                        continue
                    }
                }
                // اگر ی بعد از یک مصوت کوتاه یا بلند باشد نقش صامتی دارد
                if(isLongVowel || isShortVowel){
                    string = string.split("")
                    string[i] = 'y'
                    string = string.join("")
                }
            }
            // Check VAV
            if(string[i] == 'و'){
                // اگر و اول کلمه باشد نقش صامتی دارد
                if (i == 0) {
                    string = string.split("")
                    string[i] = 'w'
                    string = string.join("")
                    continue
                }
                // اگر او اول کلمه باشد نقش مصوتی دارد
                if(i == 1 && string[i-1] == 'ا'){
                    continue
                }
                let before = string[i-1]
                const isLongVowel = longVowels.some(vowel => vowel == before)
                const isShortVowel = shortVowels.some(vowel => vowel == before)
                // اگر و بعد از یک مصوت کوتاه یا بلند باشد نقش صامتی دارد
                if(isLongVowel || isShortVowel){
                    string = string.split("")
                    string[i] = 'w'
                        string = string.join("")
                }
            }
        }
        return string
    }
    
    // checkVav = (s) => {
    //     let string = s
    //     for(let i = 0; i < string.length; i++){
            
    //     }
    //     return string
    // }
    
}

export default new processController();