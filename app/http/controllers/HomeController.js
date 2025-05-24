const controller = require('./controller')
const Course = require('app/models/course')
const Comment = require('app/models/comment')

class homeController extends controller{
    async index(req,res){
        const title = 'سایت من'
        let courses = await Course.find({}).sort({createdAt:1}).limit(8).exec()
        res.render('home/index' , { title , courses })
    }
    async about(req,res){
        res.render('home/about')
    }
    async comment(req,res,next){
        try {let status = await this.validationData(req);
            if(! status) return this.back(req,res)
            let newComment = new Comment({
                user:req.user.id,
                comment:req.body.comment,
                ...req.body
            })
            await newComment.save()
            return this.back(req,res)
        }catch(err){
            next(err)
        }
    }
}
module.exports = new homeController();