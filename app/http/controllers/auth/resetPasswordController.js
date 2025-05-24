const controller = require('app/http/controllers/controller')
const User = require('app/models/user')
const PasswordReset = require('app/models/password-reset')

class resetPasswordController extends controller{
    showResetPassword(req,res){
        const title = 'رمز عبور جدید'
        const token = req.params.token
        res.render('home/auth/password/reset' , {recaptcha:this.recaptcha.render() , token , title })
    }
    async resetPasswordProccess(req,res,next){
        await this.recaptchaValidator(req,res);
        let result = await this.validationData(req);
        if(result){
            return this.resetPassword(req,res)
        }
        return res.redirect('/auth/password/reset/' + req.body.token)
    }
    async resetPassword(req,res){
        let field = await PasswordReset.findOne(
            { $and : [{phoneNumber : req.body.phoneNumber},
            {token : req.body.token},{smsCode:req.body.smsRet}] })

            if(!field){
            req.flash('errors','اطلاعات وارد شده صحیح نیست')
            return this.back(req,res)
        }
        if(field.use){
            req.flash('errors', 'این لینک برای تغییر پسورد قبلا استفاده شده است')
            return this.back(req,res)
        }
        let user = await User.findOneAndUpdate({ phoneNumber: field.phoneNumber} , {$set : {
            password : req.body.password
        }})
        if(!user){
            req.flash('errors', 'عملیات تغییر رمز انجام نشد')
            return this.back(req,res);
        }
        await field.update({use:true})
        return res.redirect('/auth/login')
    }
   
}
module.exports = new resetPasswordController();