// const express = require('express');
// const router = express.Router();

// // Controllers
// // const CourseController = require('app/http/controllers/api/v1/courseController');
// const authController = require('app/http/api/controllers/authController');
// const feeController = require('app/http/api/controllers/feeController');
// const bourseController = require('app/http/api/controllers/bourseController');


// //validator 
// const loginValidator = require('app/http/validator/loginValidator');

import express from 'express';
const router = express.Router();
import authController from '../../../http/api/controllers/authController.js';


router.post('/login', authController.login);


export default router;