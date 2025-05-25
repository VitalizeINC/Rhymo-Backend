import mongoose from "mongoose"
import Word from "./app/models/word.js"

mongoose.connect("mongodb://127.0.0.1:27017/RHYMO")

async function migrate(){
    let words = await Word.find({})
    console.log(words.length)
    for(let i = 0; i < words.length; i++){
        console.log(i)
        let word = words[i].fullWord
        let spacePositions = []
        for(let j = 0; j < word.length; j++){
            if(word[j] == " "){
                spacePositions.push(j)
            }
        }
        words[i].spacePositions = spacePositions
        await words[i].save()
    }
}

migrate().then(() => {
    console.log("Migration completed")
})
