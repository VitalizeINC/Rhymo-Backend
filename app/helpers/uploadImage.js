const multer = require('multer')
const mkdirp = require('mkdirp')
const fs = require('fs')

const getDirectoryImage = () => {
    let year = new Date().getFullYear()
    let month = new Date().getMonth() + 1
    let day = new Date().getDate()
    return `./public/uploads/images/${year}/${month}/${day}`
}

const ImageStorage = multer.diskStorage({
    destination:(req,file,cb)=>{        
        let path = getDirectoryImage()
        mkdirp(path,(err)=>{
        cb(null,path)
        })
        
        
    },
    filename:(req,file,cb)=>{
        let filePath = getDirectoryImage() + '/' + file.originalname
        if(!fs.existsSync(filePath))
            cb(null,file.originalname);
        else{
            cb(null,Date.now() + '-' + file.originalname)
        }
    },
    limits:{
        fileSize: 1024 * 1024 * 10
    }

    
})



const uploadImage = multer({
    storage:ImageStorage
})

module.exports = uploadImage;