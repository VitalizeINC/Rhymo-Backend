const controller = require('app/http/controllers/controller');
const Payment = require('app/models/payment');


class userController extends controller {
    
    async index(req , res , next) {
        try {
            res.render('home/panel/index' ,  {title:'پنل کاربری'})  
        } catch (err) {
            next(err)
        }
        
    }
    async history(req,res,next){
        try {
            let page = req.query.page || 1;
            let payments = await Payment.paginate({user : req.user.id} , {page , sort:{ createdAt : -1} , populate : 'course'} )
            res.render('home/panel/history' ,  {title:'پرداخت ها' , payments})  
        } catch (err) {
            next(err)
        }
    }
}

module.exports = new userController();