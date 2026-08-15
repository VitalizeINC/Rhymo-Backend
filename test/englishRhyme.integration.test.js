// Import test config first to set up environment
import testConfig from './config.js';

import { expect } from 'chai';
import mongoose from 'mongoose';
import Word from '../app/models/word.js';
import englishRhymeController from '../app/http/api/controllers/englishRhymeController.js';
import wordManageController from '../app/http/api/controllers/wordManageController.js';
import processController from '../app/http/api/controllers/processController.js';
import { parseCmuLine, analyze } from '../app/helpers/englishRhymeEngine.js';

// A miniature cmudict slice — enough for real rhyme classes.
const MINI_DICT = [
  'cat K AE1 T',
  'hat HH AE1 T',
  'acrobat AE1 K R AH0 B AE2 T',
  'station S T EY1 SH AH0 N',
  'nation N EY1 SH AH0 N',
  'creation K R IY0 EY1 SH AH0 N',
  'ration R AE1 SH AH0 N',
  'fashion F AE1 SH AH0 N',
  'master M AE1 S T ER0',
  'faster F AE1 S T ER0',
  'actor AE1 K T ER0',
  'love L AH1 V',
  'dove D AH1 V',
  'above AH0 B AH1 V',
  'move M UW1 V',
  'eight EY1 T',
  'ate EY1 T',
  'weight W EY1 T',
];

