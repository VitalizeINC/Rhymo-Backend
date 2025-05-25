import mongoose from 'mongoose';
import {Schema} from 'mongoose';
import mongoosePaginate from 'mongoose-paginate';

const wordSchema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    approved: { type: Boolean, default: false, required: true },
    fullWord: { type: String, required: true, unique: true },
    word: { type: String, required: true },
    heja: [{ type: String, required: true }],
    ava: [{ type: String, required: true }],
    avaString: { type: String, required: true },
    hejaCounter: { type: Number, required: true },
    spacePositions: [{ type: Number, required: true }],
}, { timestamps: true, toJSON: { virtuals: true } });

wordSchema.plugin(mongoosePaginate);


export default mongoose.model('Word', wordSchema);