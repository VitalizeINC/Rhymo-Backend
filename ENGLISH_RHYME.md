# English Rhyme Support

English rhyme finding for Rhymo, mirroring the Persian pipeline. The user picks a language on first launch (before onboarding); the app then sends `lang=fa|en` with every rhyme-related request and the backend routes English requests to a CMU-dictionary-based engine.

## How the Persian and English pipelines correspond

| Persian | English |
|---|---|
| Diacritized spelling → syllables via `process()` | CMU Pronouncing Dictionary (ARPAbet + stress) → syllables via maximal-onset syllabifier |
| `heja` = syllable strings | `heja` = ARPAbet syllables, e.g. `["S T EY1", "SH AH0 N"]` |
| `ava` = vowel nucleus per syllable | `ava` = rime (nucleus + coda) per syllable, e.g. `["EY1", "AH0 N"]` |
| `avaString` = comma-joined ava, regex-matched | `avaString` = comma-joined `onset\|rime` units (stress-stripped), regex-matched for suffix mode |
| "professional" filter (open/closed syllable match) | `rhymeKey` = phones from the last stressed vowel to the end; equality = **perfect rhyme** |
| `getTraditionalRhymes` = same trailing letters | same, on English spelling |

New Word model fields: `lang: 'fa'|'en'` (legacy docs without the field are treated as Persian via `lang: {$ne:'en'}` queries) and `rhymeKey` (English only, indexed).

## partsNumber semantics for English

- `-1` (default): perfect rhyme — matches from the last stressed vowel (station → nation, creation; NOT ration).
- `N ≥ 1`: suffix rhyme over the last N syllables (looser; N=1 for station also gives ration/fashion).

## Files

- `app/helpers/englishRhymeEngine.js` — pure engine: parse, syllabify, rhymeKey, DB query builders. No IO, fully unit-tested.
- `app/http/api/controllers/englishRhymeController.js` — English handlers for `getWordDetails`, `getRhymes`, `getTraditionalRhymes`, `suggestWord`.
- `processController` / `wordManageController` / `notepadController` — delegate to the English controller when `lang=en`; Persian queries now exclude `lang:'en'` docs.
- `scripts/seedEnglishWords.js` — seeds ~126k analyzed words from `resource/cmudict.dict`.
- `scripts/validateEnglishEngine.js` — full-dictionary validation (all 135,166 entries + 78 gold rhyme/non-rhyme checks + exact simulation of the MongoDB queries).
- `test/englishRhymeEngine.test.js` — 51 unit tests (mocha).
- `test/englishRhyme.integration.test.js` — end-to-end controller tests against the test DB.

## Setup

```bash
npm run seed:english        # one-time: load cmudict into MongoDB
npm run validate:english    # offline engine validation (no DB needed)
npm test                    # runs unit + integration tests
```

## Notes / known limitations

- Only primary CMU pronunciations are seeded ("read" is seeded as R EH1 D). Variant support would require relaxing the unique `fullWord` index.
- CMUdict's IY/IH inconsistency before R is normalized (here/sincere, zero/hero rhyme correctly).
- The rhyme-part highlight for English results is proportional (phoneme→letter alignment is not exact in English); traditional mode highlights are exact.
- Unknown English words return `pass: false` — there is no English equivalent of the Persian add-word (اعراب‌گذاری) flow.
