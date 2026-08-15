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
    // Batch word tracking fields
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', default: null },
    batchName: { type: String, default: null },
    wordBatchId: { type: Schema.Types.ObjectId, ref: 'WordBatch', default: null },
    // Word level/category
    level: { type: Number, default: 1, required: true },
    // Language of the word: 'fa' (Persian, default — legacy docs have no
    // lang field and are treated as Persian) or 'en' (English/CMUdict).
    lang: { type: String, enum: ['fa', 'en'], default: 'fa', index: true },
    // English only: phones from the last stressed vowel to the end, stress
    // stripped (e.g. "EY SH AH N"). Perfect rhymes share the same rhymeKey.
    rhymeKey: { type: String, default: null, index: true },
    // English only: slant-rhyme key — vowel sequence from the last stressed
    // syllable + final consonant (e.g. "AA|Z" for palms/arms/bars).
    nearRhymeKey: { type: String, default: null, index: true },
}, { timestamps: true, toJSON: { virtuals: true } })

wordSchema.plugin(mongoosePaginate);


export default mongoose.model('Word', wordSchema);