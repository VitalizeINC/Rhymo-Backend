const defaultUrl = 'mongodb://localhost:27017/RHYMO';

console.log("database url",process.env.DATABASE_URL);
export default {
    url: process.env.DATABASE_URL || 'mongodb://localhost:27017/your_database_name'
}