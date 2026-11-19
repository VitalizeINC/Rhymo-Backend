"""
Rebuilds the batch words from the datasets with the new aligner and adds the
missing ones, all waiting for approval.

  python import_datasets.py            # test run: counts and samples, no changes
  python import_datasets.py --apply    # do it

What it does:
  * Waiting KaamelDict words that nobody edited, owns or asked for were made
    by the old splitter (about a third have wrong vowels). They are saved to
    a backup file, removed, and built again from the same KaamelDict rows.
  * Every KaamelDict reading and every HomoRich word that is not already in
    the dictionary is added, waiting for approval, with its dataset name.
  * Approved words are never changed. A list of approved words whose vowels
    disagree with KaamelDict is written to approved-disagree.tsv for review.
"""
import ast, csv, gzip, json, re, sys, datetime, collections, random
from bson import json_util
from pymongo import MongoClient, InsertOne
from aligner import build
exec(open("extract.py").read().split("FIRST =")[0])   # norm(), plain()

APPLY = "--apply" in sys.argv
url = re.search(r"^DATABASE_URL=(.*)$", open("/root/Rhymo-Backend/.env", encoding="utf-8").read(), re.M).group(1).strip().strip("\"'")
W = MongoClient(url).get_default_database()["words"]

# ---------- what is in the dictionary now ----------
fields = {"fullWord": 1, "word": 1, "avaString": 1, "approved": 1, "batchId": 1, "wordBatchId": 1,
          "user": 1, "requestedBy": 1, "createdAt": 1, "updatedAt": 1, "dataset": 1}
replaceable, keep = [], []
for d in W.find({"lang": {"$ne": "en"}}, fields):
    from_batch = d.get("batchId") or d.get("wordBatchId")
    edited = d.get("updatedAt") and d.get("createdAt") and (d["updatedAt"] - d["createdAt"]).total_seconds() > 5
    if (not d.get("approved") and from_batch and not d.get("user") and not d.get("requestedBy") and not edited):
        replaceable.append(d)
    else:
        keep.append(d)
keep_full = {d["fullWord"] for d in keep}
approved_sound = {(plain(d["fullWord"]), d.get("avaString", "")) for d in keep if d.get("approved")}
approved_by_plain = collections.defaultdict(list)
for d in keep:
    if d.get("approved"): approved_by_plain[plain(d["fullWord"])].append(d)
print(f"dictionary: {len(keep) + len(replaceable)} Persian words; old waiting batch words to rebuild: {len(replaceable)}")

# ---------- candidates ----------
cands, seen = [], set()
stats = collections.Counter()
# how common a spelling is in everyday speech (movie subtitles); 999999 = not in the list
rank = {}
for i, line in enumerate(sorted(((plain(a), int(c)) for a, c in (l.rstrip("\n").rsplit(" ", 1) for l in open("fa_full.txt", encoding="utf-8") if " " in l.strip())), key=lambda x: -x[1])):
    rank.setdefault(line[0], len(rank) + 1)

def is_ezafe_form(grapheme, phon):
    """HomoRich text sometimes keeps the linking -e (مدرسه‌یِ, هممیهنانِ): not a word."""
    g = grapheme.replace("\u200c", "")
    if phon.endswith("e") and not g.endswith("ه"): return True
    if phon.endswith("ye") and g.endswith("ی") and len(g) > 1 and g[-2] in "هاو": return True
    return False

def clean(grapheme):
    """No half-space at the start or end of a word, and never two in a row."""
    grapheme = re.sub("\u200c+", "\u200c", grapheme)
    return " ".join(t.strip("\u200c") for t in grapheme.split())

# readings that people actually use in modern sentences (HomoRich)
pairs = json.load(open("pairs.json", encoding="utf-8"))
used_readings = {(plain(r["w"]), r["ph"]) for r in pairs}

def add(dataset, grapheme, phon):
    grapheme = clean(grapheme)
    if not grapheme: return
    if dataset == "HomoRich" and is_ezafe_form(grapheme, phon):
        stats[dataset + " linking -e form, dropped"] += 1; return
    b = build(grapheme, phon)
    if not b: stats[dataset + " not built"] += 1; return
    b["commonRank"] = rank.get(plain(grapheme), 999999)
    k = b["fullWord"]
    if k in seen: stats[dataset + " same as another reading"] += 1; return
    seen.add(k)
    if k in keep_full: stats[dataset + " already in dictionary"] += 1; return
    if (plain(k), b["avaString"]) in approved_sound: stats[dataset + " same sound already approved"] += 1; return
    b["dataset"] = dataset; cands.append(b); stats[dataset + " to add"] += 1

