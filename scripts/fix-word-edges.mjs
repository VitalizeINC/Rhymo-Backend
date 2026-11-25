/**
 * One-off: remove spaces and half-spaces from the start and end of stored
 * words (see app/helpers/wordText.js).
 *
 * For each such word:
 *   - if the clean spelling already exists, move the word bank entries and
 *     note links to it, keep who asked for it, then delete the copy
 *   - otherwise, clean the word in place
 *
 *   node scripts/fix-word-edges.mjs          show what would change
 *   node scripts/fix-word-edges.mjs --apply  change it
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { cleanEnds } from '../app/helpers/wordText.js';

const APPLY = process.argv.includes('--apply');
const EDGE = /^[\s​-‏⁠﻿]|[\s​-‏⁠﻿]$/;

await mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection.db;
const Words = db.collection('words');
const Bank = db.collection('wordbanks');
const Notes = db.collection('notes');

function positions(text, ch) {
    const out = [];
    for (let i = 0; i < text.length; i++) if (text[i] === ch) out.push(i);
    return out;
}

const bad = await Words.find({
    $or: [{ fullWord: EDGE }, { fullWordWithNimFaseleh: EDGE }, { word: EDGE }],
}).toArray();
console.log(`${bad.length} words with a space or half-space at an end${APPLY ? '' : ' (dry run)'}`);

for (const w of bad) {
    const clean = cleanEnds(w.fullWord);
    const target = await Words.findOne({ fullWord: clean, _id: { $ne: w._id } });
    const bankCount = await Bank.countDocuments({ word: w._id });
    const noteCount = await Notes.countDocuments({ 'wordRefs.word': w._id });
    console.log(`- ${JSON.stringify(w.fullWord)} -> ${JSON.stringify(clean)}: ${target ? `copy of ${target._id}, merge` : 'clean in place'} (word bank ${bankCount}, notes ${noteCount})`);
    if (!APPLY) continue;

    if (target) {
        // Word bank: one entry per user and word. Move, or drop the copy's
        // entry when the user already has the real word.
        for (const e of await Bank.find({ word: w._id }).toArray()) {
            const has = await Bank.findOne({ user: e.user, word: target._id });
            if (has) {
                await Bank.updateOne({ _id: has._id }, { $inc: { useCount: e.useCount || 0 } });
                await Bank.deleteOne({ _id: e._id });
            } else {
                await Bank.updateOne({ _id: e._id }, { $set: { word: target._id, fullWord: target.fullWord, solidWord: target.word } });
            }
        }
        await Notes.updateMany(
            { 'wordRefs.word': w._id },
            { $set: { 'wordRefs.$[r].word': target._id, 'wordRefs.$[r].fullWord': target.fullWord } },
            { arrayFilters: [{ 'r.word': w._id }] },
        );
        // Whoever asked for the copy still sees the real word while it waits.
        const askers = [w.user, ...(w.requestedBy || [])].filter(Boolean)
            .filter((u) => !(target.user && String(target.user) === String(u)));
        if (!target.approved && askers.length) {
            await Words.updateOne({ _id: target._id }, { $addToSet: { requestedBy: { $each: askers } } });
        }
        // The admin already approved the copy: that approval is for this word.
        if (w.approved && !target.approved) {
            await Words.updateOne({ _id: target._id }, { $set: { approved: true } });
            console.log(`  approved ${JSON.stringify(target.fullWord)}, as its copy was`);
        }
        await Words.deleteOne({ _id: w._id });
    } else {
        const withHalf = cleanEnds(w.fullWordWithNimFaseleh || w.fullWord);
        await Words.updateOne({ _id: w._id }, {
            $set: {
                fullWord: clean,
                fullWordWithNimFaseleh: withHalf,
                word: cleanEnds(w.word),
                spacePositions: positions(withHalf, ' '),
                nimFaselehPositions: positions(withHalf, '‌'),
            },
        });
        await Bank.updateMany({ word: w._id }, { $set: { fullWord: clean, solidWord: cleanEnds(w.word) } });
        await Notes.updateMany(
            { 'wordRefs.word': w._id },
            { $set: { 'wordRefs.$[r].fullWord': clean } },
            { arrayFilters: [{ 'r.word': w._id }] },
        );
    }
}

const left = await Words.countDocuments({ $or: [{ fullWord: EDGE }, { fullWordWithNimFaseleh: EDGE }, { word: EDGE }] });
console.log(`left with a space or half-space at an end: ${left}`);
await mongoose.disconnect();
