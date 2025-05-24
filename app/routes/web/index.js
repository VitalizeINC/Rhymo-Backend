const express = require('express')
const router = express.Router();
// Middlewares

const redirectIfAuthenticate = require('app/http/middleware/redirectIfAuthenticate')
const redirectIfNotAdmin = require('app/http/middleware/redirectIfNotAdmin')
const errorHandler = require('app/http/middleware/errorHandler')

// Routes

const adminRouter = (require('./admin'))
router.use('/admin',redirectIfNotAdmin.handle,adminRouter)

const homeRouter = (require('./home'))
router.use('/',homeRouter)

const authRouter = (require('./auth'))
router.use('/auth',redirectIfAuthenticate.handle,authRouter)

// Handle Errors
router.all('*' , errorHandler.error404);
router.use(errorHandler.handler)




module.exports = router