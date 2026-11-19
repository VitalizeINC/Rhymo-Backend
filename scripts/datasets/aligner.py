"""
Builds a Rhymo word (marked spelling, written syllables = heja, vowels = ava)
from a plain spelling and its pronunciation.

The pronunciation is the truth: the syllables are cut from the sounds, so the
vowels always match the dataset. The letters are then lined up with the sounds
(each letter must stand for the sounds it covers), and each syllable gets the
letters whose sounds fall in it. A letter whose sound is doubled (جَذّاب =
jazzAb) or that is read twice (ی in زیاد = ziyAd) goes into both syllables,
the way the dictionary already writes آب-دَر-رِ.

Sound symbols (KaamelDict / HomoRich): vowels A a e o u i, consonants
? C S Z b d f g h j k l m n p q r s t v x y z.
"""
import re

VOWELS = set("Aaeoui")
AVA = {"A": "آ", "a": "اَ", "e": "اِ", "o": "اُ", "u": "او", "i": "ای"}
MARK = {"a": "َ", "e": "ِ", "o": "ُ"}
SHADDA = "ّ"
ZWNJ = "‌"
SEPS = {ZWNJ, " "}
CONS = {"ب":"b","پ":"p","ت":"t","ط":"t","ث":"s","س":"s","ص":"s","ج":"j","چ":"C","ح":"h","خ":"x","د":"d",
        "ذ":"z","ز":"z","ض":"z","ظ":"z","ر":"r","ژ":"Z","ش":"S","غ":"q","ق":"q","ف":"f","ک":"k","گ":"g",
        "ل":"l","م":"m","n":"n","ن":"n"}

def letter_rx(ch, first, last):
    if ch in CONS: return "%s{1,2}" % CONS[ch]
    if ch == "ا":
        if first: return r"\?"
        return "(?:A|an|a|\\?|)" if last else "(?:A|a|\\?|)"
    if ch == "آ": return r"\?A" if first else r"\??A"
    if ch in "عءأإؤ": return r"\??"
    if ch == "ئ": return r"(?:\?|y|)"
    if ch == "و": return "v{1,2}" if first else "(?:v{1,2}|u|o|)"
    if ch == "ه": return "(?:e|h{1,2}|)" if last else "(?:h{1,2}|e|)"
    if ch == "ی":
        if first: return "y{1,2}"
        return "(?:iy{1,2}|i|y{1,2}|A|)" if last else "(?:iy{1,2}|i|y{1,2}|)"
    return None

_cache = {}
def compile_word(letters, unwritten, ends=frozenset()):
    key = (letters, unwritten, ends)
    if key not in _cache:
        parts = []
        for i, ch in enumerate(letters):
            rx = letter_rx(ch, i == 0, i == len(letters) - 1 or i in ends)
            if rx is None: _cache[key] = None; break
            parts.append("(%s)(%s??)" % (rx, unwritten))   # letters first, then unwritten vowels
        else:
            _cache[key] = re.compile("".join(parts))
    return _cache[key]

def syllable_starts(ph):
    starts = []
    for k, s in enumerate(ph):
        if s == "u" and k > 0 and ph[k - 1] == "o":
            continue                     # the ow sound: part of the o before it
        if s in VOWELS:
            starts.append(k - 1 if k > 0 and ph[k - 1] not in VOWELS else k)
    return starts

