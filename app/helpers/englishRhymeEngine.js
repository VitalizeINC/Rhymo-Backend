/**
 * English Rhyme Engine
 * --------------------
 * The English counterpart of the Persian syllable/phoneme pipeline
 * (processController.process / phoneme). It is built on the CMU Pronouncing
 * Dictionary (ARPAbet phonemes + stress markers) instead of orthographic
 * rules, because English spelling does not encode pronunciation.
 *
 * Mapping onto the existing Persian data model (Word collection):
 *   heja        -> array of ARPAbet syllables, e.g. ["S T EY1", "SH AH0 N"]
 *   ava         -> array of per-syllable rimes (nucleus+coda, stress kept),
 *                  e.g. ["EY1", "AH0 N"]  (the "sound" of each syllable,
 *                  like the Persian vowel-nucleus array)
 *   avaString   -> comma-joined syllable units "onset|rime" used for
 *                  matching, e.g. "S T|EY1,SH|AH0 N"
 *   hejaCounter -> number of syllables
 *   rhymeKey    -> phones from the last stressed vowel to the end, stress
 *                  stripped, e.g. "EY SH AH N".  Two words are perfect
 *                  rhymes iff their rhymeKeys are equal (and, strictly,
 *                  the onset before that vowel differs — identity check).
 *
 * All functions are pure (no DB, no IO) so they can be unit-tested and
 * batch-validated against the full dictionary.
 */

// ---------------------------------------------------------------- constants

export const ARPABET_VOWELS = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY',
  'EH', 'ER', 'EY',
  'IH', 'IY',
  'OW', 'OY',
  'UH', 'UW',
]);

/**
 * Legal English syllable onsets (consonant clusters that can start a
 * syllable). Used by the maximal-onset syllabifier: intervocalic consonants
 * are given to the following syllable as long as they form a legal onset.
 */
const LEGAL_ONSETS = new Set([
  // single consonants (all consonant phones can start a syllable except NG/ZH is rare but legal in loans)
  'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N',
  'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
  // stop / fricative + liquid or glide
  'B L', 'B R', 'B Y',
  'CH Y',
  'D R', 'D W', 'D Y',
  'F L', 'F R', 'F Y',
  'G L', 'G R', 'G W', 'G Y',
  'HH Y', 'HH W',
  'K L', 'K R', 'K W', 'K Y',
  'M Y',
  'N Y',
  'P L', 'P R', 'P Y',
  'SH R', 'SH L', 'SH M', 'SH N', 'SH W',
  'T R', 'T W', 'T Y',
  'TH R', 'TH W', 'TH Y',
  'V Y', 'V L', 'V R',
  'Z L', 'Z W', 'Z Y',
  // S clusters
  'S F', 'S K', 'S L', 'S M', 'S N', 'S P', 'S T', 'S V', 'S W', 'S Y',
  'S K L', 'S K R', 'S K W', 'S K Y',
  'S P L', 'S P R', 'S P Y',
  'S T R', 'S T Y',
  'S F R',
]);

// ------------------------------------------------------------------ helpers

/** "EY1" -> { phone: "EY", stress: 1 } ; "T" -> { phone: "T", stress: null } */
export function splitStress(p) {
  const m = /^([A-Z]+)([0-2])?$/.exec(p);
  if (!m) return { phone: p, stress: null };
  return { phone: m[1], stress: m[2] === undefined ? null : Number(m[2]) };
}

export function isVowel(p) {
  return ARPABET_VOWELS.has(splitStress(p).phone);
}

export function stripStress(p) {
  return splitStress(p).phone;
}

/**
 * Parse one cmudict line: "station S T EY1 SH AH0 N".
 * Variant entries look like "station(2) ...". Comments after "#" are dropped.
 * Returns { word, variant, phones } or null for unusable lines.
 */
