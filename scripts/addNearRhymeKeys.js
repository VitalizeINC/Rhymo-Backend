/**
 * One-time migration: add nearRhymeKey (slant-rhyme key) to English words
 * already seeded in the database. Derived purely from the stored rhymeKey,
 * so no re-seeding is needed. Idempotent — safe to run again.
 *
 * Usage: npm run migrate:nearkeys   (or node scripts/addNearRhymeKeys.js)
 */
import mongoose from 'mongoose';
import Word from '../app/models/word.js';
import config from '../config/index.js';
import { nearKeyFromRhymeKey } from '../app/helpers/englishRhymeEngine.js';

async function addNearRhymeKeys() {
  await mongoose.connect(config.database.url);
  console.log('Connected to MongoDB');

  const cursor = Word.find({
    lang: 'en',
    rhymeKey: { $ne: null },
    nearRhymeKey: null,
  })
    .select('rhymeKey')
    .lean()
    .cursor();

  let ops = [];
  let updated = 0;
  for await (const doc of cursor) {
    const nearKey = nearKeyFromRhymeKey(doc.rhymeKey);
    if (!nearKey) continue;
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { nearRhymeKey: nearKey } },
      },
    });
    if (ops.length >= 1000) {
      const r = await Word.bulkWrite(ops, { ordered: false });
      updated += r.modifiedCount;
      ops = [];
      process.stdout.write(`\rUpdated: ${updated}`);
    }
  }
  if (ops.length) {
    const r = await Word.bulkWrite(ops, { ordered: false });
    updated += r.modifiedCount;
  }
  console.log(`\nUpdated ${updated} words with nearRhymeKey`);

  await Word.syncIndexes();
  console.log('Indexes synced');
  await mongoose.connection.close();
  console.log('Done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  addNearRhymeKeys().catch((e) => { console.error(e); process.exit(1); });
}

export default addNearRhymeKeys;
