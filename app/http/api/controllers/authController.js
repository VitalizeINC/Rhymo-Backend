import controller from './controller.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';
class authController extends controller {
    async login(req, res, next) {
        console.log(req.body)

        if (req.body.username == 'noya' && req.body.password == "09352564849") {
            const token = jwt.sign({ id: req.body.username }, config.jwt.secret_key, {
                expiresIn: 60 * 60 * 24
            })
            return res.json({
                data: {
                    token
                }
            })
        } else if (req.body.username == 'f4ran' && req.body.password == "09128168983") {
            const token = jwt.sign({ id: req.body.username }, config.jwt.secret_key, {
                expiresIn: 60 * 60 * 24
            })
            return res.json({
                data: {
                    token
                }
            })
        } else {
            return res.status(403).json()
        }

        //create token


    }

}


export default new authController();