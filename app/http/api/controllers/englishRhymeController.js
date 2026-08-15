import controller from './controller.js';
import Word from '../../../models/word.js';
import {
  analyze,
  rhymeQuery,
  suffixKey,
  stripStress,
  nearKeyFromRhymeKey,
} from '../../../helpers/englishRhymeEngine.js';

/**
 * English counterpart of processController + the rhyme part of
 * wordManageController. The existing endpoints delegate here when the
 * request carries lang=en, so the mobile app talks to the same routes and
 * receives the same response shapes for both languages.
 *
 * English words come pre-analyzed from the CMU Pronouncing Dictionary
 * (scripts/seedEnglishWords.js); there is no G2P fallback, so unknown words
 * return pass:false instead of opening the Persian diacritic-editing flow.
 */
class englishRhymeController extends controller {

  /**
   * POST /getWordDetails  (lang: 'en')
   * Mirrors processController.getWordDetails: splits the input on spaces,
   * resolves every part against the seeded dictionary, and for multi-word
   * phrases creates a combined Word document so rhyme search can run on it.
   */
  async getWordDetails(req, res, next) {
    const modalTitle = String(req.body.string || '').trim().toLowerCase();
    const stringParts = modalTitle.split(' ').filter(Boolean);
    const result = [];
    let pass = stringParts.length > 0;
    let totalParts = [];
    let totalPhonemes = [];

    for (const part of stringParts) {
      const schema = { id: '', part, db: false, parts: [], phonemes: [] };
      const found = await Word.findOne({ fullWord: part, lang: 'en' });
      if (found) {
        schema.db = true;
        schema.id = found._id;
        schema.parts = found.heja;
        schema.phonemes = found.ava;
        totalParts = [...totalParts, ...found.heja];
        totalPhonemes = [...totalPhonemes, ...found.ava];
      } else {
        pass = false; // no G2P for English — the word must exist in cmudict
      }
      result.push(schema);
    }

    let totalId = '';
    if (pass) {
      const existing = await Word.findOne({ fullWord: modalTitle, lang: 'en' });
      if (existing) {
        totalId = existing._id;
      } else {
        // Combined phrase: re-analyze the concatenated phone stream so the
        // rhymeKey reflects the *last* word's stress pattern.
        const phones = totalParts.join(' ').split(/\s+/).filter(Boolean);
        const a = analyze(modalTitle, phones);
        if (!a) {
          pass = false;
        } else {
          const newWord = new Word({
            fullWord: modalTitle,
            fullWordWithNimFaseleh: modalTitle,
            word: modalTitle,
            heja: a.heja,
            ava: a.ava,
            avaString: a.avaString,
            hejaCounter: a.hejaCounter,
            rhymeKey: a.rhymeKey,
            nearRhymeKey: a.nearRhymeKey,
            spacePositions: [...modalTitle].flatMap((c, i) => (c === ' ' ? [i] : [])),
            nimFaselehPositions: [],
            lang: 'en',
            level: 1,
          });
          await newWord.save();
          totalId = newWord._id;
        }
      }
    }

    return res.status(200).json({ modalTitle, result, pass, totalId });
  }

