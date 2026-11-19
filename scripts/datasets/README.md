# Dataset import (KaamelDict, HomoRich)

Builds dictionary words straight from a dataset's pronunciation, on the server.
Every word is added waiting for admin approval, with `dataset` set, and
`commonRank` (place in an everyday-speech frequency list) so the admin lists
show common words first.

Why not the old batch flow: replaying all 134k old batch records through the
old syllable splitter gave the dataset's vowels for only 67% of them. Here the
syllables are cut from the sounds, so the vowels always match the dataset.

Files (run from a folder on the server that has the data files):
- `aligner.py`: spelling + pronunciation → marked spelling, heja, ava.
- `check.py`, `extract.py`, `extract2.py`: HomoRich sentences → `pairs.json`
  (word, pronunciation, count), keeping only pronunciations that fit the
  spelling letter by letter.
- `import_datasets.py`: test run by default; `--apply` to write. Backs up and
  rebuilds waiting KaamelDict words nobody edited, owns or asked for; adds
  missing KaamelDict readings (extra readings only when modern text uses them)
  and HomoRich words; never changes approved words; writes
  `approved-disagree.tsv` for review.

Data on the server (`/root/modern`): `homorich.parquet` (HomoRich-G2P-Persian,
CC0), `fa_full.txt` (hermitdave/FrequencyWords, OpenSubtitles 2018),
`/root/kaamel/KaamelDict.csv`. Python venv with pyarrow and pymongo.

More datasets:
- `analyze_more.py <db words tsv>`: reads `persiang2p.csv` (same sentences
  as HomoRich: nothing new) and `neurai.csv` (Neurai/Persian_G2P, AFL-3.0,
  everyday spoken Persian; its sound symbols ' Q ɡ are converted), counts
  new words and writes `pairs-<Name>.json`.
- `import_extra.py <Name> [--apply]`: adds one such dataset as its own
  waiting list, with the same checks as HomoRich.

Neurai is AFL-3.0: the app must credit it (Neura.info, Persian
Grapheme-to-Phoneme Dataset, huggingface.co/datasets/Neurai/Persian_G2P).
