import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import mongoosePaginate from 'mongoose-paginate-v2';

const userSchema = new Schema({
    name: { type: String, required: true },
    admin: { type: Boolean, default: 0 },
    email: { type: String, required: false },
    password: { type: String, required: true },
    tokens: { type: [String], default: [] },
    rememberToken: { type: String, default: null },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    passwordResetCode: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null }
}, { timestamps: true, toJSON: { virtuals: true } });

userSchema.plugin(mongoosePaginate);

userSchema.pre('save', function(next) {
    bcrypt.hash(this.password, bcrypt.genSaltSync(15), (err, hash) => {
        if (err) console.log(err);
        this.password = hash;
        next();
    });
});

userSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    if (update && update.$set && update.$set.password) {
        const salt = bcrypt.genSaltSync(15);
        const hash = bcrypt.hashSync(update.$set.password, salt);
        update.$set.password = hash;
    }
    next();
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