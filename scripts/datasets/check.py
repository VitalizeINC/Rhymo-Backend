# Does a pronunciation fit its spelling? Each written letter must account for
# its sound; short vowels a/e/o may be unwritten. Catches the other spelling
# style (sh/kh/ch), sentences where words and sounds got out of line, and
# question marks read as a glottal stop.
import re
C = {"ب":"b","پ":"p","ت":"t","ط":"t","ث":"s","س":"s","ص":"s","ج":"j","چ":"C","ح":"h","خ":"x","د":"d",
     "ذ":"z","ز":"z","ض":"z","ظ":"z","ر":"r","ژ":"Z","ش":"S","غ":"q","ق":"q","ف":"f","ک":"k","گ":"g",
     "ل":"l","م":"m","ن":"n"}
V = "[aeo]?"
def letter(ch, first, last):
    if ch in C: return "(?:%s{1,2})" % C[ch]
    if ch == "ا": return r"\?[Aaeo]" if first else "(?:A|a|)"
    if ch == "آ": return r"\?A" if first else r"\??A"
    if ch in "عءأإؤ": return r"\??"
    if ch == "ئ": return r"(?:\?|y|)"
    if ch == "و": return "(?:v{1,2}|u|o|ow)" if not first else "v{1,2}"
    if ch == "ه": return "(?:e|eh|h{1,2}|)" if last else "(?:h{1,2}|e|)"
    if ch == "ی": return "(?:y{1,2})" if first else "(?:y{1,2}|i|iy|)"
    return None
_cache = {}
def fits(word, ph):
    w = word.replace("‌", "")
    key = w
    if key not in _cache:
        parts = []
        for i, ch in enumerate(w):
            p = letter(ch, i == 0, i == len(w) - 1)
            if p is None: _cache[key] = None; break
            parts.append(p + V)
        else:
            _cache[key] = re.compile("".join(parts))
    rx = _cache[key]
    return bool(rx and rx.fullmatch(ph))
