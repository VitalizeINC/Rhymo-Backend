import controller from './controller.js';
import Word from '../../../models/word.js';
import WordBank from '../../../models/wordBank.js';
import Note from '../../../models/note.js';

const ZWNJ = String.fromCharCode(0x200C);

// Fatha, damma, kasra, tashdid, sukun, tanvin — everything the analyser may emit.
const DIACRITICS = [1611, 1612, 1613, 1614, 1615, 1616, 1617, 1618].map((c) =>
    String.fromCharCode(c)
);

/**
 * notepadController
 * -----------------
 * Everything the v2 notepad needs that did not exist before: solid-word
 * resolution, the per-user word bank, notes storage and syllable read-back.
 *
 * This controller deliberately contains NO rhyme-finding, word-partitioning or
 * phoneme logic. Those live in processController / wordManageController and are
 * reached through the existing endpoints. Adding a word that is not yet in the
 * database still goes through processController.getWordDetails +
 * wordManageController.saveWords exactly as before.
 */
class notepadController extends controller {
    /**
     * Strip every diacritic, so "شِکَر" and "شُکر" both reduce to "شکر".
     */
    stripDiacritics(s) {
        let out = s || '';
        for (const d of DIACRITICS) {
            out = out.split(d).join('');
        }
        return out;
    }

    /**
     * The database is not perfectly consistent about ZWNJ vs space in the
     * `word` field (getWordDetails stores the raw input, saveWords stores a
     * space-normalised copy). Resolve against every plausible spelling.
     */
    candidateForms(input) {
        const trimmed = (input || '').trim();
        const solid = this.stripDiacritics(trimmed);
        const forms = new Set([
            trimmed,
            solid,
            solid.split(ZWNJ).join(' '),
            solid.split(ZWNJ).join(''),
            solid.split(' ').join(ZWNJ),
        ]);
        return [...forms].filter((f) => f.length > 0);
    }

    /**
     * GET /resolveWord?string=<solid or vocalised word>
     *
     * Answers the single question the notepad and the rhyme finder both ask:
     * "does the user's plain, unvocalised word already exist, and if so, in how
     * many vocalised variants?"
     *
     *   status: 'none'     → caller opens the add-word modal (اعراب‌گذاری flow)
     *   status: 'single'   → caller proceeds straight through with matches[0]
     *   status: 'multiple' → caller shows the fast variant picker
     */
    async resolveWord(req, res, next) {
        try {
            const raw = (req.query.string || '').trim();
            if (!raw) {
                return res.status(400).json({ error: 'string is required' });
            }

            // English: no diacritics or variants — a simple case-insensitive
            // dictionary lookup. 'none' means the word isn't in cmudict (there
            // is no English add-word flow).
            if (req.query.lang === 'en') {
                const lower = raw.toLowerCase();
                const match = await Word.findOne({ fullWord: lower, lang: 'en' })
                    .select('fullWord fullWordWithNimFaseleh word heja ava avaString hejaCounter');
                return res.status(200).json({
                    query: raw,
                    solid: lower,
                    status: match ? 'single' : 'none',
                    matches: match ? [{
                        id: match._id,
                        fullWord: match.fullWord,
                        word: match.word,
                        heja: match.heja,
                        ava: match.ava,
                        avaString: match.avaString,
                        hejaCounter: match.hejaCounter,
                    }] : [],
                });
            }

            const forms = this.candidateForms(raw);
            const matches = await Word.find({
                lang: { $ne: 'en' },
                $or: [{ word: { $in: forms } }, { fullWord: { $in: forms } }],
            })
                .select('fullWord fullWordWithNimFaseleh word heja ava avaString hejaCounter')
                .limit(25);

            // De-duplicate by vocalised spelling: the same fullWord should never
            // appear twice in the picker.
            const seen = new Set();
            const unique = [];
            for (const m of matches) {
                if (seen.has(m.fullWord)) continue;
                seen.add(m.fullWord);
                unique.push({
                    id: m._id,
                    fullWord: m.fullWord,
                    word: m.word,
                    heja: m.heja,
                    ava: m.ava,
                    avaString: m.avaString,
                    hejaCounter: m.hejaCounter,
                });
            }

            let status = 'none';
            if (unique.length === 1) status = 'single';
            else if (unique.length > 1) status = 'multiple';

            return res.status(200).json({
                query: raw,
                solid: this.stripDiacritics(raw),
                status,
                matches: unique,
            });
        } catch (error) {
            console.error('resolveWord failed:', error);
            return res.status(500).json({ error: 'resolveWord failed', details: error.message });
        }
    }

    /**
     * GET /wordAnalysis?id=<wordId>
     * Syllable read-back for تحلیل هجا. Pure projection of an existing Word.
     */
    async wordAnalysis(req, res, next) {
        try {
            const word = await Word.findById(req.query.id).select(
                'fullWord fullWordWithNimFaseleh word heja ava avaString hejaCounter spacePositions nimFaselehPositions level'
            );
            if (!word) {
                return res.status(404).json({ error: 'Word not found' });
            }
            // Pair each heja with its ava so the client does not have to zip them.
            const parts = word.heja.map((h, i) => ({
                index: i,
                heja: h,
                ava: word.ava[i] || '',
            }));
            return res.status(200).json({
                id: word._id,
                fullWord: word.fullWord,
                word: word.word,
                heja: word.heja,
                ava: word.ava,
                avaString: word.avaString,
                hejaCounter: word.hejaCounter,
                parts,
            });
        } catch (error) {
            console.error('wordAnalysis failed:', error);
            return res.status(500).json({ error: 'wordAnalysis failed', details: error.message });
        }
    }