function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('English rhyme flow - Integration Test (Real Database)', () => {
  // The repo's test files share one mongoose singleton. Only open the
  // connection if nobody else has, and only close it if we opened it —
  // otherwise this suite breaks whichever suite mocha runs after it.
  let openedConnection = false;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testConfig.test.database);
      openedConnection = true;
    }
    await Word.deleteMany({ lang: 'en' });
    const docs = MINI_DICT.map((line) => {
      const rec = parseCmuLine(line);
      const a = analyze(rec.word, rec.phones);
      return {
        fullWord: rec.word,
        fullWordWithNimFaseleh: rec.word,
        word: rec.word,
        heja: a.heja,
        ava: a.ava,
        avaString: a.avaString,
        hejaCounter: a.hejaCounter,
        rhymeKey: a.rhymeKey,
        spacePositions: [],
        nimFaselehPositions: [],
        lang: 'en',
        approved: true,
        level: 1,
      };
    });
    await Word.insertMany(docs);
  });

  after(async () => {
    await Word.deleteMany({ lang: 'en' });
    if (openedConnection) {
      await mongoose.connection.close();
    }
  });

  describe('getWordDetails (lang=en, via processController delegation)', () => {
    it('resolves a known word from the seeded dictionary', async () => {
      const res = mockRes();
      await processController.getWordDetails(
        { body: { string: 'station', lang: 'en' } }, res
      );
      expect(res.statusCode).to.equal(200);
      expect(res.body.pass).to.equal(true);
      expect(res.body.result[0].db).to.equal(true);
      expect(res.body.result[0].parts).to.deep.equal(['S T EY1', 'SH AH0 N']);
      expect(res.body.totalId).to.not.equal('');
    });

    it('is case-insensitive on input', async () => {
      const res = mockRes();
      await processController.getWordDetails(
        { body: { string: 'Station', lang: 'en' } }, res
      );
      expect(res.body.pass).to.equal(true);
    });

    it('fails for unknown words (no English G2P)', async () => {
      const res = mockRes();
      await processController.getWordDetails(
        { body: { string: 'zzzznotaword', lang: 'en' } }, res
      );
      expect(res.body.pass).to.equal(false);
      expect(res.body.result[0].db).to.equal(false);
    });

    it('creates a combined document for known multi-word phrases', async () => {
      const res = mockRes();
      await processController.getWordDetails(
        { body: { string: 'love station', lang: 'en' } }, res
      );
      expect(res.body.pass).to.equal(true);
      const combined = await Word.findById(res.body.totalId);
      expect(combined.hejaCounter).to.equal(3);
      // rhymeKey must come from the LAST word's stressed syllable
      expect(combined.rhymeKey).to.equal('EY SH AH N');
    });
  });

  describe('getRhymes (lang=en, via wordManageController delegation)', () => {
    let stationId;
    before(async () => {
      // The getWordDetails suite above creates the phrase "love station",
      // which is a legitimate perfect rhyme of "station" (EY SH AH N).
      // Remove it so the exact-members assertions below stay deterministic.
      await Word.deleteOne({ fullWord: 'love station', lang: 'en' });
      stationId = (await Word.findOne({ fullWord: 'station', lang: 'en' }))._id;
    });

    it('perfect mode returns exactly the rhymeKey class, minus the word itself', async () => {
      const res = mockRes();
      await wordManageController.getRhymes(
        { query: { id: String(stationId), lang: 'en', partsNumber: '-1', filter: '', page: '1', limit: '10' } }, res
      );
      expect(res.statusCode).to.equal(200);
      expect(res.body.fullResponse).to.have.members(['nation', 'creation']);
      expect(res.body.fullResponse).to.not.include('station');
      expect(res.body.fullResponse).to.not.include('ration'); // AE, not EY
    });

    it('suffix mode (1 syllable) widens the class', async () => {
      const res = mockRes();
      await wordManageController.getRhymes(
        { query: { id: String(stationId), lang: 'en', partsNumber: '1', filter: '', page: '1', limit: '10' } }, res
      );
      expect(res.body.fullResponse).to.include.members(['nation', 'creation', 'ration', 'fashion']);
    });

    it('excludes homophones (eight/ate)', async () => {
      const eightId = (await Word.findOne({ fullWord: 'eight', lang: 'en' }))._id;
      const res = mockRes();
      await wordManageController.getRhymes(
        { query: { id: String(eightId), lang: 'en', partsNumber: '-1', filter: '', page: '1', limit: '10' } }, res
      );
      expect(res.body.fullResponse).to.include('weight');
      expect(res.body.fullResponse).to.not.include('ate');
    });

    it('applies the character filter', async () => {
      const res = mockRes();
      await wordManageController.getRhymes(
        { query: { id: String(stationId), lang: 'en', partsNumber: '-1', filter: 'cr', page: '1', limit: '10' } }, res
      );
      expect(res.body.fullResponse).to.deep.equal(['creation']);
    });

    it('paginates', async () => {
      const res = mockRes();
      await wordManageController.getRhymes(
        { query: { id: String(stationId), lang: 'en', partsNumber: '1', filter: '', page: '1', limit: '2' } }, res
      );
      expect(res.body.fullResponse).to.have.length(2);
      expect(res.body.pagination.totalItems).to.be.greaterThan(2);
      expect(res.body.pagination.hasNextPage).to.equal(true);
    });

    it('master does not rhyme with actor (perfect mode)', async () => {
      const masterId = (await Word.findOne({ fullWord: 'master', lang: 'en' }))._id;
      const res = mockRes();
      await wordManageController.getRhymes(
        { query: { id: String(masterId), lang: 'en', partsNumber: '-1', filter: '', page: '1', limit: '10' } }, res
      );
      expect(res.body.fullResponse).to.include('faster');
      expect(res.body.fullResponse).to.not.include('actor');
    });
  });

  describe('suggestWord (lang=en)', () => {
    it('suggests by prefix from the English set only', async () => {
      const res = mockRes();
      await wordManageController.suggestWord(
        { query: { string: 'sta', lang: 'en' } }, res
      );
      expect(res.statusCode).to.equal(200);
      expect(res.body.map((w) => w.fullWord)).to.include('station');
      for (const w of res.body) expect(w.lang).to.equal('en');
    });
  });

  describe('getTraditionalRhymes (lang=en)', () => {
    it('matches spelling endings', async () => {
      const stationId = (await Word.findOne({ fullWord: 'station', lang: 'en' }))._id;
      const res = mockRes();
      await wordManageController.getTraditionalRhymes(
        { query: { id: String(stationId), lang: 'en', partsNumber: '5', page: '1', limit: '10' } }, res
      );
      // words ending in "ation"
      expect(res.body.fullResponse).to.include.members(['nation', 'creation', 'ration']);
      expect(res.body.fullResponse).to.not.include('fashion');
    });
  });

  describe('language isolation', () => {
    it('Persian suggestWord does not return English words', async () => {
      const res = mockRes();
      await wordManageController.suggestWord({ query: { string: 'sta' } }, res);
      const enHits = (res.body || []).filter((w) => w.lang === 'en');
      expect(enHits).to.have.length(0);
    });
  });
});
