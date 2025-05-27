import mongoose from "mongoose"
import Word from "./app/models/word.js"

mongoose.connect("mongodb://127.0.0.1:27017/RHYMO")

// async function migrate(){
//     let words = await Word.find({})
//     console.log(words.length)
//     for(let i = 0; i < words.length; i++){
//         console.log(i)
//         let word = words[i].fullWord
//         let spacePositions = []
//         for(let j = 0; j < word.length; j++){
//             if(word[j] == " "){
//                 spacePositions.push(j)
//             }
//         }
//         words[i].spacePositions = spacePositions
//         await words[i].save()
//     }
// }

// migrate().then(() => {
//     console.log("Migration completed")
// })


// async function migrateNimFaseleh(){
//     let words = await Word.find({})
//     for(let i = 0; i < words.length; i++){
//         let word = words[i].fullWord
//         let nimFaselehPositions = []
//         for(let j = 0; j < word.length; j++){
//             if(word[j] == String.fromCharCode(0x200C)){
//                 nimFaselehPositions.push(j)
//             }
//         }
//         words[i].nimFaselehPositions = nimFaselehPositions
//         words[i].fullWord = words[i].fullWord.replace(String.fromCharCode(0x200C), " ")
//         await words[i].save()
//     }
// }

// migrateNimFaseleh().then(() => {
//     console.log("Migration completed")
// })


async function migrateFullWordWithNimFaseleh(){
    let words = await Word.find({})
    for(let i = 0; i < words.length; i++){
        words[i].fullWordWithNimFaseleh = words[i].fullWord
        await words[i].save()
    }
}

migrateFullWordWithNimFaseleh().then(() => {
    console.log("Migration completed")
})