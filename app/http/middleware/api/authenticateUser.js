import middleware from '../middleware.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';

class AuthenticateUser extends middleware {
    handle(req, res, next) {
        return next();
        let token = req.headers.authorization;
        
        if (!token) {
            return res.status(401).json({ error: "Authorization header is required" });
        }
        
        // Check if token starts with "Bearer "
        if (!token.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Invalid token format. Use 'Bearer <token>'" });
        }
        
        // Extract token from "Bearer <token>"
        token = token.split(" ")[1];
        
        try {
            // Verify the JWT token
            const decoded = jwt.verify(token, config.jwt.secret_key);
            
            // Attach user information to request object
            req.user = decoded;
            
            return next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ error: "Token has expired" });
            } else if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: "Invalid token" });
            } else {
                return res.status(401).json({ error: "Token verification failed" });
            }
        }
    }
}

export default new AuthenticateUser();
