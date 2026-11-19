import re, json, collections, unicodedata, pyarrow.parquet as pq
from check import fits
exec(open("extract.py").read().split("t = pq.read_table")[0])   # reuse norm/plain/PUNCT/FIRST/PERSIAN/strip_ezafe
t = pq.read_table("homorich.parquet", columns=["Grapheme","Phoneme","Mapped Phoneme"]).to_pylist()
pairs = collections.Counter(); spell = collections.defaultdict(collections.Counter)
tok_ok = tok_bad = 0
for r in t:
    g = PUNCT.sub(" ", norm(r["Grapheme"])).split()
    p = (r["Phoneme"] or "").split(); m = (r["Mapped Phoneme"] or "").split()
    if not g or len(g) != len(p) or len(p) != len(m) or not all(PERSIAN.match(w) for w in g): continue
    for w, ph, mp in zip(g, p, m):
        if ph.endswith("?") and w[-1] not in "عءئأؤ": ph = ph[:-1]   # a question mark, not a sound
        if mp.endswith("1"): ph = strip_ezafe(ph)
        if not ph or not fits(w, ph): tok_bad += 1; continue
        tok_ok += 1
        k = plain(w); pairs[(k, ph)] += 1; spell[k][w] += 1

freq = {}
for line in open("fa_full.txt", encoding="utf-8"):
    a = line.rstrip("\n").rsplit(" ", 1)
    if len(a) == 2 and plain(a[0]): freq[plain(a[0])] = freq.get(plain(a[0]), 0) + int(a[1])
rank = {k: i + 1 for i, (k, _) in enumerate(sorted(freq.items(), key=lambda x: -x[1]))}
db = set()
for line in open("db_words.tsv", encoding="utf-8"):
    f = line.split("\t")
    if len(f) > 1: db.add(plain(f[1])); db.add(plain(f[0]))

by = collections.defaultdict(list)
for (k, ph), c in pairs.items(): by[k].append((c, ph))
rows = []
for k, lst in by.items():
    lst.sort(reverse=True); total = sum(c for c, _ in lst)
    # the written form: prefer the one with a half-space (می‌شه over میشه)
    forms = spell[k]; best = max(forms, key=lambda f: (("‌" in f), forms[f]))
    keep = [(c, ph) for c, ph in lst if c >= 2 and c / total >= 0.25] or [lst[0]]
    for c, ph in keep:
        rows.append({"w": best, "ph": ph, "n": c, "total": total, "rank": rank.get(k), "in_db": k in db})
json.dump(rows, open("pairs.json", "w", encoding="utf-8"), ensure_ascii=False)
print("tokens kept", tok_ok, "dropped as not fitting", tok_bad)
new = [r for r in rows if not r["in_db"]]
print("words", len({r["w"] for r in rows}), " missing from our DB", len({r["w"] for r in new}))
for lim in (5000, 10000, 20000, 50000):
    print(f"  missing & in top {lim} spoken:", len({r["w"] for r in new if r["rank"] and r["rank"] <= lim}))
top = sorted([r for r in new if r["rank"]], key=lambda r: r["rank"])
print("MOST COMMON MISSING:", " | ".join(r["w"] + " " + r["ph"] for r in top[:45]))
mid = [r for r in top if 8000 <= r["rank"] <= 20000]
print("AROUND 8k-20k:", " | ".join(r["w"] + " " + r["ph"] for r in mid[:30]))
