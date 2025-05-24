const express = require('express')
const router = express.Router();
const gate = require('app/helpers/gate')

//Controllers
const adminController = require('app/http/controllers/admin/adminController')
const coursesController = require('app/http/controllers/admin/coursesController')
const episodeController = require('app/http/controllers/admin/episodeController');
const commentController = require('app/http/controllers/admin/commentController');
const categoryController = require('app/http/controllers/admin/categoryController');
const userController = require('app/http/controllers/admin/userController');
const permissionController = require('app/http/controllers/admin/permissionController');
const roleController = require('app/http/controllers/admin/roleController');

//Validator
const courseValidator = require('app/http/validator/courseValidator')
const episodeValidator = require('app/http/validator/episodeValidator')
const categoryValidator = require('app/http/validator/categoryValidator')
const registerValidator = require('app/http/validator/registerValidator')
const permissionValidator = require('app/http/validator/permissionValidator')
const roleValidator = require('app/http/validator/roleValidator')

//Helpers
const upload = require('app/helpers/uploadImage')

//Middlewares
const convertFileToField = require('app/http/middleware/convertFileToField')

//MasterPageChange Middleware
router.use((req,res,next)=>{
    res.locals.layout = "admin/master"
    next();
})

//Main Admin Routes
router.get('/' , adminController.index)
router.get('/courses'  , coursesController.index)
//Courses Form Routes
router.get('/courses/create' , coursesController.create)
router.post('/courses/create', upload.single('images') , convertFileToField.handle , courseValidator.handle() , coursesController.store)
router.delete('/courses/:id', coursesController.destroy)
router.get('/courses/:id/edit' , coursesController.edit)
router.put('/courses/:id', upload.single('images') , convertFileToField.handle , courseValidator.handle() , coursesController.update)
// Episode Routes
router.get('/episodes' , episodeController.index);
router.get('/episodes/create' , episodeController.create);
router.post('/episodes/create' , episodeValidator.handle() , episodeController.store );
router.get('/episodes/:id/edit' , episodeController.edit);
router.put('/episodes/:id' , episodeValidator.handle() , episodeController.update );
router.delete('/episodes/:id' , episodeController.destroy);
// Category Routes
router.get('/categories' , categoryController.index);
router.get('/categories/create' , categoryController.create);
router.post('/categories/create' , categoryValidator.handle() , categoryController.store );
router.get('/categories/:id/edit' , categoryController.edit);
router.put('/categories/:id' , categoryValidator.handle() , categoryController.update );
router.delete('/categories/:id' , categoryController.destroy);
//Comments Routes
router.get('/comments' , commentController.index)
router.get('/comments/approved' , commentController.approved)
router.put('/comments/:id/approved' , commentController.update );
router.delete('/comments/:id' , commentController.destroy);
//Upload ckeditor
router.post('/upload-image' , upload.single('upload') , adminController.uploadImage)
//Users Routes
router.get('/users' , userController.index);
router.get('/users/create' , userController.create);
router.post('/users/create' , registerValidator.handle() ,userController.store );
router.get('/users/:id/toggleadmin' , userController.toggleadmin);
router.put('/users/:id' , userController.update );
router.delete('/users/:id' , userController.destroy);
//Permissions Routes
router.get('/users/permissions' , permissionController.index);
router.get('/users/permissions/create' , permissionController.create);
router.post('/users/permissions/create' , permissionValidator.handle() , permissionController.store );
router.get('/users/permissions/:id/edit' , permissionController.edit);
router.put('/users/permissions/:id' , permissionValidator.handle() , permissionController.update );
router.delete('/users/permissions/:id' , permissionController.destroy);
//Roles Routes
router.get('/users/roles' , roleController.index);
router.get('/users/roles/create' , roleController.create);
router.post('/users/roles/create' , roleValidator.handle() , roleController.store );
router.get('/users/roles/:id/edit' , roleController.edit);
router.put('/users/roles/:id' , roleValidator.handle() , roleController.update );
router.delete('/users/roles/:id' , roleController.destroy);
router.get('/users/:id/addrole' , userController.addRole);
router.put('/users/:id/addrole' , userController.storeRoleForUser);

module.exports = router