  /**
   * GET /getRhymes (lang: 'en')
   * partsNumber semantics:
   *   -1 / absent  -> perfect rhyme (from the last stressed vowel; the
   *                   English equivalent of the Persian "professional" mode)
   *   N >= 1       -> suffix rhyme over the last N syllables
   * filter: comma-separated letters that must appear in the result word,
   *         same contract as the Persian endpoint.
   */
  async getRhymes(req, res, next) {
    const id = req.query.id;
    const initWord = await Word.findById(id);
    if (!initWord || initWord.lang !== 'en') {
      return res.status(404).json({ error: 'Word not found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || '';
    let partsNumber = parseInt(req.query.partsNumber);
    if (isNaN(partsNumber)) partsNumber = -1;

    const a = {
      avaString: initWord.avaString,
      rhymeKey: initWord.rhymeKey,
      hejaCounter: initWord.hejaCounter,
    };
    const mode = partsNumber === -1 ? 'perfect' : 'suffix';
    const query = {
      lang: 'en',
      _id: { $ne: initWord._id },
      ...(mode === 'perfect'
        ? { rhymeKey: initWord.rhymeKey }
        : rhymeQuery(
            { avaString: initWord.avaString, hejaCounter: initWord.hejaCounter },
            { mode: 'suffix', syllables: partsNumber }
          )),
    };

    if (filter) {
      const filterChar = filter
        .split(',')
        .filter(Boolean)
        .map((x) => `(?=.*${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);
      if (filterChar.length) query.word = new RegExp(filterChar.join(''), 'i');
    }

    const fetchLimit = limit * 10;
    let words = await Word.find(query)
      .select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter rhymeKey')
      .sort({ hejaCounter: 1, fullWord: 1 })
      .limit(fetchLimit);

    // Near-rhyme tier (perfect mode only): slant rhymes — same stressed-vowel
    // sequence and final consonant, different rhymeKey (palms → arms,
    // sweaty → heavy). Appended AFTER the perfect matches so quality ranks.
    if (mode === 'perfect' && initWord.rhymeKey) {
      const nearKey = nearKeyFromRhymeKey(initWord.rhymeKey);
      if (nearKey && words.length < fetchLimit) {
        const nearQuery = {
          lang: 'en',
          _id: { $ne: initWord._id },
          nearRhymeKey: nearKey,
          rhymeKey: { $ne: initWord.rhymeKey },
        };
        if (query.word) nearQuery.word = query.word; // same consonant filter
        const nearWords = await Word.find(nearQuery)
          .select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter rhymeKey')
          .sort({ hejaCounter: 1, fullWord: 1 })
          .limit(fetchLimit - words.length);
        const seen = new Set(words.map((w) => String(w._id)));
        for (const w of nearWords) {
          if (!seen.has(String(w._id))) words.push(w);
        }
      }
    }

    // Drop homophones of the query word (identical full phone sequence).
    const selfPhones = initWord.heja.join(' ').split(/\s+/).map(stripStress).join(' ');
    words = words.filter((w) => {
      const phones = w.heja.join(' ').split(/\s+/).map(stripStress).join(' ');
      return phones !== selfPhones;
    });

    // Rhyming syllable count (for highlight estimation)
    const rhymeSyllables = mode === 'perfect'
      ? (initWord.rhymeKey || '').length
        ? initWord.avaString.split(',').length - this._rhymeStartFromKey(initWord)
        : 1
      : Math.min(partsNumber, initWord.hejaCounter);

    const response = [];
    const fullResponse = [];
    const highlight = [];
    const rhymeAva = [];
    const heja = [];
    const ids = [];
    for (const w of words) {
      response.push(w.word);
      fullResponse.push(w.fullWord);
      heja.push(w.heja);
      ids.push(w._id);
      rhymeAva.push(w.avaString);
      // English orthography can't be phoneme-aligned exactly; approximate the
      // highlighted rhyme part proportionally to the rhyming syllables.
      const len = w.fullWord.length;
      const ratio = Math.min(1, rhymeSyllables / w.hejaCounter);
      const start = Math.max(0, len - Math.max(2, Math.round(len * ratio)));
      highlight.push([start, len - 1]);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const totalItems = response.length;
    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      rhymes: response.slice(startIndex, endIndex),
      fullResponse: fullResponse.slice(startIndex, endIndex),
      rhymeAva: rhymeAva.slice(startIndex, endIndex),
      heja: heja.slice(startIndex, endIndex),
      ids: ids.slice(startIndex, endIndex),
      highlight: highlight.slice(startIndex, endIndex),
      selectedWord: initWord,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  }

  /** Number of syllables covered by the stored rhymeKey. */
  _rhymeStartFromKey(word) {
    // The rhymeKey covers the trailing syllables whose stress-stripped
    // suffixKey equals it; walk back from the end.
    const units = word.avaString.split(',');
    for (let n = 1; n <= units.length; n++) {
      const first = units[units.length - n].split('|')[1];
      const rest = units.slice(units.length - n + 1)
        .map((u) => u.replace('|', ' ').trim().replace(/\s+/g, ' '));
      const key = [first, ...rest].join(' ').replace(/\s+/g, ' ').trim();
      if (key === word.rhymeKey) return units.length - n;
    }
    return units.length - 1;
  }

  /**
   * GET /getTraditionalRhymes (lang: 'en')
   * Same-spelling-ending mode, mirroring the Persian traditional endpoint.
   * partsNumber = number of trailing LETTERS that must match.
   */
  async getTraditionalRhymes(req, res, next) {
    const id = req.query.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    let partsNumber = parseInt(req.query.partsNumber) || 1;
    if (partsNumber === -1) partsNumber = 1;

    const word = await Word.findById(id);
    if (!word || word.lang !== 'en') {
      return res.status(404).json({ error: 'Word not found' });
    }
    const endsWith = word.fullWord.slice(-partsNumber);
    const rx = new RegExp(`${endsWith.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

    const fetchLimit = limit * 10;
    const words = await Word.find({
      lang: 'en',
      _id: { $ne: word._id },
      fullWord: rx,
    })
      .select('ava avaString word spacePositions nimFaselehPositions fullWord heja hejaCounter')
      .sort({ hejaCounter: 1, fullWord: 1 })
      .limit(fetchLimit);

    const response = words.map((w) => w.word);
    const fullResponse = words.map((w) => w.fullWord);
    const heja = words.map((w) => w.heja);
    const ids = words.map((w) => w._id);
    const rhymeAva = words.map((w) => w.avaString);
    const highlight = words.map((w) => [
      Math.max(0, w.fullWord.length - endsWith.length),
      w.fullWord.length - 1,
    ]);

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const totalItems = response.length;
    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      rhymes: response.slice(startIndex, endIndex),
      fullResponse: fullResponse.slice(startIndex, endIndex),
      rhymeAva: rhymeAva.slice(startIndex, endIndex),
      heja: heja.slice(startIndex, endIndex),
      ids: ids.slice(startIndex, endIndex),
      highlight: highlight.slice(startIndex, endIndex),
      vajs: word.fullWord.split(''),
      selectedWord: word,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  }

  /**
   * GET /suggestWord (lang: 'en') — prefix suggestions from the English set.
   */
  async suggestWord(req, res, next) {
    const search = new RegExp(
      `^${String(req.query.string || '').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i'
    );
    const words = await Word.find({
      lang: 'en',
      fullWord: search,
      word: { $not: /\s/ },
    })
      .sort({ hejaCounter: 1, fullWord: 1 })
      .limit(10);
    res.status(200).json(words);
  }
}

export default new englishRhymeController();
