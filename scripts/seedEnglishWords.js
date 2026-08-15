/**
 * Seed the Word collection with the English dictionary (CMU Pronouncing
 * Dictionary), pre-analyzed by the English rhyme engine.
 *
 * Usage:
 *   npm run seed:english              (expects resource/cmudict.dict)
 *   node scripts/seedEnglishWords.js path/to/cmudict.dict
 *
 * Idempotent: words already present (same fullWord) are skipped via the
 * unique index on fullWord (ordered:false insertMany).
 * Only primary pronunciations are seeded; variant entries "word(2)" are
 * skipped so fullWord stays unique and results contain no duplicates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import Word from '../app/models/word.js';
import config from '../config/index.js';
import { parseCmuLine, analyze } from '../app/helpers/englishRhymeEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dictPath = process.argv[2] || path.join(__dirname, '..', 'resource', 'cmudict.dict');

async function seedEnglishWords() {
  const lines = fs.readFileSync(dictPath, 'utf8').split('\n');
  console.log(`Read ${lines.length} lines from ${dictPath}`);

  await mongoose.connect(config.database.url);
  console.log('Connected to MongoDB');

  const existing = await Word.countDocuments({ lang: 'en' });
  console.log(`English words already in DB: ${existing}`);

  let batch = [];
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  const flush = async () => {
    if (!batch.length) return;
    try {
      const r = await Word.insertMany(batch, { ordered: false });
      inserted += r.length;
    } catch (e) {
      // Duplicate-key errors are expected on re-runs; count what got in.
      const ok = e.insertedDocs ? e.insertedDocs.length : 0;
      inserted += ok;
      skipped += batch.length - ok;
    }
    batch = [];
  };

  for (const line of lines) {
    const rec = parseCmuLine(line);
    if (!rec) continue;
    if (rec.variant > 1) { skipped++; continue; }
    const a = analyze(rec.word, rec.phones);
    if (!a) { failed++; continue; } // vowel-less interjections (hmm, shh...)

    batch.push({
      fullWord: rec.word,
      fullWordWithNimFaseleh: rec.word,
      word: rec.word,
      heja: a.heja,
      ava: a.ava,
      avaString: a.avaString,
      hejaCounter: a.hejaCounter,
      rhymeKey: a.rhymeKey,
      nearRhymeKey: a.nearRhymeKey,
      spacePositions: [],
      nimFaselehPositions: [],
      lang: 'en',
      approved: true,
      level: 1,
    });
    if (batch.length >= 1000) await flush();
  }
  await flush();

  console.log(`Inserted: ${inserted}, skipped (variants/duplicates): ${skipped}, unanalyzable: ${failed}`);
  await Word.syncIndexes();
  console.log('Indexes synced (lang, rhymeKey)');
  await mongoose.connection.close();
  console.log('Done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedEnglishWords().catch((e) => { console.error(e); process.exit(1); });
}

export default seedEnglishWords;
