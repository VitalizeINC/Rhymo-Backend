import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
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
        app.use(express.static(config.layout.public_dir));
        app.set('views', config.layout.view_dir);
        app.set("layout extractScripts", true);
        app.set("layout extractStyles", true);
        app.set("layout", "home/master");
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(cookieParser('v6v7l6c5f!@#'));
    }
}