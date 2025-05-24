
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';



export default {
    secret:'xxx',
    resave:true,
store: MongoStore.create({
    mongoUrl: 'mongodb://localhost:27017/RHYMO', // replace with your connection string
  }),
    saveUninitialized:true,
}