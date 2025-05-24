const express = require('express')
const router = express.Router();
//Controllers
const homeController = require('app/http/controllers/HomeController')
const courseController = require('app/http/controllers/courseController')
const userController = require('app/http/controllers/userController')
//Validators
const commentValidator = require('app/http/validator/commentValidator')

//Middlewares
const redirectIfNotAuthenticate = require('app/http/middleware/redirectIfNotAuthenticate')

//Home Routes
router.get('/' , homeController.index)
router.get('/about' , homeController.about)
router.post('/comment' ,redirectIfNotAuthenticate.handle, commentValidator.handle() ,homeController.comment)
    //Courses
router.get('/courses' , courseController.index)
router.post('/courses/payment' , redirectIfNotAuthenticate.handle , courseController.payment)
router.get('/courses/payment/checker' , redirectIfNotAuthenticate.handle , courseController.checker)
router.get('/courses/:course' , courseController.single)
router.get('/download/:episode' , courseController.download)
    //UserPanels
router.get('/user/panel',redirectIfNotAuthenticate.handle, userController.index)
router.get('/user/panel/history',redirectIfNotAuthenticate.handle, userController.history)
    //Logout

router.get('/logout' , (req,res)=>{
    req.logOut();
    res.clearCookie('remember_token')
    res.redirect('/')
})
    

module.exports = router