const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const categorySchema = Schema({
    name : { type : String , required : true},
    parent : { type : Schema.Types.ObjectId , ref : 'Category' , default : null },
    slug:{ type:String }
} , { timestamps : true , toJSON : { virtuals : true } });

categorySchema.plugin(mongoosePaginate);

categorySchema.virtual('childs' , {
    ref : 'Category',
    localField : '_id',
    foreignField : 'parent'
});


module.exports = mongoose.model('Category' , categorySchema);