export function parseCmuLine(line) {
  const cleaned = line.replace(/#.*$/, '').trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;
  let word = parts[0].toLowerCase();
  let variant = 1;
  const vm = /^(.*)\((\d+)\)$/.exec(word);
  if (vm) {
    word = vm[1];
    variant = Number(vm[2]);
  }
  return { word, variant, phones: parts.slice(1) };
}

// ------------------------------------------------------------- syllabifier

/**
 * Normalize cmudict inconsistencies that would split true rhyme classes:
 * before R, cmudict sometimes writes IY and sometimes IH for the same
 * "ear" sound (here HH IY1 R vs sincere S IH0 N S IH1 R vs zero Z IY1 R OW0
 * vs hero HH IH1 R OW0). American English merges these before R, and
 * rhyming dictionaries treat them as one class, so we map IY -> IH when
 * immediately followed by R.
 */
export function normalizePhones(phones) {
  return phones.map((p, i) => {
    const { phone, stress } = splitStress(p);
    const next = phones[i + 1] ? splitStress(phones[i + 1]).phone : null;
    if (phone === 'IY' && next === 'R') {
      return stress === null ? 'IH' : `IH${stress}`;
    }
    return p;
  });
}

/**
 * Split an ARPAbet phone array into syllables using the maximal onset
 * principle. Every vowel phone anchors exactly one syllable.
 *
 * Returns an array of syllables:
 *   { onset: [phones], nucleus: "EY1", coda: [phones], stress: 0|1|2 }
 * Returns [] when the transcription has no vowel (shouldn't happen in cmudict).
 */
export function syllabify(phones) {
  const vowelIdxs = [];
  phones.forEach((p, i) => { if (isVowel(p)) vowelIdxs.push(i); });
  if (vowelIdxs.length === 0) return [];

  const syllables = vowelIdxs.map((vi) => ({
    onset: [], nucleus: phones[vi], coda: [], stress: splitStress(phones[vi]).stress ?? 0,
  }));

  // Leading consonants -> onset of first syllable
  syllables[0].onset = phones.slice(0, vowelIdxs[0]);
  // Trailing consonants -> coda of last syllable
  syllables[syllables.length - 1].coda = phones.slice(vowelIdxs[vowelIdxs.length - 1] + 1);

  // Consonants between vowel i and vowel i+1: split by maximal legal onset
  for (let i = 0; i < vowelIdxs.length - 1; i++) {
    const between = phones.slice(vowelIdxs[i] + 1, vowelIdxs[i + 1]);
    let split = between.length; // default: everything to coda
    for (let s = 0; s <= between.length; s++) {
      const candidate = between.slice(s).map(stripStress).join(' ');
      if (candidate === '' || LEGAL_ONSETS.has(candidate)) { split = s; break; }
    }
    syllables[i].coda = between.slice(0, split);
    syllables[i + 1].onset = between.slice(split);
  }
  return syllables;
}

/** Syllable -> "S T EY1" (full phones, stress kept) */
export function syllableString(syl) {
  return [...syl.onset, syl.nucleus, ...syl.coda].join(' ');
}

/** Syllable -> rime "EY1" / "AH0 N" (nucleus + coda, stress kept) */
export function rimeString(syl) {
  return [syl.nucleus, ...syl.coda].join(' ');
}

/** Syllable -> matching unit "S T|EY" (onset | rime, stress stripped so that
 *  matching ignores stress differences between words) */
export function unitString(syl) {
  const rime = [syl.nucleus, ...syl.coda].map(stripStress).join(' ');
  return `${syl.onset.map(stripStress).join(' ')}|${rime}`;
}

// ------------------------------------------------------------- rhyme logic

/**
 * Index (into syllables) where the perfect rhyme begins: the last syllable
 * carrying any stress (primary or secondary) — the convention used by
 * standard rhyming dictionaries. For fully unstressed function words,
 * the last syllable.
 */
export function rhymeStartIndex(syllables) {
  for (let i = syllables.length - 1; i >= 0; i--) {
    if (syllables[i].stress === 1 || syllables[i].stress === 2) return i;
  }
  return syllables.length - 1;
}

/**
 * The perfect-rhyme key: phones from the last stressed vowel to the end,
 * stress stripped. station -> "EY SH AH N", cat -> "AE T".
 */
export function rhymeKey(syllables) {
  const start = rhymeStartIndex(syllables);
  const phones = [rimeString(syllables[start])];
  for (let i = start + 1; i < syllables.length; i++) {
    phones.push(syllableString(syllables[i]));
  }
  return phones.join(' ').split(/\s+/).map(stripStress).join(' ');
}

/**
 * Suffix key over the last `n` syllables (used when the app's partsNumber
 * slider asks for a deeper or shallower rhyme than the stress-based default):
 * rime of syllable -n, then full syllables after it, stress stripped.
 */
export function suffixKey(syllables, n) {
  const count = Math.min(Math.max(1, n), syllables.length);
  const start = syllables.length - count;
  const phones = [rimeString(syllables[start])];
  for (let i = start + 1; i < syllables.length; i++) {
    phones.push(syllableString(syllables[i]));
  }
  return phones.join(' ').split(/\s+/).map(stripStress).join(' ');
}

/**
 * Near-rhyme (slant-rhyme) key, derived from the perfect rhymeKey:
 * the vowel sequence from the last stressed syllable onward, plus the final
 * consonant (or "-" for open endings). Words sharing it sound alike without
 * matching exactly — the staple of rap and song lyrics:
 *
 *   palms  "AA M Z"   -> "AA|Z"    arms "AA R M Z" -> "AA|Z"    (match)
 *   sweaty "EH T IY"  -> "EH IY|-" heavy "EH V IY" -> "EH IY|-" (match)
 *   cat    "AE T"     -> "AE|T"    cap  "AE P"     -> "AE|P"    (no match)
 */
export function nearKeyFromRhymeKey(rhymeKeyStr) {
  const phones = String(rhymeKeyStr || '').split(/\s+/).filter(Boolean);
  if (phones.length === 0) return null;
  const vowels = phones.filter((p) => ARPABET_VOWELS.has(p));
  const last = phones[phones.length - 1];
  const lastConsonant = ARPABET_VOWELS.has(last) ? '-' : last;
  return `${vowels.join(' ')}|${lastConsonant}`;
}

/**
 * Near-rhyme test: same near key but NOT a perfect rhyme (perfect pairs are
 * reported by isPerfectRhyme; this is the looser tier around them).
 */
export function isNearRhyme(a, b) {
  if (!a || !b) return false;
  if (a.rhymeKey === b.rhymeKey) return false;
  return (
    nearKeyFromRhymeKey(a.rhymeKey) === nearKeyFromRhymeKey(b.rhymeKey)
  );
}

/**
 * Analyze a word's phones into the shape stored on the Word model.
 */
export function analyze(word, phones) {
  const syllables = syllabify(normalizePhones(phones));
  if (syllables.length === 0) return null;
  return {
    fullWord: word,
    word,
    heja: syllables.map(syllableString),
    ava: syllables.map(rimeString),
    avaString: syllables.map(unitString).join(','),
    hejaCounter: syllables.length,
    rhymeKey: rhymeKey(syllables),
    nearRhymeKey: nearKeyFromRhymeKey(rhymeKey(syllables)),
    rhymeStart: rhymeStartIndex(syllables),
    syllables,
  };
}

/**
 * Perfect rhyme test between two analyzed words.
 * Identical rhymeKey AND not the same word AND (strict) the onset of the
 * rhyming syllable differs OR earlier material differs — "station"/"station"
 * is identity, "nation"/"carnation" is debatable but accepted by most
 * dictionaries; we only reject exact homophones of the rhyming word when
 * the full pronunciations are identical.
 */
export function isPerfectRhyme(a, b) {
  if (!a || !b) return false;
  if (a.rhymeKey !== b.rhymeKey) return false;
  const aFull = a.heja.join(' ').split(/\s+/).map(stripStress).join(' ');
  const bFull = b.heja.join(' ').split(/\s+/).map(stripStress).join(' ');
  if (aFull === bFull) return false; // homophone / same word
  return true;
}

/**
 * Suffix rhyme test over the last n syllables (partsNumber semantics).
 */
export function isSuffixRhyme(a, b, n) {
  if (!a || !b) return false;
  if (a.hejaCounter < n || b.hejaCounter < n) return false;
  return suffixKey(a.syllables, n) === suffixKey(b.syllables, n)
    && a.heja.join(' ') !== b.heja.join(' ');
}

/**
 * Escape a string for safe inclusion in a RegExp (avaString / rhymeKey are
 * plain ARPAbet + separators, but be defensive: "|" is a regex metachar).
 */
export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the MongoDB query fragment for finding rhymes of an analyzed word.
 *  - mode "perfect": simple equality on rhymeKey (indexed, fast).
 *  - mode "suffix":  regex on avaString anchored at the end, first syllable
 *    of the window matched by rime only (onset wildcarded), mirroring how
 *    the Persian ryhmFinding regexes avaString.
 */
export function rhymeQuery(analysis, { mode = 'perfect', syllables: n = null } = {}) {
  if (mode === 'perfect' || n === null) {
    return { rhymeKey: analysis.rhymeKey };
  }
  const count = Math.min(Math.max(1, n), analysis.hejaCounter);
  const units = analysis.avaString.split(',');
  const window = units.slice(units.length - count);
  const first = window[0].split('|')[1]; // rime only, onset free
  const rest = window.slice(1);
  const pattern = [`[^,|]*\\|${escapeRegex(first)}`, ...rest.map(escapeRegex)].join(',');
  return { avaString: new RegExp(`(^|,)${pattern}$`) };
}

export default {
  parseCmuLine,
  normalizePhones,
  syllabify,
  syllableString,
  rimeString,
  unitString,
  rhymeStartIndex,
  rhymeKey,
  nearKeyFromRhymeKey,
  suffixKey,
  analyze,
  isPerfectRhyme,
  isNearRhyme,
  isSuffixRhyme,
  rhymeQuery,
  escapeRegex,
  ARPABET_VOWELS,
};
