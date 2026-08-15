/**
 * Unit tests for the English rhyme engine (app/helpers/englishRhymeEngine.js).
 *
 * Runs under mocha (like the rest of the repo's tests):
 *   npx mocha test/englishRhymeEngine.test.js
 *
 * Uses node's built-in assert so it has no extra dependencies.
 */
import assert from 'node:assert/strict';
import {
  parseCmuLine,
  syllabify,
  syllableString,
  rimeString,
  rhymeStartIndex,
  rhymeKey,
  nearKeyFromRhymeKey,
  suffixKey,
  analyze,
  isPerfectRhyme,
  isNearRhyme,
  isSuffixRhyme,
  rhymeQuery,
} from '../app/helpers/englishRhymeEngine.js';

// Small embedded pronunciation table (verbatim from cmudict) so unit tests
// don't need the dictionary file on disk.
const P = {
  cat: 'K AE1 T',
  hat: 'HH AE1 T',
  acrobat: 'AE1 K R AH0 B AE2 T',
  station: 'S T EY1 SH AH0 N',
  nation: 'N EY1 SH AH0 N',
  creation: 'K R IY0 EY1 SH AH0 N',
  ration: 'R AE1 SH AH0 N',
  fashion: 'F AE1 SH AH0 N',
  master: 'M AE1 S T ER0',
  faster: 'F AE1 S T ER0',
  passer: 'P AE1 S ER0',
  actor: 'AE1 K T ER0',
  orange: 'AO1 R AH0 N JH',
  door: 'D AO1 R',
  more: 'M AO1 R',
  double: 'D AH1 B AH0 L',
  trouble: 'T R AH1 B AH0 L',
  bubble: 'B AH1 B AH0 L',
  tunnel: 'T AH1 N AH0 L',
  fire: 'F AY1 ER0',
  higher: 'HH AY1 ER0',
  liar: 'L AY1 ER0',
  the: 'DH AH0',
  a: 'AH0',
  computer: 'K AH0 M P Y UW1 T ER0',
  commuter: 'K AH0 M Y UW1 T ER0',
  strengths: 'S T R EH1 NG K TH S',
  rhythm: 'R IH1 DH AH0 M',
  attitude: 'AE1 T AH0 T UW2 D',
  gratitude: 'G R AE1 T AH0 T UW2 D',
  eight: 'EY1 T',
  ate: 'EY1 T',
  weight: 'W EY1 T',
  here: 'HH IY1 R',
  sincere: 'S IH0 N S IH1 R',
  zero: 'Z IY1 R OW0',
  hero: 'HH IH1 R OW0',
  palms: 'P AA1 M Z',
  arms: 'AA1 R M Z',
  bars: 'B AA1 R Z',
  sweaty: 'S W EH1 T IY0',
  heavy: 'HH EH1 V IY0',
  ready: 'R EH1 D IY0',
  cap: 'K AE1 P',
};

const ph = (w) => P[w].split(' ');
const an = (w) => analyze(w, ph(w));

