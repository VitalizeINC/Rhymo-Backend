"""
Adds one more dataset's words (waiting for approval), the same way HomoRich was
added. Input: pairs-<Name>.json from analyze_more.py (word, sound, count).

  python import_extra.py Neurai            # test run
  python import_extra.py Neurai --apply
"""
import json, re, sys, random, datetime, collections
from pymongo import InsertOne
from aligner import build
exec(open("import_datasets.py").read().split("# ---------- what is in the dictionary now")[0])  # imports, W, norm, plain
src = open("import_datasets.py", encoding="utf-8").read()
exec(src[src.index("# how common a spelling is"):src.index("# readings that people actually use")])  # rank, is_ezafe_form, clean

NAME = sys.argv[1]; APPLY = "--apply" in sys.argv
rows = json.load(open(f"pairs-{NAME}.json", encoding="utf-8"))

# what is there now: exact spellings, and (letters, vowels) of every word
full_now, sound_now = set(), set()
for d in W.find({"lang": {"$ne": "en"}}, {"fullWord": 1, "word": 1, "avaString": 1}):
    full_now.add(d["fullWord"]); sound_now.add(d["word"].replace(" ", "") + "|" + d.get("avaString", ""))

by = collections.defaultdict(list)
for r in rows: by[plain(r["w"])].append(r)
stats = collections.Counter(); cands = []; seen = set()
for k, lst in by.items():
    total = sum(r["n"] for r in lst)
    lst.sort(key=lambda r: -r["n"])
    keep = [r for r in lst if r["n"] >= 2 and r["n"] / total >= 0.25] or [lst[0]]
    for r in keep:
        if r["n"] < 2 and k not in rank: stats["seen once and not common, skipped"] += 1; continue
        g = clean(r["w"])
        if not g: continue
        if is_ezafe_form(g, r["ph"]): stats["linking -e form, dropped"] += 1; continue
        b = build(g, r["ph"])
        if not b: stats["not built"] += 1; continue
        s = b["word"].replace(" ", "") + "|" + b["avaString"]
        if b["fullWord"] in full_now or s in sound_now: stats["already in dictionary"] += 1; continue
        if s in seen: stats["same as another reading"] += 1; continue
        seen.add(s)
        b["dataset"] = NAME; b["commonRank"] = rank.get(k, 999999)
        cands.append(b); stats["to add"] += 1
for x in sorted(stats): print(f"  {x}: {stats[x]}")
xs = sorted(cands, key=lambda c: c["commonRank"])
print("most common:", " | ".join(c["fullWordWithNimFaseleh"] + " " + "-".join(c["heja"]) for c in xs[:45]))
random.seed(3)
print("random:", " | ".join(c["fullWordWithNimFaseleh"] + " " + "-".join(c["heja"]) for c in random.sample(cands, min(30, len(cands)))))
if not APPLY: print("Test run only. Nothing changed."); sys.exit(0)

now = datetime.datetime.utcnow()
ops = [InsertOne({**c, "private": False, "approved": False, "approvedBy": None, "approvedAt": None, "rejected": False,
                  "rejectedAt": None, "rejectedReason": None, "level": 1, "lang": "fa",
                  "createdAt": now, "updatedAt": now, "__v": 0}) for c in cands]
inserted = 0
for i in range(0, len(ops), 2000):
    try: inserted += W.bulk_write(ops[i:i + 2000], ordered=False).inserted_count
    except Exception as e: inserted += (getattr(e, "details", {}) or {}).get("nInserted", 0)
print(f"added {inserted} {NAME} words waiting for approval")