disagree = []
for r in csv.reader(open("/root/kaamel/KaamelDict.csv", encoding="utf-8")):
    if r[0] == "grapheme": continue
    g = norm(r[0]).strip()
    variants = ast.literal_eval(r[1])
    for k, v in enumerate(variants):
        # the main reading always; an extra reading only when modern text uses it
        if k == 0 or (plain(g), "".join(v)) in used_readings:
            add("KaamelDict", g, "".join(v))
        else:
            stats["KaamelDict extra reading not used in modern text, skipped"] += 1
    # approved words whose vowels match none of KaamelDict's readings
    built = [build(g, "".join(v)) for v in variants]
    sounds = {b["avaString"] for b in built if b}
    for d in approved_by_plain.get(plain(g), []):
        if sounds and d.get("avaString") not in sounds:
            disagree.append((d["fullWord"], d.get("avaString", ""), " / ".join(sorted(sounds))))

for r in pairs:
    # seen once and not in the everyday-speech list: mostly typos
    if r["n"] < 2 and plain(r["w"]) not in rank:
        stats["HomoRich seen once and not common, skipped"] += 1; continue
    add("HomoRich", r["w"], r["ph"])

for k in sorted(stats): print(f"  {k}: {stats[k]}")
with open("approved-disagree.tsv", "w", encoding="utf-8") as f:
    f.write("approved word\tapproved vowels\tKaamelDict vowels\n")
    for row in disagree: f.write("\t".join(row) + "\n")
print(f"approved words whose vowels match no KaamelDict reading: {len(disagree)} (approved-disagree.tsv)")

random.seed(7)
for ds in ("KaamelDict", "HomoRich"):
    xs = [c for c in cands if c["dataset"] == ds]
    print(f"\n{ds} samples:")
    for c in random.sample(xs, min(25, len(xs))):
        print("  ", c["fullWordWithNimFaseleh"], " ", "-".join(c["heja"]), " [" + c["avaString"] + "]")

for ds in ("KaamelDict", "HomoRich"):
    xs = sorted((c for c in cands if c["dataset"] == ds), key=lambda c: c["commonRank"])
    print(f"\n{ds}: most common words to add:")
    print("   " + " | ".join(c["fullWordWithNimFaseleh"] + " " + "-".join(c["heja"]) for c in xs[:40]))

if not APPLY:
    print("\nTest run only. Nothing changed."); sys.exit(0)

# ---------- apply ----------
stamp = datetime.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
ids = [d["_id"] for d in replaceable]
with gzip.open(f"backup-waiting-batch-words-{stamp}.json.gz", "wt", encoding="utf-8") as f:
    for i in range(0, len(ids), 5000):
        for d in W.find({"_id": {"$in": ids[i:i + 5000]}}):
            f.write(json_util.dumps(d, ensure_ascii=False) + "\n")
print("backup written")
for i in range(0, len(ids), 5000):
    W.delete_many({"_id": {"$in": ids[i:i + 5000]}, "approved": False})
print("old waiting batch words removed:", len(ids))

now = datetime.datetime.utcnow()
ops = []
for c in cands:
    doc = {**c, "private": False, "approved": False, "approvedBy": None, "approvedAt": None,
           "rejected": False, "rejectedAt": None, "rejectedReason": None, "level": 1, "lang": "fa",
           "createdAt": now, "updatedAt": now, "__v": 0}
    ops.append(InsertOne(doc))
inserted = dup = 0
for i in range(0, len(ops), 2000):
    try:
        res = W.bulk_write(ops[i:i + 2000], ordered=False); inserted += res.inserted_count
    except Exception as e:
        det = getattr(e, "details", {}) or {}
        inserted += det.get("nInserted", 0); dup += len(det.get("writeErrors", []))
print(f"added {inserted} words waiting for approval ({dup} skipped as duplicates)")
# waiting words kept from before get a commonness rank too, so the lists sort the same way
n_rank = 0
for d in W.find({"approved": False, "dataset": {"$ne": None}, "commonRank": None}, {"fullWord": 1}):
    W.update_one({"_id": d["_id"]}, {"$set": {"commonRank": rank.get(plain(d["fullWord"]), 999999)}}); n_rank += 1
print("ranked older waiting words:", n_rank)
