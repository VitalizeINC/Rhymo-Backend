/**
 * Small text tools for the blog: slugs, plain text, word counts, heading ids.
 * They work for Persian and English.
 */

const ZWNJ = '‌';

/** Same letters for the same sound: Arabic yeh/kaf become Persian, marks go. */
export function normalizeFa(s = '') {
    return String(s)
        .replace(/[يى]/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/[ۀة]/g, 'ه')
        .replace(/[ً-ٰٟ]/g, '') // short vowel marks
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** For matching a keyword in text: one form for letters, spaces and case. */
export function matchForm(s = '') {
    return normalizeFa(s).replace(new RegExp(ZWNJ, 'g'), ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * A URL part from a title. Persian letters stay (browsers and Google show
 * them as they are); spaces and half-spaces become "-".
 */
export function slugify(text = '') {
    return normalizeFa(text)
        .toLowerCase()
        .replace(new RegExp(ZWNJ, 'g'), '-')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .trim()
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/g, '');
}

/** True for a slug we accept as typed by an editor. */
export function isValidSlug(slug = '') {
    return /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug) && slug.length <= 120;
}

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&zwnj;': ZWNJ };

export function htmlToText(html = '') {
    return String(html)
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<\/(p|h[1-6]|li|blockquote|pre|tr|figcaption)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
}

export function countWords(text = '') {
    const words = String(text).replace(new RegExp(ZWNJ, 'g'), '').match(/[\p{L}\p{N}]+/gu);
    return words ? words.length : 0;
}

/** About 200 words a minute in Persian, 230 in English. */
export function readingMinutes(words, lang = 'fa') {
    return Math.max(1, Math.round(words / (lang === 'en' ? 230 : 200)));
}

/** A short summary from the text, cut at a word end. */
export function summarize(text = '', max = 160) {
    const t = String(text).replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const end = cut.lastIndexOf(' ');
    return (end > max * 0.6 ? cut.slice(0, end) : cut).replace(/[،,.;:!?؟\s]+$/u, '') + '…';
}

export function escapeHtml(s = '') {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Unique, readable ids for headings, so the contents list can link to them. */
export function headingIds() {
    const used = new Set();
    return (text) => {
        let base = slugify(text) || 'section';
        let id = base;
        let n = 2;
        while (used.has(id)) id = `${base}-${n++}`;
        used.add(id);
        return id;
    };
}

/** Clean tags: trimmed, single-spaced, no "#", no repeats, at most 10. */
export function cleanTags(tags) {
    const list = Array.isArray(tags) ? tags : String(tags || '').split(/[,،]/);
    const seen = new Set();
    const out = [];
    for (const raw of list) {
        const t = normalizeFa(String(raw)).replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, 40);
        const key = t.toLowerCase();
        if (t && !seen.has(key)) { seen.add(key); out.push(t); }
        if (out.length >= 10) break;
    }
    return out;
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export function faDigits(n) {
    return String(n).replace(/\d/g, (d) => FA_DIGITS[d]);
}
