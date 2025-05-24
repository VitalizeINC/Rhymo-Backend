const controller = require('app/http/controllers/controller')
const Course = require('app/models/course')
const Category = require('app/models/category')
const fs = require('fs')
const sharp = require('sharp')
const path = require('path')

class coursesController extends controller {
    async index(req,res){
        let page = req.query.page || 1
        let courses = await Course.paginate({} , {page ,sort:{createdAt : 1} ,limit:2})
        res.render('admin/courses/index' , {courses})
    }
    async create(req,res){
        let categories = await Category.find({})
        res.render('admin/courses/create',{categories})
    }

    async destroy(req,res){
        let course = await Course.findById(req.params.id)
        if(!course){
            return res.json('دوره مورد نظر یافت نشد')
        }
        //delete episodes
        //delete images 
        Object.values(course.images).forEach(image => fs.unlinkSync(`./public${image}`))
        //delete imagesArchive
        //delete course
        course.remove();
    return res.redirect('/admin/courses')
    }

    async edit(req,res){
        let course = await Course.findById(req.params.id)
        if(!course){
            return res.json('چنین دوره  ای وجود دارد')
        }
        let categories = await Category.find({})
        return res.render('admin/courses/edit',{course , categories})
    }
    async update(req,res){
        let status =  await this.validationData(req);
        if(!status) {
                if(req.file){
                    fs.unlink(req.file.path , (err)=>{})
                }
            req.flash('formData',req.body)
            return this.back(req,res)
        }
        let objForUpdate = {}
        //Set image thumb
        objForUpdate.thumb = req.body.imagesThumb //radio button in view
        //If image exists
        let preImages = {}
        let course =  await Course.findById(req.params.id)
        if(req.file){
            objForUpdate.images = this.imageResize(req.file)
            objForUpdate.thumb = objForUpdate[480]
            preImages = course.images
            
        }
        //Update Course
        delete req.body.images
        objForUpdate.slug = this.slug(req.body.title)
        await Course.findByIdAndUpdate(req.params.id,{$set:{...req.body,...objForUpdate},$push:{imagesArchive : preImages}})
        //Redirect
        res.redirect('/admin/courses')
    }

    async store(req,res){
        let status =  await this.validationData(req);
        if(!status) {
                if(req.file){
                    fs.unlink(req.file.path , (err)=>{})
                }
            req.flash('formData',req.body)
            return this.back(req,res)
        }
        let images = this.imageResize(req.file)
     
        let{title,body,type,price,tags} = req.body
        let newCourse = new Course({
            user : req.user._id,
            title,
            slug:this.slug(title),
            body,
            type,
            tags,
            price,
            images,
            thumb:images[480]
        })
        
        await newCourse.save()
        res.redirect("/admin/courses")
    }
    
    imageResize(image){
        const imageInfo = path.parse(image.path)
        let addressImages = {}
        addressImages['original'] = this.getUrlImage(image.destination , image.filename)
        const resize = size =>{
            let imageName = `${imageInfo.name}-${size}${imageInfo.ext}`
            sharp(image.path)
            .resize(null,size).toFile(`${image.destination}/${imageName}`)
            addressImages[size]=this.getUrlImage(image.destination,imageName)
        }
        [1080,720,480].map(resize)
        return addressImages
    }
    getUrlImage(dir,name){
        return dir.substring(8) + '/' + name
    }

}
module.exports = new coursesController();