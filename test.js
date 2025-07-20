const longVowels = ['آ', 'و', 'ی']
const shortVowels = [String.fromCharCode(1614), String.fromCharCode(1615), String.fromCharCode(1616)]

for(let i = 0; i < string.length; i++){
    if(string[i] == 'و'){
        string = checkVav(string)
    }
    if(string[i] == 'ی'){
        string = checkYa(string)
    }
}
console.log(string)
