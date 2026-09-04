import mongoose from 'mongoose';
import { Schema } from 'mongoose';

/**
 * Folder
 * ------
 * A user-named drawer inside the word bank (بانک واژه).
 *
 * Every way of collecting a word — a rhyme tapped in the finder, a word found
 * in the syllable workshop, a suggestion taken in the notepad — ends with the
 * same question: which folder does this go in? An entry with `folder: null`
 * sits in the implicit "بدون پوشه" drawer, so folders stay optional.
 *
 * The notepad reads the same folders back: its suggestion source is either the
 * whole database or a chosen set of folders.
 */
const folderSchema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
}, { timestamps: true, toJSON: { virtuals: true } });

// Folder names are unique per user, so "قافیه‌های تیره" can only exist once.
folderSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model('Folder', folderSchema);
