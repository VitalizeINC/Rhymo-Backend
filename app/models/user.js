const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const uniqueString = require('unique-string')
const Schema = mongoose.Schema
const mongoosePaginate = require('mongoose-paginate-v2')
const userSchema = Schema({
    name:{type:String , required:true},
    admin:{type:Boolean , default:0},
    phoneNumber:{type:String,required:true,unique:true},
    email:{type:String,required:false},
    password:{type:String,required:true},
    learning:[{type:Schema.Types.ObjectId , ref:'Courses'}],
    rememberToken:{type:String,default:null},
    roles:[{type:Schema.Types.ObjectId , ref:'Role'}]

},{timestamps:true , toJSON : {virtuals : true}})

userSchema.plugin(mongoosePaginate)
userSchema.pre('save',function(next){
    bcrypt.hash(this.password , bcrypt.genSaltSync(15),(err,hash)=>{
        if(err) console.log(err);
        this.password = hash;
        next();      
    })
})
userSchema.pre('findOneAndUpdate',function(next){
    let salt = bcrypt.genSaltSync(15)
    let hash = bcrypt.hashSync(this.getUpdate().$set.password,salt)
    this.getUpdate().$set.password = hash
    next();
})

userSchema.methods.comparePassword = function(password) {
    return bcrypt.compareSync(password , this.password);
}

userSchema.methods.setRememberToken = function(res){
    const token = uniqueString();
    res.cookie('remember_token',token,{maxAge: 1000 * 60 * 30 * 24 * 90,httoOnly:true,signed:true})
    this.update({ rememberToken : token },err=>console.log(err))
}
userSchema.virtual('courses' , {
    ref:'Course',
    localField:'_id',
    foreignField:'user'
})
userSchema.methods.isVip = function() {
    return true
}
userSchema.methods.hasRole = function(roles) {
    let result = roles.filter(role => {
        return this.roles.indexOf(role) > -1
    })
    return !! result.length
}
userSchema.methods.checkLearning = function(courseId){
    return this.learning.indexOf(courseId) !== -1;
}

module.exports = mongoose.model('User',userSchema)