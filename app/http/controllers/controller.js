const autoBind = require('auto-bind');
const {validationResult} = require('express-validator/check')
var Recaptcha = require('express-recaptcha').RecaptchaV2;
var sprintf = require('sprintf-js').sprintf
const isMongoId = require('validator/lib/isMongoId');

module.exports = class controller {
    constructor(){  
        autoBind(this)
        this.recaptchaConfig();
    }
    generateSmsCode(req){
        return Math.floor(100000 + Math.random() * 900000);
    }    
    error(message , status = 500) {
        let err = new Error(message);
        err.status = status;
        throw err;
    }

    isMongoId(paramId , type) {

        if(! isMongoId(paramId)){
            if(type === 'download'){
                this.error('اینجا از دانلود خبری نیست :)' , 404)
            }
            this.error('ای دی وارد شده صحیح نیست', 404);
        }
            
    }
    recaptchaValidator(req,res){ 
        return new Promise((resolve,reject)=>{
            this.recaptcha.verify(req,(err,data)=>{
                if(err){
                req.flash('errors', 'گزینه ی مربوط به ربات نبودن شما تایید نشده است')
                this.back(req,res)
            }
            else{
                resolve(true);
            }})            
        })
    }
    back(req,res){
        return res.redirect(req.header('Referer') || '/')
    }
    async validationData(req){
        const result = validationResult(req)
        if(! result.isEmpty()){
            const errors = result.array()
            const messages = [];
            errors.forEach(err => messages.push(err.msg));
            req.flash('errors',messages)
            return false
        }
        return true;
    }
    slug(title) {
        return title.replace(/([^۰-۹آ-یa-zA-Z0-9]|-)+/g , "-")
    }
    recaptchaConfig(){
        this.recaptcha = new Recaptcha(
            config.service.recaptcha.client_key,
            config.service.recaptcha.secret_key,
            {...config.service.recaptcha.options}
            )
     
        }
        alert(req,data){
            let title = data.title || ''
            let message = data.message || ''
            let type = data.type || 'info'
            let button = data.button || null
            let timer = data.timer || 2000
            req.flash('sweetalert' , {title,message,type,button,timer})
        }
        alertAndBack(req,res,data){
            let title = data.title || ''
            let message = data.message || ''
            let type = data.type || 'info'
            let button = data.button || null
            let timer = data.timer || 2000
            req.flash('sweetalert' , {title,message,type,button,timer})
            this.back(req,res)
        }

        getTime(episodes) {
            let second = 0;
    
            episodes.forEach(episode => {
                let time = episode.time.split(":");
                if(time.length === 2) {
                    second += parseInt(time[0]) * 60;
                    second += parseInt(time[1]);
                } else if(time.length === 3) {
                    second += parseInt(time[0]) * 3600;
                    second += parseInt(time[1]) * 60;
                    second += parseInt(time[2]);
                }
            });
    
            let minutes = Math.floor(second / 60);
            
            let hours = Math.floor(minutes / 60);
    
            minutes -= hours * 60;
    
            second = Math.floor(( ( second / 60 ) % 1 ) * 60 );
        
            return sprintf('%02d:%02d:%02d' , hours , minutes , second);
        }
}