describe('englishRhymeEngine', () => {
  describe('parseCmuLine', () => {
    it('parses a simple line', () => {
      const r = parseCmuLine('station S T EY1 SH AH0 N');
      assert.equal(r.word, 'station');
      assert.equal(r.variant, 1);
      assert.deepEqual(r.phones, ['S', 'T', 'EY1', 'SH', 'AH0', 'N']);
    });
    it('parses variant entries like word(2)', () => {
      const r = parseCmuLine('read(2) R EH1 D');
      assert.equal(r.word, 'read');
      assert.equal(r.variant, 2);
    });
    it('drops comments and blank lines', () => {
      assert.equal(parseCmuLine('# a comment'), null);
      assert.equal(parseCmuLine('   '), null);
      const r = parseCmuLine("aujourd'hui OW2 ZH UH0 R D W IY1 # French");
      assert.equal(r.word, "aujourd'hui");
    });
  });

  describe('syllabify', () => {
    it('one syllable word keeps all consonants', () => {
      const s = syllabify(ph('cat'));
      assert.equal(s.length, 1);
      assert.equal(syllableString(s[0]), 'K AE1 T');
    });
    it('heavy cluster word (strengths) stays one syllable', () => {
      const s = syllabify(ph('strengths'));
      assert.equal(s.length, 1);
      assert.equal(syllableString(s[0]), 'S T R EH1 NG K TH S');
    });
    it('station -> S T EY1 / SH AH0 N (maximal onset gives SH to syllable 2)', () => {
      const s = syllabify(ph('station'));
      assert.deepEqual(s.map(syllableString), ['S T EY1', 'SH AH0 N']);
    });
    it('master -> M AE1 / S T ER0 (ST is a legal onset)', () => {
      const s = syllabify(ph('master'));
      assert.deepEqual(s.map(syllableString), ['M AE1', 'S T ER0']);
    });
    it('actor -> AE1 K / T ER0 (KT is not a legal onset)', () => {
      const s = syllabify(ph('actor'));
      assert.deepEqual(s.map(syllableString), ['AE1 K', 'T ER0']);
    });
    it('syllable count equals vowel count for every test word', () => {
      for (const w of Object.keys(P)) {
        const phones = ph(w);
        const vowels = phones.filter((p) => /[0-2]$/.test(p)).length;
        assert.equal(syllabify(phones).length, vowels, w);
      }
    });
    it('preserves every phone in order', () => {
      for (const w of Object.keys(P)) {
        const s = syllabify(ph(w));
        const rejoined = s.map(syllableString).join(' ');
        assert.equal(rejoined, P[w], w);
      }
    });
  });

  describe('rhymeStartIndex / rhymeKey', () => {
    it('uses the last primary stress', () => {
      const s = syllabify(ph('creation')); // K R IY0 EY1 SH AH0 N
      assert.equal(rhymeStartIndex(s), 1);
      assert.equal(rhymeKey(s), 'EY SH AH N');
    });
    it('falls back to secondary stress (acrobat rhymes on -bat)', () => {
      const s = syllabify(ph('acrobat')); // AE1 ... AE2 T -> last stressed is AE2
      assert.equal(rhymeKey(s), 'AE T');
    });
    it('falls back to last syllable for unstressed words', () => {
      const s = syllabify(ph('the'));
      assert.equal(rhymeKey(s), 'AH');
    });
    it('strips stress from the key', () => {
      assert.equal(rhymeKey(syllabify(ph('cat'))), 'AE T');
      assert.equal(rhymeKey(syllabify(ph('hat'))), 'AE T');
    });
  });

  describe('suffixKey', () => {
    it('last 1 syllable of station is the rime AH N', () => {
      assert.equal(suffixKey(syllabify(ph('station')), 1), 'AH N');
    });
    it('last 2 syllables of station wildcard the first onset', () => {
      assert.equal(suffixKey(syllabify(ph('station')), 2), 'EY SH AH N');
    });
    it('clamps n to the syllable count', () => {
      assert.equal(suffixKey(syllabify(ph('cat')), 5), 'AE T');
    });
  });

  describe('isPerfectRhyme (gold pairs)', () => {
    const rhymes = [
      ['cat', 'hat'],
      ['cat', 'acrobat'],
      ['station', 'nation'],
      ['station', 'creation'],
      ['ration', 'fashion'],
      ['master', 'faster'],
      ['door', 'more'],
      ['double', 'trouble'],
      ['double', 'bubble'],
      ['fire', 'higher'],
      ['fire', 'liar'],
      ['computer', 'commuter'],
      ['attitude', 'gratitude'],
      ['eight', 'weight'],
      ['here', 'sincere'], // IY R / IH R merger before R
      ['zero', 'hero'],
    ];
    for (const [a, b] of rhymes) {
      it(`${a} ~ ${b}`, () => {
        assert.equal(isPerfectRhyme(an(a), an(b)), true);
        assert.equal(isPerfectRhyme(an(b), an(a)), true, 'symmetric');
      });
    }

    const nonRhymes = [
      ['cat', 'station'],
      ['master', 'passer'],   // AE S T ER vs AE S ER
      ['master', 'actor'],    // AE S T ER vs AE K T ER
      ['orange', 'door'],
      ['double', 'tunnel'],   // AH B AH L vs AH N AH L
      ['station', 'ration'],  // EY SH AH N vs AE SH AH N
      ['rhythm', 'the'],
    ];
    for (const [a, b] of nonRhymes) {
      it(`${a} !~ ${b}`, () => {
        assert.equal(isPerfectRhyme(an(a), an(b)), false);
      });
    }

    it('rejects homophones (eight/ate) as rhymes of themselves', () => {
      assert.equal(isPerfectRhyme(an('eight'), an('ate')), false);
    });
    it('rejects identity', () => {
      assert.equal(isPerfectRhyme(an('cat'), an('cat')), false);
    });
  });

  describe('near (slant) rhymes', () => {
    it('derives the near key from the rhymeKey', () => {
      assert.equal(nearKeyFromRhymeKey('AA M Z'), 'AA|Z');   // palms
      assert.equal(nearKeyFromRhymeKey('AA R M Z'), 'AA|Z'); // arms
      assert.equal(nearKeyFromRhymeKey('EH T IY'), 'EH IY|-'); // sweaty
      assert.equal(nearKeyFromRhymeKey(''), null);
    });
    const nears = [
      ['palms', 'arms'],
      ['palms', 'bars'],
      ['sweaty', 'heavy'],
      ['sweaty', 'ready'],
      ['heavy', 'ready'],
    ];
    for (const [a, b] of nears) {
      it(`${a} ~near~ ${b} (and not perfect)`, () => {
        assert.equal(isNearRhyme(an(a), an(b)), true);
        assert.equal(isNearRhyme(an(b), an(a)), true, 'symmetric');
        assert.equal(isPerfectRhyme(an(a), an(b)), false);
      });
    }
    it('cat is NOT a near rhyme of cap (different final consonant)', () => {
      assert.equal(isNearRhyme(an('cat'), an('cap')), false);
    });
    it('perfect rhymes are not reported as near rhymes', () => {
      assert.equal(isNearRhyme(an('cat'), an('hat')), false);
    });
  });

  describe('isSuffixRhyme (partsNumber semantics)', () => {
    it('1-syllable suffix: station ~ tunnel is false (AH N vs AH L)', () => {
      assert.equal(isSuffixRhyme(an('station'), an('tunnel'), 1), false);
    });
    it('1-syllable suffix: station ~ ration', () => {
      assert.equal(isSuffixRhyme(an('station'), an('ration'), 1), true);
    });
    it('2-syllable suffix: station !~ ration (EY vs AE)', () => {
      assert.equal(isSuffixRhyme(an('station'), an('ration'), 2), false);
    });
    it('rejects words with fewer syllables than n', () => {
      assert.equal(isSuffixRhyme(an('cat'), an('station'), 2), false);
    });
  });

  describe('analyze', () => {
    it('produces the Word-model shape', () => {
      const a = an('station');
      assert.deepEqual(a.heja, ['S T EY1', 'SH AH0 N']);
      assert.deepEqual(a.ava, ['EY1', 'AH0 N']);
      assert.equal(a.avaString, 'S T|EY,SH|AH N');
      assert.equal(a.hejaCounter, 2);
      assert.equal(a.rhymeKey, 'EY SH AH N');
    });
    it('returns null for vowel-less input', () => {
      assert.equal(analyze('psst', ['P', 'S', 'T']), null);
    });
  });

  describe('rhymeQuery', () => {
    it('perfect mode queries rhymeKey equality', () => {
      const q = rhymeQuery(an('station'));
      assert.deepEqual(q, { rhymeKey: 'EY SH AH N' });
    });
    it('suffix mode builds an end-anchored avaString regex', () => {
      const q = rhymeQuery(an('station'), { mode: 'suffix', syllables: 1 });
      assert.ok(q.avaString instanceof RegExp);
      assert.ok(q.avaString.test(an('nation').avaString), 'nation matches');
      assert.ok(q.avaString.test(an('ration').avaString), 'ration matches');
      assert.ok(!q.avaString.test(an('tunnel').avaString), 'tunnel does not');
    });
    it('suffix regex wildcards only the first onset', () => {
      const q = rhymeQuery(an('station'), { mode: 'suffix', syllables: 2 });
      assert.ok(q.avaString.test(an('nation').avaString), 'nation matches on 2');
      assert.ok(q.avaString.test(an('creation').avaString), 'creation matches on 2');
      assert.ok(!q.avaString.test(an('ration').avaString), 'ration rejected on 2');
    });
  });
});
