import controller from './controller.js';

class authController extends controller {
    async user(req,res,next){
        res.json(req.user)
    }
}

export default new authController();