# Word -> pronunciation pairs from HomoRich sentences, counted, plus how
# common each word is in everyday speech (FrequencyWords, movie subtitles).
import re, json, collections, unicodedata
import pyarrow.parquet as pq

DIAC = re.compile("[ً-ْٰـ]")          # vowel marks, tatweel
PUNCT = re.compile(r"[.،؛؟!?:;,\"«»()\[\]{}\-–—/\\*…‏‎]")
def norm(s):
    s = unicodedata.normalize("NFC", s or "")
    s = s.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک")
    s = s.replace("ة", "ه").replace("أ", "ا").replace("إ", "ا")
    return DIAC.sub("", s)
def plain(s):  # spelling key: no marks, no half-space or space
    return norm(s).replace("‌", "").replace(" ", "")

FIRST = {"ا":"?","آ":"?","ع":"?","ئ":"?","ب":"b","پ":"p","ت":"t","ط":"t",
 "ث":"s","س":"s","ص":"s","ج":"j","چ":"C","ح":"h","ه":"h","خ":"x","د":"d",
 "ذ":"z","ز":"z","ض":"z","ظ":"z","ر":"r","ژ":"Z","ش":"S","غ":"q","ق":"q",
 "ف":"f","ک":"k","گ":"g","ل":"l","م":"m","ن":"n","و":"v","ی":"y"}
PERSIAN = re.compile("^[ء-غف-يپچژکگی‌]+$")
VOW = set("Aaeoui")

def strip_ezafe(p):
    if len(p) > 3 and p.endswith("ye") and p[-3] in VOW: return p[:-2]
    if p.endswith("e"): return p[:-1]
    return p

t = pq.read_table("homorich.parquet", columns=["Grapheme","Phoneme","Mapped Phoneme","Source"]).to_pylist()
pairs = collections.Counter(); seen_in = collections.defaultdict(set); src_count = collections.Counter()
used = skipped = 0
for r in t:
    g = PUNCT.sub(" ", norm(r["Grapheme"])).split()
    p = (r["Phoneme"] or "").split(); m = (r["Mapped Phoneme"] or "").split()
    if not g or len(g) != len(p) or len(p) != len(m) or not all(PERSIAN.match(w) for w in g):
        skipped += 1; continue
    ok = all(FIRST.get(w[0]) == ph[0] or (w[0] == "و" and ph[0] in "uo") for w, ph in zip(g, p))
    if not ok: skipped += 1; continue
    used += 1; src_count[r["Source"]] += 1
    for w, ph, mp in zip(g, p, m):
        if mp.endswith("1"): ph = strip_ezafe(ph)
        pairs[(w, ph)] += 1

freq = {}
for line in open("fa_full.txt", encoding="utf-8"):
    parts = line.rstrip("\n").rsplit(" ", 1)
    if len(parts) != 2: continue
    k = plain(parts[0])
    if k: freq[k] = freq.get(k, 0) + int(parts[1])
rank = {k: i + 1 for i, (k, _) in enumerate(sorted(freq.items(), key=lambda x: -x[1]))}

db = set()
for line in open("db_words.tsv", encoding="utf-8"):
    f = line.split("\t")
    if len(f) > 1: db.add(plain(f[1])); db.add(plain(f[0]))

by_word = collections.defaultdict(list)
for (w, ph), c in pairs.items(): by_word[w].append((c, ph))
rows = []
for w, lst in by_word.items():
    lst.sort(reverse=True); total = sum(c for c, _ in lst)
    keep = [(c, ph) for c, ph in lst if c >= 2 and c / total >= 0.2] or [lst[0]]
    for c, ph in keep:
        rows.append({"w": w, "ph": ph, "n": c, "total": total, "rank": rank.get(plain(w)), "in_db": plain(w) in db})
json.dump(rows, open("pairs.json", "w", encoding="utf-8"), ensure_ascii=False)

words = {r["w"] for r in rows}
new = {r["w"] for r in rows if not r["in_db"]}
print("sentences used", used, "skipped", skipped, dict(src_count))
print("distinct words", len(words), " not in our DB", len(new))
for lim in (5000, 10000, 20000, 50000):
    print(f"  new words in top {lim} spoken:", sum(1 for r in rows if not r["in_db"] and r["rank"] and r["rank"] <= lim and r["n"]>=2))
print("  new words seen >=5 times in HomoRich:", len({r["w"] for r in rows if not r["in_db"] and r["total"]>=5}))
top = sorted([r for r in rows if not r["in_db"] and r["rank"]], key=lambda r: r["rank"])
print("most common missing:", " | ".join(r["w"] + " " + r["ph"] for r in top[:40]))
