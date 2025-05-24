const controller = require('app/http/controllers/controller')
const User = require('app/models/user')
const PasswordReset = require('app/models/password-reset')
const uniqueString = require('unique-string')
const Ghasedak = require("ghasedak");
let ghasedak = new Ghasedak('c45df13387bdae691b53b2e0d94f92985f0a00154ba5ac5b685bca9d8c5d34d3');

class forgotPasswordController extends controller{
    constructor(){
        super();
        this.validArray = [];
    }
    showForgotPassword(req,res){
        const title = 'بازیابی رمز عبور'
        res.render('home/auth/password/sms' , {recaptcha:this.recaptcha.render() , title})
    }
    async sendPasswordResetLink(req,res,next){
        await this.recaptchaValidator(req,res);
        let result = await this.validationData(req);
        if(result){
            return this.sendResetLink(req,res)
        }
        return res.redirect('/auth/password/reset');
    }
    async sendResetLink(req,res){
        let user = await User.findOne({phoneNumber : req.body.phoneNumber})
        if(!user){
            req.flash('errors','کاربری با این شماره موبایل وجود ندارد');
            return this.back(req,res);
        }
        let smsRetCode = this.generateSmsCode(req)
        let tokenCode = uniqueString()
        const newPasswordReset = new PasswordReset({
            phoneNumber:req.body.phoneNumber,
            token:tokenCode,
            smsCode:smsRetCode
        })
        ghasedak.send({
            message:'کد تغییر رمز شما ' + smsRetCode + ' می باشد',
            receptor:req.body.phoneNumber,
            linenumber:10008642,
        })
        let pReset = await newPasswordReset.save()
        req.flash('success','ایمیل بازیابی ارسال شد')
        res.redirect('reset/'+tokenCode)

    }
    saveRetCode(){

    }
    
}
module.exports = new forgotPasswordController();