const express = require('express')
const router = express.Router();
const passport = require('passport')
//Controllers
const loginController = require('app/http/controllers/auth/loginController')
const registerController = require('app/http/controllers/auth/registerController')
const forgotPasswordController = require('app/http/controllers/auth/forgotPasswordController')
const resetPasswordController = require('app/http/controllers/auth/resetPasswordController')

//Middlewares

//Validators
const registerValidator = require('app/http/validator/registerValidator')
const loginValidator = require('app/http/validator/loginValidator')
const forgotPasswordValidator = require('app/http/Validator/forgotPasswordValidator')
const resetPasswordValidator = require('app/http/Validator/resetPasswordValidator')

  
    //Login

router.get('/login'  ,loginController.showLoginPage)
router.post('/login' , loginValidator.handle() , loginController.loginProccess)

    
    //Register

router.get('/register' , registerController.showRegisterationPage)
router.post('/register' , registerValidator.handle() ,registerController.registerProccess)
  
    //forgotPassword

router.get('/password/reset' , forgotPasswordController.showForgotPassword)
router.post('/password/email'  , forgotPasswordValidator.handle() , forgotPasswordController.sendPasswordResetLink)
router.get('/password/reset/:token' , resetPasswordController.showResetPassword)
router.post('/password/reset/' ,resetPasswordValidator.handle(), resetPasswordController.resetPasswordProccess)

    //SmsRegisteration

router.post('/sendSms/:phoneNumber' ,(req,res) => {
     var phoneNumber = req.params.phoneNumber
     var sessionID = req.sessionID
    registerController.sendValidationSMS(req,phoneNumber,sessionID,res)
})

    //Google log-reg
router.get('/google' , passport.authenticate('google',{scope : ['profile','email']}) )
router.get('/google/callback' , passport.authenticate('google' , {successRedirect : '/', failureRedirect: '/register'}))

module.exports = router