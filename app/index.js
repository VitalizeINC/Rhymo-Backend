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
import { requestContext } from './logging/context.js';
import { requestLog } from './logging/requestLog.js';


const app = express();
export default class Application {
    constructor() {
        this.app = app;
        this.server = null;
        this.setupExpress();
        this.setConfig();
        this.setRoutes();
        // After the routes: Express only treats these as the last resort if
        // everything they might catch is already registered.
        this.setErrorHandlers();
        // Initialize MongoDB connection
        this.setMongoConnection().catch(err => {
            console.error('Failed to connect to MongoDB:', err);
            process.exit(1);
        });
    }

    setRoutes() {
        app.use('/api/v1', apiV1Routes);
    }

    /**
     * What happens when a request does not go to plan.
     *
     * Without these, an unknown API path answered with Express's HTML "Cannot
     * POST /api/v1/typo" page, and anything a handler threw became a bare 500
     * with a stack trace in the log and no usable body — which is how the
     * bodyless-POST crash stayed invisible until someone read the log.
     */
    setErrorHandlers() {
        // An unknown path under /api/v1 is still an API call: answer in JSON.
        app.use('/api/v1', (req, res) => {
            res.status(404).json({
                error: 'Not found',
                path: `${req.method} ${req.originalUrl}`,
                requestId: req.id,
            });
        });

        // Last resort. Four arguments is what makes Express treat this as an
        // error handler rather than ordinary middleware — do not drop `next`.
        app.use((err, req, res, next) => {
            const status =
                err.type === 'entity.parse.failed' ? 400 :
                err.type === 'entity.too.large' ? 413 :
                // A bad id in the URL is the caller's mistake, not ours.
                err.name === 'CastError' ? 400 :
                // Data that breaks the schema is bad input, not a crash.
                err.name === 'ValidationError' ? 400 :
                // Unique index hit: the thing already exists.
                err.code === 11000 ? 409 :
                err.status || err.statusCode || 500;

            // The whole error goes to the log, with the request that caused it,
            // so a 500 can be traced without reproducing it.
            console.error(`[${req.method} ${req.originalUrl}] -> ${status}`, err);

            // A response already on its way cannot be replaced; let Express
            // close it rather than throwing "headers already sent" on top.
            if (res.headersSent) return next(err);

            if (status === 400 && err.type === 'entity.parse.failed') {
                return res.status(400).json({ error: 'Invalid JSON body' });
            }
            if (status === 413) {
                return res.status(413).json({ error: 'Request body is too large' });
            }
            if (err.name === 'CastError') {
                return res.status(400).json({ error: `Invalid ${err.path || 'id'}`, requestId: req.id });
            }
            if (err.name === 'ValidationError') {
                return res.status(400).json({
                    error: 'Some of the data is missing or invalid',
                    fields: Object.keys(err.errors || {}),
                    requestId: req.id,
                });
            }
            if (err.code === 11000) {
                return res.status(409).json({
                    error: 'This already exists',
                    fields: Object.keys(err.keyValue || {}),
                    requestId: req.id,
                });
            }
            // Our own 4xx messages are written for the caller and are safe to
            // show. A 5xx message is internal — it stays in the log.
            return res.status(status).json({
                error: status < 500
                    ? (err.message || 'Request could not be handled')
                    : 'Something went wrong on our side',
                requestId: req.id,
            });
        });
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
        // First: every request gets an id and a context; every API response is
        // logged and reported. See app/logging/.
        app.use(requestContext);
        app.use(requestLog);

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

        app.use(cookieParser('v6v7l6c5f!@#'));

    }
}