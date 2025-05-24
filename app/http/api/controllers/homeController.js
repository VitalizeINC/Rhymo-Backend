import controller from './controller.js';

class authController extends controller {
    async user(req,res,next){
        res.json(req.user)
        console.log('hello')
    }
}

export default new authController();