import middleware from '../middleware.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';

class AuthenticateApi extends middleware {
    handle(req, res, next) {
        let token = req.query.api_token;
        let user = jwt.verify(token, config.jwt.secret_key);
        if (user && (user.id == 'noya' || user.id == 'faarawn' || user.id == 'amireiy')) {
            return next();
        }
        return console.log('hello');
    }
}

export default new AuthenticateApi();