    // ---------------------------------------------------------------- word bank

    /**
     * GET /wordBank?search=&page=&limit=&source=
     */
    async getWordBank(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 30;
            const search = (req.query.search || '').trim();
            const source = req.query.source;

            const query = { user: req.user.id };
            if (search) {
                const rx = new RegExp(this.stripDiacritics(search), 'i');
                query.$or = [{ solidWord: rx }, { fullWord: rx }];
            }
            if (source) query.source = source;

            const result = await WordBank.paginate(query, {
                page,
                limit,
                sort: { createdAt: -1 },
                populate: {
                    path: 'word',
                    select: 'fullWord word heja ava avaString hejaCounter',
                },
            });

            return res.status(200).json(result);
        } catch (error) {
            console.error('getWordBank failed:', error);
            return res.status(500).json({ error: 'getWordBank failed', details: error.message });
        }
    }

    /**
     * POST /wordBank  { wordId, source?, noteId?, tag? }
     * Idempotent: adding a word already in the bank bumps useCount/lastUsedAt.
     */
    async addToWordBank(req, res, next) {
        try {
            const { wordId, source = 'manual', noteId = null, tag = null } = req.body;
            if (!wordId) {
                return res.status(400).json({ error: 'wordId is required' });
            }

            const word = await Word.findById(wordId).select('fullWord word heja ava avaString hejaCounter');
            if (!word) {
                return res.status(404).json({ error: 'Word not found' });
            }

            const existing = await WordBank.findOne({ user: req.user.id, word: word._id });
            if (existing) {
                existing.useCount += 1;
                existing.lastUsedAt = new Date();
                if (noteId && !existing.note) existing.note = noteId;
                if (tag) existing.tag = tag;
                await existing.save();
                return res.status(200).json({ entry: existing, created: false });
            }

            const entry = new WordBank({
                user: req.user.id,
                word: word._id,
                fullWord: word.fullWord,
                solidWord: word.word,
                source,
                note: noteId,
                tag,
            });
            await entry.save();

            return res.status(201).json({ entry, created: true });
        } catch (error) {
            // Duplicate key can still happen under concurrent taps — treat as success.
            if (error && error.code === 11000) {
                return res.status(200).json({ created: false, duplicate: true });
            }
            console.error('addToWordBank failed:', error);
            return res.status(500).json({ error: 'addToWordBank failed', details: error.message });
        }
    }

    /**
     * DELETE /wordBank?id=<entryId>
     */
    async removeFromWordBank(req, res, next) {
        try {
            const entry = await WordBank.findOneAndDelete({
                _id: req.query.id,
                user: req.user.id,
            });
            if (!entry) {
                return res.status(404).json({ error: 'Entry not found' });
            }
            return res.status(200).json({ removed: true });
        } catch (error) {
            console.error('removeFromWordBank failed:', error);
            return res.status(500).json({ error: 'removeFromWordBank failed', details: error.message });
        }
    }

    // -------------------------------------------------------------------- notes

    /**
     * GET /notes?page=&limit=
     */
    async getNotes(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const result = await Note.paginate(
                { user: req.user.id },
                { page, limit, sort: { updatedAt: -1 }, select: '-wordRefs' }
            );
            return res.status(200).json(result);
        } catch (error) {
            console.error('getNotes failed:', error);
            return res.status(500).json({ error: 'getNotes failed', details: error.message });
        }
    }

    /**
     * GET /note?id=<noteId>
     */
    async getNote(req, res, next) {
        try {
            const note = await Note.findOne({ _id: req.query.id, user: req.user.id });
            if (!note) {
                return res.status(404).json({ error: 'Note not found' });
            }
            return res.status(200).json(note);
        } catch (error) {
            console.error('getNote failed:', error);
            return res.status(500).json({ error: 'getNote failed', details: error.message });
        }
    }

    /**
     * POST /note  { id?, title, content, baytCount?, rhymeCount?, wordRefs? }
     * Creates when `id` is absent, updates in place otherwise.
     */
    async saveNote(req, res, next) {
        try {
            const { id, title, content = '', baytCount = 0, rhymeCount = 0, wordRefs = [] } = req.body;

            if (id) {
                const note = await Note.findOne({ _id: id, user: req.user.id });
                if (!note) {
                    return res.status(404).json({ error: 'Note not found' });
                }
                if (typeof title === 'string' && title.length) note.title = title;
                note.content = content;
                note.baytCount = baytCount;
                note.rhymeCount = rhymeCount;
                note.wordRefs = wordRefs;
                await note.save();
                return res.status(200).json(note);
            }

            const note = new Note({
                user: req.user.id,
                title: title && title.length ? title : 'یادداشت بدون عنوان',
                content,
                baytCount,
                rhymeCount,
                wordRefs,
            });
            await note.save();
            return res.status(201).json(note);
        } catch (error) {
            console.error('saveNote failed:', error);
            return res.status(500).json({ error: 'saveNote failed', details: error.message });
        }
    }

    /**
     * DELETE /note?id=<noteId>
     */
    async deleteNote(req, res, next) {
        try {
            const note = await Note.findOneAndDelete({ _id: req.query.id, user: req.user.id });
            if (!note) {
                return res.status(404).json({ error: 'Note not found' });
            }
            return res.status(200).json({ removed: true });
        } catch (error) {
            console.error('deleteNote failed:', error);
            return res.status(500).json({ error: 'deleteNote failed', details: error.message });
        }
    }
}

export default new notepadController();