def build_token(token, ph):
    """token: one written word (may hold ZWNJ). ph: its sound string."""
    letters = token.replace(ZWNJ, "").replace(" ", "")
    ends, li = set(), 0
    for c in token:
        if c in SEPS: ends.add(li - 1)
        else: li += 1
    ends = frozenset(ends)
    if not letters or not ph or not any(c in VOWELS for c in ph): return None
    m = None
    for unwritten in ("[aeo]", "[aeoA]"):
        rx = compile_word(letters, unwritten, ends)
        if rx is None: return None
        m = rx.fullmatch(ph)
        if m: break
    if not m: return None

    starts = syllable_starts(ph)
    syl_of = []
    s_i = 0
    for k in range(len(ph)):
        while s_i + 1 < len(starts) and starts[s_i + 1] <= k: s_i += 1
        syl_of.append(s_i)
    nsyl = len(starts)

    # per letter: which syllables it is written in, and its marks
    pieces = [[] for _ in range(nsyl)]      # syllable -> list of letter strings
    full = []                               # marked letters, in order
    last_syl = 0
    n = len(letters)
    for i, ch in enumerate(letters):
        a, b = m.span(2 * i + 1)
        va, vb = m.span(2 * i + 2)
        span_syls = sorted({syl_of[j] for j in range(a, b)})
        vowel = ph[va] if vb > va else ""
        if not span_syls:
            if ch in "اعئءأإ" and not vowel:
                # a silent carrier letter (the ا of ایم in رسیده‌ایم) starts the
                # next syllable; other silent letters (خوا) stay with the last
                nxt = next((m.start(2 * j + 1) for j in range(i + 1, n) if m.end(2 * j + 1) > m.start(2 * j + 1)), None)
                span_syls = [syl_of[nxt]] if nxt is not None else [last_syl]
            else:
                span_syls = [last_syl]
        vowel_syl = syl_of[va] if vowel else None
        mark = MARK.get(vowel, "")          # unwritten long A gets no mark
        # final ه read as e: the dictionary also marks the letter before with kasra
        doubled = (b - a == 2 and ph[a] == ph[a + 1] and ph[a] not in VOWELS) or ph[a:b] == "iyy"
        tanvin = "\u064B" if (ch == "ا" and ph[a:b] == "an") else ""
        full.append(ch + (SHADDA if doubled else "") + mark + tanvin)
        syls = sorted(set(span_syls) | ({vowel_syl} if vowel else set()))
        for s in syls:
            pieces[s].append(ch + (mark if s == vowel_syl else ""))
        last_syl = max(syls)
    # a written و read as o: damma on the letter before (مُوضوع)
    for i, ch in enumerate(letters):
        a, b = m.span(2 * i + 1)
        if i > 0 and ch == "و" and ph[a:b] == "o" and not re.search("[\u064E-\u0650]$", full[i - 1]):
            full[i - 1] += MARK["o"]
            s = syl_of[a]
            for k, piece in enumerate(pieces[s]):
                if piece == letters[i - 1]: pieces[s][k] += MARK["o"]; break
    # kasra before a ه that ends a word part and is read as e (دَرِّه, دانِه‌دار)
    for i in sorted(ends | {n - 1}):
        if i < 1 or letters[i] != "ه": continue
        a, b = m.span(2 * i + 1)
        if ph[a:b] == "e" and not re.search("[\u064E-\u0650]$", full[i - 1]):
            full[i - 1] += MARK["e"]
            s = syl_of[a]
            for k, piece in enumerate(pieces[s]):
                if piece == letters[i - 1]: pieces[s][k] += MARK["e"]; break
    if any(not p for p in pieces): return None
    # put ZWNJ back where it was in the token
    marked, li = [], 0
    for ch in token:
        if ch in SEPS: marked.append(ch)
        else: marked.append(full[li]); li += 1
    heja = ["".join(p) for p in pieces]
    ava = [AVA[ph[k if ph[k] in VOWELS else k + 1]] for k in starts]
    return {"marked": "".join(marked), "heja": heja, "ava": ava}

def build(grapheme, phonemes):
    """grapheme: plain spelling (spaces / ZWNJ allowed). phonemes: list of
    symbols as KaamelDict gives them (  between words) or a HomoRich string."""
    ph = "".join(phonemes) if not isinstance(phonemes, str) else phonemes
    gw = grapheme.split(); pw = ph.split()
    if gw and len(pw) == 1 and len(gw) > 1:
        gw = [" ".join(gw)]          # a phrase whose pronunciation has no spaces
    if not gw or len(gw) != len(pw): return None
    out = [build_token(g, p) for g, p in zip(gw, pw)]
    if any(o is None for o in out): return None
    s = " ".join(o["marked"] for o in out)              # written form, ZWNJ kept
    heja = [h for o in out for h in o["heja"]]
    ava = [v for o in out for v in o["ava"]]
    full = s.replace(ZWNJ, " ")
    return {
        "fullWord": full,
        "fullWordWithNimFaseleh": s,
        "word": re.sub("[َ-ّ]", "", full),
        "heja": heja, "ava": ava, "avaString": ",".join(ava), "hejaCounter": len(ava),
        "spacePositions": [i for i, c in enumerate(s) if c == " "],
        "nimFaselehPositions": [i for i, c in enumerate(s) if c == ZWNJ],
    }

if __name__ == "__main__":
    tests = [("زیاد","ziyAd"),("جذاب","jazzAb"),("نقاشی","naqqASi"),("اگر","?agar"),("خواهر","xAhar"),
             ("آبدره","?Abdarre"),("عصبانیت","?asabAniyyat"),("موضوع","mozu?"),("دانه‌دار","dAnedAr"),
             ("معامله","mo?Amele"),("سیمون","simon"),("رانندگی","rAnandegi"),("آسیایی","?AsiyAyi"),
             ("می‌دونم","midunam"),("موسی","musA"),("کاکائو","kAkAo"),("بریتانیا","beritAniyA"),
             ("پرندگان","parandegAn"),("اصلا","?aslan"),("موتوری","motori"),("خوشحال","xoShAl"),("گوجه","gouje"),("تامین","ta?min"),("علامت تعجب","?alAmateta?ajjob"),("سر","sar"),("سر","ser"),("نرسیده‌ایم","naresideim"),("نهاده‌اید","nahAdeid"),("دانشجو","dAneSju"),("همسایه","hamsAye")]
    for g, p in tests:
        r = build(g, p)
        print(g, p, "->", (r["fullWordWithNimFaseleh"] + "  " + "-".join(r["heja"]) + "  [" + ",".join(r["ava"]) + "]") if r else None)
