import controller from './controller.js';
import Word from '../../../models/word.js';

/**
 * soundController — کارگاه هجا (the syllable workshop).
 *
 * تحلیل هجا answers "what does this word sound like?". The workshop asks the
 * question the other way round: the writer gives a sound string — اِ-آ-آ — and
 * Rhymo answers with the words that carry it.
 *
 * That is a projection over `Word.ava` / `Word.avaString`; no rhyme logic and
 * no analyser live here. The analyser (processController) is what fills those
 * fields in the first place, so the workshop always speaks the same alphabet
 * the rest of the app does — which is why the key row is served from the data
 * itself (`/soundAlphabet`) rather than hard-coded in the client.
 */

/** Distinct-phoneme scans are collection-wide; keep the answer around. */
const ALPHABET_TTL_MS = 10 * 60 * 1000;
const alphabetCache = new Map(); // lang -> { at, payload }

class soundController extends controller {
    langQuery(lang) {
        return lang === 'en' ? { lang: 'en' } : { lang: { $ne: 'en' } };
    }

    escapeRegex(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Split a written pattern into phoneme tokens.
     * Accepts every separator a writer might reach for: "اِ-آ-آ", "اِ آ آ",
     * "اِ،آ،آ", "e,a,a".
     */
    parsePattern(raw) {
        return String(raw || '')
            .split(/[\s,،\-–—_/|·•]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
    }

    /**
     * GET /soundAlphabet?lang=fa|en
     *
     * The phonemes that actually occur in the dictionary, most common first —
     * the key row of the workshop. Serving it from the data means the keys can
     * never drift from what a search would match.
     */
    async soundAlphabet(req, res, next) {
        try {
            const lang = req.query.lang === 'en' ? 'en' : 'fa';
            const cached = alphabetCache.get(lang);
            if (cached && Date.now() - cached.at < ALPHABET_TTL_MS) {
                return res.status(200).json(cached.payload);
            }

            const rows = await Word.aggregate([
                { $match: this.langQuery(lang) },
                { $unwind: '$ava' },
                { $group: { _id: '$ava', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 60 },
            ]);

            const payload = {
                lang,
                phonemes: rows
                    .filter((r) => r._id && String(r._id).trim().length > 0)
                    .map((r) => ({ ava: r._id, count: r.count })),
            };
            alphabetCache.set(lang, { at: Date.now(), payload });
            return res.status(200).json(payload);
        } catch (error) {
            console.error('soundAlphabet failed:', error);
            return res.status(500).json({ error: 'soundAlphabet failed', details: error.message });
        }
    }

    /**
     * GET /soundSearch?pattern=اِ,آ,آ&match=exact|end&hejaCounter=&page=&limit=
     *
     *   exact → the word's whole sound string is the pattern
     *   end   → the pattern is how the word ends (the rhyming tail)
     *
     * Output is shaped like the other word lists so the client can hand a
     * result straight to the word bank.
     */
    async soundSearch(req, res, next) {
        try {
            const tokens = this.parsePattern(req.query.pattern);
            if (tokens.length === 0) {
                return res.status(400).json({ error: 'pattern is required' });
            }

            const lang = req.query.lang === 'en' ? 'en' : 'fa';
            const match = req.query.match === 'end' ? 'end' : 'exact';
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 30, 100);
            const joined = tokens.join(',');

            // Match on the `ava` ARRAY, never on avaString: the dictionary was
            // filled by two different writers over time (the analyser joins
            // phonemes with "," , older batch rows with " - "), so the string
            // form is not consistent. The array always is.
            const query = { ...this.langQuery(lang) };
            if (match === 'exact') {
                query.ava = tokens;
            } else {
                // The pattern is how the word ends: compare the last N entries.
                query.$expr = {
                    $and: [
                        { $gte: [{ $size: '$ava' }, tokens.length] },
                        { $eq: [{ $slice: ['$ava', -tokens.length] }, tokens] },
                    ],
                };
            }

            const hejaCounter = parseInt(req.query.hejaCounter);
            if (!Number.isNaN(hejaCounter) && hejaCounter > 0) {
                query.hejaCounter = hejaCounter;
            }

            const result = await Word.paginate(query, {
                page,
                limit,
                sort: { hejaCounter: 1, fullWord: 1 },
                select: 'fullWord word heja ava avaString hejaCounter',
            });

            return res.status(200).json({
                pattern: joined,
                tokens,
                match,
                docs: result.docs.map((w) => ({
                    id: w._id,
                    fullWord: w.fullWord,
                    word: w.word,
                    heja: w.heja,
                    ava: w.ava,
                    avaString: w.avaString,
                    hejaCounter: w.hejaCounter,
                })),
                pagination: {
                    currentPage: result.page,
                    totalPages: result.totalPages,
                    totalItems: result.totalDocs,
                    itemsPerPage: result.limit,
                    hasNextPage: result.hasNextPage,
                    hasPrevPage: result.hasPrevPage,
                },
            });
        } catch (error) {
            console.error('soundSearch failed:', error);
            return res.status(500).json({ error: 'soundSearch failed', details: error.message });
        }
    }
}

export default new soundController();
