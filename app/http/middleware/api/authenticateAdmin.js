import middleware from '../middleware.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';

class AuthenticateAdmin extends middleware {
    handle(req, res, next) {
        let token = req.headers.authorization;
        if(!token){
            return res.status(401).json("Unauthorized")
        }
        token = token.split(" ")[1]
        let user = jwt.verify(token, config.jwt.secret_key);
        console.log(user, "user",user.admin)
        if (user && user.admin === true) {
            req.user = user;
            return next();
        }
        return res.status(401).json("Unauthorized")
    }
}

export default new AuthenticateAdmin();