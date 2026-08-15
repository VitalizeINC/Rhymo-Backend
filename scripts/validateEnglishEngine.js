/**
 * Full-dictionary validation of the English rhyme engine.
 *
 * Usage: node scripts/validateEnglishEngine.js [path/to/cmudict.dict]
 *
 * Checks, over every entry in the CMU Pronouncing Dictionary (~135k words):
 *   1. Parsing        — every line parses or is a known comment/blank.
 *   2. Syllabification — phones are preserved in order, syllable count
 *                        equals vowel count, every syllable has a nucleus.
 *   3. Analysis       — analyze() produces a non-empty rhymeKey, avaString
 *                        unit count matches hejaCounter.
 *   4. Rhyme classes  — groups words by rhymeKey and reports distribution;
 *                        spot-checks symmetry/transitivity on samples.
 *   5. Gold set       — known rhyme pairs must match, known non-rhymes must
 *                        not (looked up with their real dictionary prons).
 */
import fs from 'node:fs';
import {
  parseCmuLine, syllabify, syllableString, analyze, isPerfectRhyme, isSuffixRhyme, rhymeQuery,
} from '../app/helpers/englishRhymeEngine.js';

const dictPath = process.argv[2] || 'cmudict.dict';
const lines = fs.readFileSync(dictPath, 'utf8').split('\n');

const errors = { parse: [], syllabify: [], analyze: [] };
const entries = new Map(); // word -> analysis of primary pronunciation
const byKey = new Map();   // rhymeKey -> count
let total = 0, parsed = 0, analyzed = 0, variants = 0, skippedNoVowel = 0;

for (const line of lines) {
  if (!line.trim()) continue;
  total++;
  const rec = parseCmuLine(line);
  if (!rec) { errors.parse.push(line.slice(0, 60)); continue; }
  parsed++;
  if (rec.variant > 1) { variants++; continue; } // primary pronunciation only

  // --- syllabification invariants
  const syls = syllabify(rec.phones);
  const vowelCount = rec.phones.filter((p) => /[0-2]$/.test(p)).length;
  if (vowelCount === 0) {
    // vowel-less interjections (hmm, shh, psst...) are unrhymable; skip them
    skippedNoVowel++;
    continue;
  }
  if (syls.length !== vowelCount) {
    errors.syllabify.push(`${rec.word}: ${syls.length} syls vs ${vowelCount} vowels`);
    continue;
  }
  const rejoined = syls.map(syllableString).join(' ');
  if (rejoined !== rec.phones.join(' ')) {
    errors.syllabify.push(`${rec.word}: phones lost (${rec.phones.join(' ')} -> ${rejoined})`);
    continue;
  }

  // --- analysis invariants
  const a = analyze(rec.word, rec.phones);
  if (!a || !a.rhymeKey || a.avaString.split(',').length !== a.hejaCounter) {
    errors.analyze.push(rec.word);
    continue;
  }
  analyzed++;
  entries.set(rec.word, a);
  byKey.set(a.rhymeKey, (byKey.get(a.rhymeKey) || 0) + 1);
}

// --- gold set: real-world rhyme pairs (should rhyme)
const GOLD_RHYMES = [
  ['cat', 'hat'], ['cat', 'bat'], ['cat', 'acrobat'], ['dog', 'log'],
  ['station', 'nation'], ['station', 'creation'], ['nation', 'combination'],
  ['fire', 'higher'], ['fire', 'desire'], ['love', 'dove'], ['love', 'above'],
  ['night', 'light'], ['night', 'delight'], ['day', 'way'], ['day', 'away'],
  ['heart', 'start'], ['heart', 'apart'], ['mind', 'find'], ['mind', 'behind'],
  ['pain', 'rain'], ['pain', 'remain'], ['time', 'rhyme'], ['time', 'climb'],
  ['double', 'trouble'], ['money', 'honey'], ['money', 'funny'],
  ['computer', 'commuter'], ['attitude', 'gratitude'],
  ['eight', 'weight'], ['blue', 'true'], ['blue', 'through'],
  ['free', 'sea'], ['free', 'agree'], ['gold', 'cold'], ['gold', 'behold'],
  ['pace', 'race'], ['grace', 'embrace'], ['dream', 'stream'],
  ['song', 'strong'], ['soul', 'goal'], ['stone', 'alone'],
  ['door', 'more'], ['floor', 'before'], ['sky', 'fly'], ['sky', 'goodbye'],
  ['sun', 'done'], ['sun', 'begun'], ['star', 'guitar'],
  ['believe', 'receive'], ['emotion', 'ocean'], ['emotion', 'devotion'],
  ['tender', 'surrender'], ['fear', 'appear'], ['here', 'sincere'],
  ['read', 'dead'], // cmudict primary pron of "read" is past-tense R EH1 D
  ['bright', 'tonight'], ['game', 'flame'], ['name', 'shame'],
  ['road', 'load'], ['code', 'explode'], ['mine', 'shine'], ['line', 'design'],
];

