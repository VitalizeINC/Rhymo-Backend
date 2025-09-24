// ---------- Constants ----------
const DIAC = new Set([
    '\u064b', '\u064c', '\u064d', // tanween
    '\u064e', '\u064f', '\u0650', // fatha, damma, kasra
    '\u0651', '\u0652',           // shadda, sukun
  ]);
  const FATHA = '\u064e'; // َ
  const DAMMA = '\u064f'; // ُ
  const KASRA = '\u0650'; // ِ
  
  // space, ZWNJ, ZWJ, bidi marks, tatweel
  const SKIP_CHARS = new Set([' ', '\u200c', '\u200d', '\u200e', '\u200f', '\u0640']);
  
  // matres (vowel carriers)
  const MATRES = new Set(['و','ی','ا','آ','أ','إ']);
  
  // ---------- Helpers ----------
  function isDiac(ch) { return DIAC.has(ch); }
  
  function segmentTokens(s) {
    // → [{b: baseChar, m: marksString}, ...]
    const out = [];
    for (const ch of s || '') {
      if (isDiac(ch)) {
        if (out.length) out[out.length - 1].m += ch;
      } else {
        out.push({ b: ch, m: '' });
      }
    }
    return out;
  }
  
  function joinTokens(tokens) {
    return tokens.map(t => t.b + t.m).join('');
  }
  
  function stripShortVowels(marks) {
    // remove only fatha/damma/kasra; keep shadda/sukun intact
    let s = '';
    for (const ch of marks) {
      if (ch !== FATHA && ch !== DAMMA && ch !== KASRA) s += ch;
    }
    return s;
  }
  
  function prevBaseIndex(tokens, i) {
    // nearest previous non-skip base
    let j = i - 1;
    while (j >= 0 && SKIP_CHARS.has(tokens[j].b)) j--;
    return j;
  }
  
  function parseIndexList(x) {
    if (x == null) return [];
    if (Array.isArray(x)) return [...new Set(x.map(n => +n).filter(Number.isFinite))].sort((a,b)=>a-b);
    let s = String(x).trim();
    if (!s) return [];
    // Persian/Arabic digits → Latin
    s = s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
         .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const parts = s.split(/[,\u060C\s]+/).filter(Boolean);
    return [...new Set(parts.map(n => +n).filter(Number.isFinite))].sort((a,b)=>a-b);
  }
  
  // ---------- Main fix ----------
  /**
   * @param {string} organizedWord - رشتهٔ اعراب‌خورده (خروجی organized_grapheme)
   * @param {object} idx - اندیس‌ها (رشته یا آرایه)
   * @param {string|number|Array<number>} idx.waw_o_exception_idx
   * @param {string|number|Array<number>} idx.silent_waw_idx
   * @param {string|number|Array<number>} idx.spoken_A_grapheme_idx
   * @returns {string} - رشتهٔ اصلاح‌شده
   */
  export default function applyOrthographyFixes(
    organizedWord,
    {
      waw_o_exception_idx = '',
      silent_waw_idx = '',
      spoken_A_grapheme_idx = ''
    } = {}
  ) {
    let tokens = segmentTokens(organizedWord);
    if (!tokens.length) return organizedWord || '';
  
    const wEx = parseIndexList(waw_o_exception_idx);
    const wSilent = parseIndexList(silent_waw_idx);
    const aSpoken = parseIndexList(spoken_A_grapheme_idx);
  
    // 1) «وِ استثنا»: و → ُ روی پایهٔ قبلی، سپس حذف و
    for (let k = wEx.length - 1; k >= 0; k--) {
      const idx = wEx[k];
      if (idx >= 0 && idx < tokens.length && tokens[idx].b === 'و') {
        const j = prevBaseIndex(tokens, idx);
        if (j >= 0) {
          const t = tokens[j];
          t.m = stripShortVowels(t.m) + DAMMA;  // put ُ
          tokens.splice(idx, 1);                 // remove و
        }
      }
    }
  
    // 2) «وِ ساکت»: حذف و
    for (let k = wSilent.length - 1; k >= 0; k--) {
      const idx = wSilent[k];
      if (idx >= 0 && idx < tokens.length && tokens[idx].b === 'و') {
        tokens.splice(idx, 1);
      }
    }
  
    // 3) «آ شنیداری»: درج/جایگزینی «ا»
    // از چپ به راست با جبران شیفت
    let offset = 0;
    for (const raw of aSpoken) {
      let idx = raw + offset;
      if (idx < 0) continue;
  
      if (idx < tokens.length) {
        const { b } = tokens[idx];
        if (MATRES.has(b)) {
          // جایگزینی مصوّتِ موجود با «ا» (اعراب همان توکن حفظ می‌شود)
          tokens[idx].b = 'ا';
        } else {
          // درج «ا» در همین ایندکس
          tokens.splice(idx, 0, { b: 'ا', m: '' });
          offset += 1;
        }
      } else if (idx === tokens.length) {
        // درج در انتها
        tokens.push({ b: 'ا', m: '' });
      }
    }
  
    return joinTokens(tokens);
  }
  
  // ---------- Example usage ----------
  // console.log(applyOrthographyFixes('خ\u064eوا\u0631', { silent_waw_idx: '1' })); // نمونهٔ فرضی
  // console.log(applyOrthographyFixes('دوره', { waw_o_exception_idx: '1' }));       // «دُره»
  // console.log(applyOrthographyFixes('چهار', { spoken_A_grapheme_idx: '2' }));     // «چاهار»
  // console.log(applyOrthographyFixes('اعلی', { spoken_A_grapheme_idx: '2' }));     // «اعلا»
  
  // اگر خواستی به‌صورت ماژول استفاده کنی:
  // export { applyOrthographyFixes };
  