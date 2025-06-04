import mongoose from 'mongoose';
import {Schema} from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const wordSchema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    fullWord: { type: String, required: true, unique: true },
    fullWordWithNimFaseleh: { type: String, required: true },
    word: { type: String, required: true },
    heja: [{ type: String, required: true }],
    ava: [{ type: String, required: true }],
    avaString: { type: String, required: true },
    hejaCounter: { type: Number, required: true },
    nimFaselehPositions: [{ type: Number, required: true }],
    spacePositions: [{ type: Number, required: true }],
    private: { type: Boolean, default: false, required: true },
    approved: { type: Boolean, default: false, required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date, default: null },
    rejected: { type: Boolean, default: false, required: true },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: null },
}, { timestamps: true, toJSON: { virtuals: true } })

wordSchema.plugin(mongoosePaginate);


export default mongoose.model('Word', wordSchema);