import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import mongoosePaginate from 'mongoose-paginate-v2';

const userSchema = new Schema({
    name: { type: String, required: true },
    admin: { type: Boolean, default: false },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    tokens: { type: [String], default: [] },
    rememberToken: { type: String, default: null },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    passwordResetCode: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null }
}, { timestamps: true, toJSON: { virtuals: true } });

userSchema.plugin(mongoosePaginate);

userSchema.pre('save', function(next) {
    if (this.isModified('password')) {
        // Check if password is already hashed using a flag
        if (this.passwordEncrypted === true) {
            // Password is already hashed, skip hashing
            this.passwordEncrypted = undefined; // Clear the flag
            next();
        } else {
            // Password is not hashed, hash it
            bcrypt.hash(this.password, bcrypt.genSaltSync(15), (err, hash) => {
                if (err) console.log(err);
                this.password = hash;
                next();
            });
        }
    } else {
        next();
    }
});

userSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    if (update && update.$set && update.$set.password) {
        // Check if password is already hashed using a flag
        if (update.$set.passwordEncrypted === true) {
            // Password is already hashed, skip hashing
            delete update.$set.passwordEncrypted; // Remove the flag
            next();
        } else {
            // Password is not hashed, hash it
            const salt = bcrypt.genSaltSync(15);
            const hash = bcrypt.hashSync(update.$set.password, salt);
            update.$set.password = hash;
            next();
        }
    } else {
        next();
    }
});

userSchema.methods.comparePassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

userSchema.methods.isVip = function() {
    return true;
};

userSchema.methods.hasRole = function(roles) {
    const result = roles.filter(role => {
        return this.roles.indexOf(role) > -1;
    });
    return !!result.length;
};

export default mongoose.model('User', userSchema);