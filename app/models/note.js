import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

/**
 * Note
 * ----
 * A notepad document. `content` is stored verbatim, including the authoring
 * syntax the client parses:
 *
 *   /            → بیت separator
 *   !word!       → rhyme group 1
 *   !!word!!     → rhyme group 2
 *   !!!word!!!   → rhyme group 3   … the run length IS the group number
 *
 * `!` is the only marker character. The client expands a typed `!` to the run
 * its group needs, so the writer never counts them — but the run is what makes
 * `content` self-describing, and it is why the server can stay ignorant of
 * groups entirely.
 *
 * The server never rewrites `content`; parsing and colouring happen client-side.
 * `wordRefs` caches the resolution of each marked word to a Word document so the
 * note can be reopened without re-resolving every marker.
 */
const wordRefSchema = Schema({
    // The text exactly as it appears between the markers.
    token: { type: String, required: true },
    word: { type: Schema.Types.ObjectId, ref: 'Word', required: true },
    fullWord: { type: String, required: true },
    group: { type: Number, default: 1, required: true },
}, { _id: false });

const noteSchema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'یادداشت بدون عنوان', required: true },
    content: { type: String, default: '', required: true },
    // Cached counters so the notes list does not have to parse every note.
    baytCount: { type: Number, default: 0, required: true },
    rhymeCount: { type: Number, default: 0, required: true },
    wordRefs: { type: [wordRefSchema], default: [] },
}, { timestamps: true, toJSON: { virtuals: true } });

noteSchema.index({ user: 1, updatedAt: -1 });

noteSchema.plugin(mongoosePaginate);

export default mongoose.model('Note', noteSchema);
