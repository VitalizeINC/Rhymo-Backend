import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import uniqueString from 'unique-string';
import mongoosePaginate from 'mongoose-paginate-v2';

const userSchema = new Schema({
    name: { type: String, required: true },
    admin: { type: Boolean, default: 0 },
    email: { type: String, required: false },
    password: { type: String, required: true },
    tokens: { type: [String], default: [] },
    rememberToken: { type: String, default: null },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }]
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

userSchema.methods.setRememberToken = function(res) {
    const token = uniqueString();
    res.cookie('remember_token', token, { maxAge: 1000 * 60 * 30 * 24 * 90, httpOnly: true, signed: true });
    this.update({ rememberToken: token }, err => console.log(err));
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