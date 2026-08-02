import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

/**
 * WordBank
 * ---------
 * Per-user collection of words gathered while writing.
 *
 * Entries are created when:
 *   - a word is confirmed inside a rhyme marker in the notepad  (source: 'rhyme')
 *   - a word is tapped from the rhyme suggestion strip          (source: 'suggestion')
 *   - the user explicitly adds it                               (source: 'manual')
 *   - a word is used as the seed of a rhyme search              (source: 'finder')
 *
 * `word` points at the canonical Word document, so heja/ava are never duplicated
 * here — they are always read back through populate(). fullWord/solidWord are
 * denormalised only so the bank can be searched and listed without a join.
 */
const wordBankSchema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    word: { type: Schema.Types.ObjectId, ref: 'Word', required: true },
    fullWord: { type: String, required: true },
    solidWord: { type: String, required: true, index: true },
    source: {
        type: String,
        enum: ['rhyme', 'suggestion', 'manual', 'finder'],
        default: 'manual',
        required: true,
    },
    // Optional back-reference to the note the word was captured in.
    note: { type: Schema.Types.ObjectId, ref: 'Note', default: null },
    // Free-form user label, e.g. a theme or a project name.
    tag: { type: String, default: null },
    useCount: { type: Number, default: 1, required: true },
    lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true, toJSON: { virtuals: true } });

// One entry per (user, word). Re-adding an existing word bumps useCount instead.
wordBankSchema.index({ user: 1, word: 1 }, { unique: true });
wordBankSchema.index({ user: 1, createdAt: -1 });

wordBankSchema.plugin(mongoosePaginate);

export default mongoose.model('WordBank', wordBankSchema);
