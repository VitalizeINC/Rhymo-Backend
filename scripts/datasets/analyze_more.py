import csv, re, json, collections, sys
from check import fits
exec(open("extract.py").read().split("t = pq.read_table")[0])   # norm, plain, PUNCT, PERSIAN, strip_ezafe
csv.field_size_limit(10**8)

def pairs_from(rows, has_mapped):
    pairs = collections.Counter(); spell = collections.defaultdict(collections.Counter); sent = 0
    for r in rows:
        g = PUNCT.sub(" ", norm(r["Grapheme"])).split()
        p = (r["Phoneme"] or "").split()
        m = (r.get("Mapped Phoneme") or "").split() if has_mapped else [""] * len(p)
        if not g or len(g) != len(p) or len(p) != len(m) or not all(PERSIAN.match(w) for w in g): continue
        sent += 1
        for w, ph, mp in zip(g, p, m):
            if ph.endswith("?") and w[-1] not in "عءئأؤ": ph = ph[:-1]
            if has_mapped and mp.endswith("1"): ph = strip_ezafe(ph)
            if not ph or not fits(w, ph): continue
            k = plain(w); pairs[(k, ph)] += 1; spell[k][w] += 1
    return pairs, spell, sent

def neurai_rows():
    fix = str.maketrans({"'": "?", "Q": "q", "ɡ": "g", "’": "?"})
    for r in csv.DictReader(open("neurai.csv", encoding="utf-8")):
        r["Phoneme"] = (r["Phoneme"] or "").translate(fix)
        # Neurai often drops the glottal stop at the start of a word: add it back
        r["Phoneme"] = " ".join(("?" + t) if t and t[0] in "Aaeoui" else t for t in r["Phoneme"].split())
        yield r

db = set()
for line in open(sys.argv[1], encoding="utf-8"):
    f = line.rstrip("\n").split("\t")
    if len(f) > 1: db.add(plain(f[1])); db.add(plain(f[0]))
known_hr = {plain(r["w"]) for r in json.load(open("pairs.json", encoding="utf-8"))}
freq = {}
for line in open("fa_full.txt", encoding="utf-8"):
    a = line.rstrip("\n").rsplit(" ", 1)
    if len(a) == 2 and plain(a[0]): freq[plain(a[0])] = freq.get(plain(a[0]), 0) + int(a[1])
rank = {k: i + 1 for i, (k, _) in enumerate(sorted(freq.items(), key=lambda x: -x[1]))}

for name, rows, mapped in (("PersianG2P", csv.DictReader(open("persiang2p.csv", encoding="utf-8")), True), ("Neurai", neurai_rows(), False)):
    pairs, spell, sent = pairs_from(rows, mapped)
    words = {k for k, _ in pairs}
    new = {k for k in words if k not in db}
    new_vs_hr = {k for k in new if k not in known_hr}
    print(f"{name}: sentences used {sent}; distinct words {len(words)}; not in our dictionary {len(new)}; of those not in HomoRich either {len(new_vs_hr)}")
    for lim in (20000, 50000):
        print(f"   new and in top {lim} spoken: {sum(1 for k in new if rank.get(k, 10**9) <= lim)}")
    top = sorted(new, key=lambda k: rank.get(k, 10**9))[:40]
    best = lambda k: max(spell[k], key=lambda f: (("‌" in f), spell[k][f]))
    ph = lambda k: max(((c, p) for (kk, p), c in pairs.items() if kk == k))[1]
    print("   most common new:", " | ".join(best(k) + " " + ph(k) for k in top))
    json.dump([{"w": best(k), "ph": p, "n": c} for (k, p), c in pairs.items() if k in new], open(f"pairs-{name}.json", "w", encoding="utf-8"), ensure_ascii=False)

missing = [k for k, r in sorted(rank.items(), key=lambda x: x[1]) if r <= 20000 and k not in db]
print(f"\nTop 20,000 spoken words still missing from the dictionary: {len(missing)}")
print("   e.g.", " | ".join(missing[:60]))
