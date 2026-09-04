// Import test config first to set up environment
import testConfig from './config.js';

import { expect } from 'chai';
import mongoose from 'mongoose';
import Word from '../app/models/word.js';
import wordManageController from '../app/http/api/controllers/wordManageController.js';

/**
 * قافیهٔ ترکیبی — the invariant this suite exists to protect.
 *
 * Two rhymes standing side by side are HEARD as one word: their هجا and آوا are
 * merged for the length of one request, and the rhyme search runs against that
 * merged sound. They are never STORED as one word — «بازپرس بخشنده» must not
 * become a Word document, or the dictionary would slowly fill with phrases that
 * no one wrote as words.
 *
 * So: behaves like one word, is never added as one.
 */

const TAG = 'CMPTEST';
const fake = () => {
    const res = {};
    res.status = (code) => { res.code = code; return res; };
    res.json = (payload) => { res.payload = payload; return res; };
    return res;
};

const seed = (fullWord, ava) =>
    new Word({
        fullWord,
        fullWordWithNimFaseleh: fullWord,
        word: fullWord,
        heja: ava.map((_, i) => `${TAG}${i}`),
        ava,
        avaString: ava.join(','),
        hejaCounter: ava.length,
        nimFaselehPositions: [],
        spacePositions: [],
    }).save();

describe('getCompoundRhymes - Integration Test (Real Database)', () => {
    let first;   // اَ - آ
    let second;  // اُ
    let single;  // اَ - آ - اُ   (one word carrying the whole compound)
    let tailish; // اِ - آ - اُ   (rhymes on the tail, not the whole thing)

    before(async () => {
        await mongoose.connect(testConfig.test.database);
        await Word.deleteMany({ fullWord: new RegExp(`^${TAG}`) });

        first = await seed(`${TAG}_first`, ['اَ', 'آ']);
        second = await seed(`${TAG}_second`, ['اُ']);
        single = await seed(`${TAG}_single`, ['اَ', 'آ', 'اُ']);
        tailish = await seed(`${TAG}_tailish`, ['اِ', 'آ', 'اُ']);
    });

    after(async () => {
        await Word.deleteMany({ fullWord: new RegExp(`^${TAG}`) });
        await mongoose.connection.close();
    });

    it('hears the two words as one: هجا and آوا are merged in order', async () => {
        const res = fake();
        await wordManageController.getCompoundRhymes(
            { query: { ids: `${first._id},${second._id}`, limit: 20 }, user: { id: String(new mongoose.Types.ObjectId()) } },
            res
        );

        expect(res.code).to.equal(200);
        // `compound` is the word that existed for this request only. (The
        // top-level `heja` belongs to the ANSWERS, as in every rhyme search.)
        expect(res.payload.compound.ava).to.deep.equal(['اَ', 'آ', 'اُ']);
        expect(res.payload.compound.heja).to.deep.equal([...first.heja, ...second.heja]);
        expect(res.payload.compound.avaString).to.equal('اَ,آ,اُ');
        expect(res.payload.compound.fullWord).to.equal(`${TAG}_first ${TAG}_second`);
        expect(res.payload.selectedWord.hejaCounter).to.equal(3);
    });

    it('answers only with real words from the dictionary — nothing assembled', async () => {
        const res = fake();
        await wordManageController.getCompoundRhymes(
            { query: { ids: `${first._id},${second._id}`, limit: 40, professional: 'false' }, user: { id: String(new mongoose.Types.ObjectId()) } },
            res
        );

        expect(res.code).to.equal(200);
        const ids = res.payload.ids.map(String);
        expect(ids.length).to.be.greaterThan(0);

        // Every answer is a Word that exists on its own.
        for (const id of ids) {
            expect(await Word.findById(id)).to.not.equal(null);
        }
        // The whole-sound match is there; a member of the compound is not.
        expect(res.payload.fullResponse).to.include(`${TAG}_single`);
        expect(res.payload.fullResponse).to.not.include(`${TAG}_first`);
        expect(res.payload.fullResponse).to.not.include(`${TAG}_second`);
    });

    it('reports which part of the compound the answers rhyme on', async () => {
        const res = fake();
        await wordManageController.getCompoundRhymes(
            { query: { ids: `${first._id},${second._id}`, limit: 40, professional: 'false' }, user: { id: String(new mongoose.Types.ObjectId()) } },
            res
        );

        expect(res.payload.compound.hejaCounter).to.equal(3);
        expect(res.payload.matchedParts).to.equal(3);
        expect(res.payload.matchedWhole).to.equal(true);
    });

    it('falls back to the tail when nothing carries the whole sound', async () => {
        // A compound long enough that only its tail can be answered.
        const long = await seed(`${TAG}_long`, ['او', 'اَ', 'آ', 'اُ']);
        const res = fake();
        await wordManageController.getCompoundRhymes(
            { query: { ids: `${long._id},${second._id}`, limit: 40, professional: 'false' }, user: { id: String(new mongoose.Types.ObjectId()) } },
            res
        );

        expect(res.payload.compound.hejaCounter).to.equal(5);
        expect(res.payload.matchedParts).to.be.lessThan(5);
        expect(res.payload.matchedWhole).to.equal(false);
    });

    it('NEVER stores the compound as a word of its own', async () => {
        const before = await Word.countDocuments();

        const res = fake();
        await wordManageController.getCompoundRhymes(
            { query: { ids: `${first._id},${second._id}`, limit: 40 }, user: { id: String(new mongoose.Types.ObjectId()) } },
            res
        );

        expect(await Word.countDocuments()).to.equal(before);
        expect(await Word.findOne({ fullWord: `${TAG}_first ${TAG}_second` })).to.equal(null);
        expect(await Word.findOne({ avaString: 'اَ,آ,اُ', fullWord: /\s/ })).to.equal(null);
        // The members themselves are untouched.
        const reread = await Word.findById(first._id);
        expect(reread.ava).to.deep.equal(['اَ', 'آ']);
    });

    it('needs at least two members to be a compound', async () => {
        const res = fake();
        await wordManageController.getCompoundRhymes(
            { query: { ids: String(first._id) }, user: { id: String(new mongoose.Types.ObjectId()) } },
            res
        );
        expect(res.code).to.equal(400);
    });
});
