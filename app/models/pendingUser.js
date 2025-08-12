import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';

const pendingUserSchema = new Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    verificationCode: { 
        type: String, 
        required: true 
    },
    verificationExpires: { 
        type: Date, 
        required: true 
    },
    attempts: {
        type: Number,
        default: 0
    },
    lastAttemptAt: {
        type: Date,
        default: Date.now
    }
}, { 
    timestamps: true 
});

// Hash password before saving
pendingUserSchema.pre('save', function(next) {
    if (this.isModified('password')) {
        bcrypt.hash(this.password, bcrypt.genSaltSync(15), (err, hash) => {
            if (err) return next(err);
            this.password = hash;
            next();
        });
    } else {
        next();
    }
});

// Method to check if verification code is expired
pendingUserSchema.methods.isExpired = function() {
    return new Date() > this.verificationExpires;
};

// Method to check if verification code is valid
pendingUserSchema.methods.isValidCode = function(code) {
    return this.verificationCode === code && !this.isExpired();
};

// Method to increment attempts
pendingUserSchema.methods.incrementAttempts = function() {
    this.attempts += 1;
    this.lastAttemptAt = new Date();
    return this.save();
};

// Method to reset attempts
pendingUserSchema.methods.resetAttempts = function() {
    this.attempts = 0;
    this.lastAttemptAt = new Date();
    return this.save();
};

// Method to generate new verification code
pendingUserSchema.methods.generateNewCode = function() {
    this.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    this.attempts = 0;
    this.lastAttemptAt = new Date();
    return this.save();
};

// Static method to create pending user
pendingUserSchema.statics.createPendingUser = async function(email, password, name) {
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return await this.create({
        email: email.toLowerCase(),
        password,
        name,
        verificationCode,
        verificationExpires
    });
};

export default mongoose.model('PendingUser', pendingUserSchema);
