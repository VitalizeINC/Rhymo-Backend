import mongoose from 'mongoose';
import User from '../app/models/user.js';
import config from '../config/index.js';

// Default admin users to be created
const defaultAdmins = [
    {
        name: 'Parsa Hassani',
        email: 'parsa.hassani30@gmail.com',
        password: '123321!@##@!aA',
        admin: true,
        emailVerified: true
    },
    {
        name: 'Noya Shahriari',
        email: 'noyabeatz@gmail.com',
        password: '09352564849aA',
        admin: true,
        emailVerified: true
    }
];

async function seedAdmins() {
    try {
        // Connect to MongoDB
        await mongoose.connect(config.database.url);
        console.log('Connected to MongoDB');

        // Clear existing admin users first to ensure clean recreation
        // for (const adminData of defaultAdmins) {
        //     await User.deleteOne({ email: adminData.email });
        //     console.log(`Cleared existing admin: ${adminData.email}`);
        // }

        // Create or update admin users
        for (const adminData of defaultAdmins) {
            // Check if user already exists
            const existingUser = await User.findOne({ email: adminData.email });
            
            if (existingUser) {
                // User exists, just set admin flag to true
                existingUser.admin = true;
                existingUser.emailVerified = adminData.emailVerified;
                await existingUser.save();
                console.log(`Updated existing user to admin: ${adminData.email}`);
            } else {
                // User doesn't exist, create new admin user
                const newAdmin = new User({
                    name: adminData.name,
                    email: adminData.email,
                    password: adminData.password,
                    admin: adminData.admin,
                    emailVerified: adminData.emailVerified
                });

                // Don't set passwordEncrypted flag - let the pre-save middleware hash the password
                await newAdmin.save();
                console.log(`Created new admin user: ${adminData.email}`);
            }
        }

        console.log('Admin seeding completed successfully');
    } catch (error) {
        console.error('Error seeding admins:', error);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the seeder if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedAdmins();
}

export default seedAdmins;