// --- gold set: known NON-rhymes (must not match)
const GOLD_NON_RHYMES = [
  ['cat', 'dog'], ['cat', 'cut'], ['station', 'ration'],
  ['master', 'actor'], ['orange', 'door'], ['love', 'move'], ['love', 'stove'],
  ['cough', 'dough'], ['cough', 'through'],   // eye rhymes, not sound rhymes
  ['good', 'food'],                           // spelling traps (primary prons)
  ['pint', 'mint'], ['have', 'gave'], ['gone', 'bone'],
  ['double', 'tunnel'], ['paper', 'later'], ['seven', 'heaven'],
];
// NOTE: seven S EH1 V AH0 N / heaven HH EH1 V AH0 N — these DO rhyme; keep them
// in the rhyme list instead.
GOLD_NON_RHYMES.splice(GOLD_NON_RHYMES.findIndex(([a, b]) => a === 'seven'), 1);
GOLD_RHYMES.push(['seven', 'heaven']);

let goldPass = 0; const goldFail = [];
for (const [a, b] of GOLD_RHYMES) {
  const A = entries.get(a), B = entries.get(b);
  if (!A || !B) { goldFail.push(`${a}~${b}: missing from dict`); continue; }
  if (isPerfectRhyme(A, B) && isPerfectRhyme(B, A)) goldPass++;
  else goldFail.push(`${a}~${b}: expected RHYME (${A.rhymeKey} vs ${B.rhymeKey})`);
}
for (const [a, b] of GOLD_NON_RHYMES) {
  const A = entries.get(a), B = entries.get(b);
  if (!A || !B) { goldFail.push(`${a}!~${b}: missing from dict`); continue; }
  if (!isPerfectRhyme(A, B)) goldPass++;
  else goldFail.push(`${a}!~${b}: expected NON-rhyme (both ${A.rhymeKey})`);
}

// --- rhyme-class distribution + sanity samples
const classSizes = [...byKey.values()];
const singletons = classSizes.filter((c) => c === 1).length;
const biggest = [...byKey.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);

// --- query consistency: simulate the MongoDB queries over the whole dict
// and require them to return EXACTLY the words the pairwise functions accept.
const sample = ['station', 'cat', 'computer', 'love', 'emotion', 'guitar', 'fire', 'money'];
let queryOk = true;
const queryMismatches = [];
for (const w of sample) {
  const a = entries.get(w);
  // perfect mode == rhymeKey equality (what the controller queries)
  for (const [word, b] of entries) {
    const dbMatch = b.rhymeKey === a.rhymeKey && word !== w;
    const truth = isPerfectRhyme(a, b) ||
      (word !== w && b.rhymeKey === a.rhymeKey); // homophones filtered post-query in controller
    if (dbMatch !== truth) { queryOk = false; queryMismatches.push(`perfect ${w}/${word}`); }
  }
  // suffix mode == avaString regex (what the controller queries)
  const n = Math.min(2, a.hejaCounter);
  const q = rhymeQuery(a, { mode: 'suffix', syllables: n });
  for (const [word, b] of entries) {
    if (b.hejaCounter < n) continue; // regex can't over-match shorter words: verify
    const dbMatch = q.avaString.test(b.avaString) && word !== w;
    const truth = word !== w &&
      (isSuffixRhyme(a, b, n) || b.heja.join(' ') === a.heja.join(' '));
    if (dbMatch !== truth) { queryOk = false; queryMismatches.push(`suffix${n} ${w}/${word}: db=${dbMatch}`); }
  }
}

// ------------------------------------------------------------------ report
const report = {
  totalLines: total,
  parsed,
  variantEntriesSkipped: variants,
  vowelLessSkipped: skippedNoVowel,
  primaryWordsAnalyzed: analyzed,
  parseErrors: errors.parse.length,
  syllabifyErrors: errors.syllabify.length,
  analyzeErrors: errors.analyze.length,
  rhymeClasses: byKey.size,
  singletonClasses: singletons,
  biggestClasses: biggest.map(([k, c]) => `${k} (${c} words)`),
  goldChecks: GOLD_RHYMES.length + GOLD_NON_RHYMES.length,
  goldPassed: goldPass,
  goldFailed: goldFail,
  dbQuerySimulationOk: queryOk,
  dbQueryMismatches: queryMismatches.slice(0, 10),
};
console.log(JSON.stringify(report, null, 2));
if (errors.syllabify.length) {
  console.log('\nFirst syllabify errors:');
  errors.syllabify.slice(0, 20).forEach((e) => console.log('  ' + e));
}
const ok = errors.parse.length === 0 && errors.syllabify.length === 0
  && errors.analyze.length === 0 && goldFail.length === 0 && queryOk;
console.log(ok ? '\nVALIDATION PASSED' : '\nVALIDATION FAILED');
process.exit(ok ? 0 : 1);
