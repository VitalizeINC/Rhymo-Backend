import controller from './controller.js';

class processController extends controller {

    async getWordDetails(req, res, next) {
        let string = this.stringBootstrap(req.body.string)
        let wordDetails = this.process(string)
        let phonemes = this.phoneme(string)
        let stringParts = string.split(' ')
        let wordDetailsParts = []
        let phonemesParts = []
        for (let i = 0; i < stringParts.length; i++) {
            let sPart = this.stringBootstrap(stringParts[i])
            let processPart = this.process(sPart)
            let wordDetailsPart = Array.isArray(processPart) ? processPart  : [processPart] 
            let phonemesPart = this.phoneme(sPart)
            wordDetailsParts.push(wordDetailsPart)
            phonemesParts.push(phonemesPart)
        }
        return res.status(200).json({
            wordDetails,
            phonemes,
            s: req.body.string,
            stringParts,
            wordDetailsParts,
            phonemesParts
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
            checkNotA = Array.isArray(ph.key) ? (ph.key[0] == 'ا' ? ph.key[0] = '' : ph.key[0] = 'ا') : '';
            ph != "" ? (ph.key == String.fromCharCode(1614) && ph.before != 'ا' ? ph.key = 'ا' + String.fromCharCode(1614) : null) : null
            ph != "" ? (ph.key == String.fromCharCode(1615) && ph.before != 'ا' ? ph.key = 'ا' + String.fromCharCode(1615) : null) : null
            ph != "" ? (ph.key == String.fromCharCode(1616) && ph.before != 'ا' ? ph.key = 'ا' + String.fromCharCode(1616) : null) : null
            ph != "" ? (ph.key == 'ی' && ph.before != 'ا' ? ph.key = 'ا' + (MosavetKootah || '') + 'ی' : null) : null
            ph != "" ? (ph.key == 'و' && ph.before != 'ا' ? ph.key = 'ا' + (MosavetKootah || '') + 'و' : null) : null
            ph != "" ? (ph.key == 'ا' ? ph.key = 'آ' : null) : null
            ph ? (ph.before == 'ا' ? phonemes.push(ph.before + checkNotA + ph.key) : phonemes.push(ph.key)) : null

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
                if (this.checkNextChar(string[i + 1], i + 1, string[i])) return this.checkNextChar(string[i + 1], i + 1, string[i]);
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
        //convertA
        // if (string[0] == 'آ') {
        //     string = string.replace('آ', 'ا')
        // }
        //CheckTashdid
        for (var i = 0; i < string.length; i++) {
            if (string[i] == String.fromCharCode(1617)) {
                string = string.split("")
                string[i] = string[i - 1]
                string = string.join("")
            }
        }
        //CheckYa
        let nextChar
        for (var i = 0; i < string.length; i++) {
            nextChar = this.checkNextChar(string[i + 1], i + 1, string[i])
                //Age vav bood badisham check kon 
            nextChar.key == 'و' ? (this.checkNextChar(string[nextChar.value + 1], nextChar.value, nextChar.key) ? nextChar = false : '') : ''
            if (string[i] == 'ی' && string[i - 1] != 'ا' && i != 0 && string[i - 1] != 'ی' && string[i + 1] != 'ی' && nextChar) {
                if (string[i - 1] == 'و') {

                    string = string.split("")
                    string[i] = String.fromCharCode(1618) + 'ی'
                    string = string.join("")
                    return string
                }
                string = string.split("")
                string[i] = 'یْی'
                string = string.join("")
                return string
            }

            //

        }
        return string
    }
}

export default new processController();