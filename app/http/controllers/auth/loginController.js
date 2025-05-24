const controller = require('app/http/controllers/controller')
const passport = require('passport')

class loginController extends controller{
    showLoginPage(req,res){
        const title = 'ورود به سایت'
        res.render('home/auth/login' , { recaptcha:this.recaptcha.render() , title})
    }
    loginProccess(req,res,next){
        this.recaptchaValidator(req,res).then(result => this.validationData(req).then(result =>{
            if(result){
                // res.json('وارد شدید')
                this.login(req,res,next)
            }else{
                req.flash('formData' , req.body)
                res.redirect('/auth/login')
            }
        }))
    }
   
    login(req,res,next){
            passport.authenticate('local.login', (err,user) => {
            if(!user) return res.redirect('/auth/login');
    
            req.logIn( user,err => {
                if(req.body.remember){
                    user.setRememberToken(res);
                }
                return res.redirect('/')
            })

        })(req,res,next)
    }
}
module.exports = new loginController();