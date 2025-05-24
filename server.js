import dotenv from 'dotenv';
dotenv.config();


import path from 'path';
import { fileURLToPath } from 'url';
import appModulePath from 'app-module-path'
import app from './app/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
appModulePath.addPath(__dirname)

// global.config = require('./config')
import config from './config/index.js'
global.config = config

new app();