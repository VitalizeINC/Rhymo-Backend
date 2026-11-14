import express from 'express';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });
import cors from 'cors';
import http from 'http';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import apiV1Routes from './routes/api/v1/index.js';
import config from '../config/index.js';


const app = express();
export default class Application {
    constructor() {
        this.app = app;
        this.server = null;
        this.setupExpress();
        this.setConfig();
        this.setRoutes();
        // Initialize MongoDB connection
        this.setMongoConnection().catch(err => {
            console.error('Failed to connect to MongoDB:', err);
            process.exit(1);
        });
    }

    setRoutes() {
        app.use('/api/v1', apiV1Routes);
    }

    async setMongoConnection() {
        try {
            mongoose.Promise = global.Promise;
            const dbUrl = process.env.DATABASE_URL  // This will now get the current value
            console.log("dbUrl",dbUrl)
            await mongoose.connect(dbUrl);
            console.log('Database is connected to:', dbUrl);
        } catch (error) {
            console.error('Database connection error:', error);
            process.exit(1);
        }
    }

    setupExpress() {
        app.use(cors());
        this.server = http.createServer(app);
        const port = config.port || 3500;
        this.server.listen(port, () => console.log(`Listening on port ${port}`));
    }

    setConfig() {
        
        app.use(express.static(config.layout.view_dir));
        app.use(express.static(config.layout.public_dir, { extensions: ['html'] }));
        app.set('views', config.layout.view_dir);
        app.set("layout extractScripts", true);
        app.set("layout extractStyles", true);
        app.set("layout", "home/master");
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));

        // Express 4 gave handlers an empty object when a request carried no body;
        // Express 5 leaves req.body undefined. Every handler that starts with
        // `const { x } = req.body` — 22 of them — therefore threw a TypeError and
        // answered 500 on a bodyless POST, where it should say 400. Restoring the
        // old default fixes them all at once, and keeps their own validation as
        // the thing that decides what a missing field means.
        app.use((req, res, next) => {
            if (req.body === undefined) req.body = {};
            next();
        });

        // Malformed JSON is the caller's mistake, not ours: answer 400 rather
        // than letting it fall through to a 500.
        app.use((err, req, res, next) => {
            if (err && err.type === 'entity.parse.failed') {
                return res.status(400).json({ error: 'Invalid JSON body' });
            }
            return next(err);
        });
        app.use(cookieParser('v6v7l6c5f!@#'));

        // Temporary: log what the app actually asks for, to tell a wrong
        // request apart from a wrong answer. Set DEBUG_REQUESTS=1 to enable.
        if (process.env.DEBUG_REQUESTS === '1') {
            app.use((req, res, next) => {
                console.log(`[req] ${req.method} ${req.originalUrl}`);
                next();
            });
        }
    }
}