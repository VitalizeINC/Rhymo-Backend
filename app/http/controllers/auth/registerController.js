const controller = require('app/http/controllers/controller')
const passport = require('passport')
const Ghasedak = require("ghasedak");
let ghasedak = new Ghasedak('c45df13387bdae691b53b2e0d94f92985f0a00154ba5ac5b685bca9d8c5d34d3');


class registerController extends controller{
    constructor(){
        super();
        this.validObject = {};
        this.validArray = [];
        this.smsCode = this.generateSmsCode();
    }
    showRegisterationPage(req,res){
        const title = 'عضویت در سایت'
        console.log(this.recaptcha.render())
        res.render('home/auth/register' , {recaptcha:this.recaptcha.render(),button : this.buttonSituation , title})
           }
        
    sendValidationSMS(req,phoneNumber,sessionID,res){
        for(let i =0; i<this.validArray.length ;i++){
            if(this.validArray[i].id == req.sessionID){
                console.log('please wait!!')
                return
            }     
        }
            this.generateSmsCode(req)
            // ghasedak.send({
            //     message:'کد احراز هویت شما ' + this.smsCode + ' می باشد',
            //     receptor:phoneNumber,
            //     linenumber:10008642,
            // })
            res.status(200).send();
            this.validObject = {
                sms : this.smsCode,
                id :sessionID
            }
            this.saveToArray(this.validObject)
    }
    saveToArray(validObject){
        this.checkDuplicatedVerification(this.validArray,validObject)
        this.validArray.push(validObject)
        this.destroyArray(validObject)
        console.log(this.validArray)
    }
    destroyArray(validObject){
        setTimeout(()=>{
            for(let i =0; i<this.validArray.length ;i++){
                if(this.validArray[i].id == validObject.id){
                    console.log('item deleted')
                    this.validArray.splice(i,1)
                    
                }
                console.log(this.validArray)
            }
        },55000)

    }
    checkDuplicatedVerification(validArray , validObject){
        for(let i =0; i<this.validArray.length ;i++){
         if(this.validArray[i].id == this.validObject.id ){
            this.validArray.splice(i,1)
         } 
        }
        return
    }
    registerProccess(req,res,next){
        this.recaptchaValidator(req,res).then(result => this.validationSmsCode(req).then(result =>  {
            if(result)
            this.validationData(req)
            .then(result => {
                if(result){
                    //res.json('ثبت نام شدید')
                    this.register(req,res,next);
                }
                else{
                    res.redirect('/register')
                }
        })
        else{
            res.redirect('/register')
        }
        }
        )
        )}
    async validationSmsCode(req){
        for(let i =0; i<this.validArray.length ;i++){
            if(this.validArray[i].id == req.sessionID && this.validArray[i].sms == req.body.smsVerify){
                this.validArray.splice(i,1)
                return true
            } 
           }
            req.flash('errors','کد ارسال شده به شماره شما درست وارد نشده است')
            return false
       
}

    register(req,res,next){
        passport.authenticate('local.register',{
            successRedirect:'/',
            failureRedirect:'/register',
            failureFlash:true
        })(req,res,next)
    }
}
module.exports = new registerController();