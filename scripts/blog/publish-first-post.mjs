/**
 * Publishes the blog's first posts. They are two separate posts, not
 * translations of each other:
 *   fa  «رایمو چیست؟»            about the Persian app
 *   en  "Rhymo in English"       about the English version (not released yet)
 * Safe to run again: existing posts are updated.
 *
 *   node scripts/blog/publish-first-post.mjs <images folder> [fa,en]
 *
 * Images (made with Codex):
 *   fa: cover.png, word-bank.png, poetry-to-rap.png
 *   en: cover-en.png, wordbank-en.png, studio-en.png
 * They are stored through the same upload code the admin panel uses. The
 * diagrams and animations live in resource/views/assets/blog/.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config({ path: ['.env.local', '.env'] });

const dir = process.argv[2];
if (!dir) { console.error('Usage: node scripts/blog/publish-first-post.mjs <images folder>'); process.exit(1); }
await mongoose.connect(process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/RHYMO');
const { default: ctl } = await import('../../app/http/api/controllers/blogController.js');
const { default: BlogPost } = await import('../../app/models/blogPost.js');

const user = { email: 'claude@rhymo.app' };
const call = async (fn, req) => {
    const res = { code: 200, body: null };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    res.set = () => res; res.send = (b) => { res.body = b; return res; };
    await fn({ user, params: {}, query: {}, ...req }, res);
    if (res.code >= 400) throw new Error(`${res.code} ${JSON.stringify(res.body)}`);
    return res.body;
};
const upload = (name) => call(ctl.uploadImage.bind(ctl), {
    file: { buffer: fs.readFileSync(path.join(dir, name)), originalname: name, mimetype: 'image/png' },
});

const langs = (process.argv[3] || 'fa,en').split(',');
const img = (i, alt) => `<img src="${i.url}" alt="${alt}" width="${i.width}" height="${i.height}">`;
const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, 'first-post', f), 'utf8');

async function build(lang) {
    if (lang === 'fa') {
        const [cover, bank, poetry] = await Promise.all([upload('cover.png'), upload('word-bank.png'), upload('poetry-to-rap.png')]);
        return {
            lang: 'fa', slug: 'رایمو-چیست', oldSlugs: [],
            title: 'رایمو چیست؟ میز تحریری برای قافیه، هجا و ترانهٔ فارسی',
            excerpt: 'یک واژه بنویس و قافیه بگیر. رایمو میز تحریر آرامی برای شعر، ترانه و رپ فارسی است: قافیه‌یاب آوایی، تحلیل هجا، بانک واژه و نوت‌پدی که قافیه‌ها را رنگی می‌کند.',
            content: read('post-fa.html')
                .replace('{{wordbank}}', img(bank, 'جعبهٔ کارت چوبی با برگه‌های رنگی؛ نمادی از بانک واژهٔ رایمو'))
                .replace('{{poetry}}', img(poetry, 'قلم نی و دوات کنار میکروفون استودیو؛ موج صدایی که شعر کلاسیک را به رپ وصل می‌کند')),
            cover: { ...cover, alt: 'میز تحریر شبانه با دفتر باز، قلم، گوشی و نوارهای رنگی قافیه که از دفتر بالا می‌روند' },
            tags: ['معرفی رایمو', 'قافیه', 'ترانه‌سرایی', 'رپ فارسی'],
            authorName: 'تیم رایمو',
            seo: {
                title: 'رایمو چیست؟ اپ قافیه‌یاب و دفتر ترانهٔ فارسی',
                description: 'رایمو اپ رایگان ترانه‌سرایی فارسی است: قافیه را از روی صدا پیدا کن، هجاها را ببین، واژه‌ها را در بانک واژه نگه دار و در نوت‌پد رنگی بنویس.',
                focusKeyword: 'رایمو',
            },
        };
    }
    const [cover, bank, studio] = await Promise.all([upload('cover-en.png'), upload('wordbank-en.png'), upload('studio-en.png')]);
    return {
        lang: 'en', slug: 'rhymo-in-english', oldSlugs: ['what-is-rhymo'],
        title: 'Rhymo in English: a rhyme finder and lyric notebook for songwriters (coming soon)',
        excerpt: 'A first look at the English version of Rhymo: perfect, near and multi-syllable rhymes found by sound, syllables and stress, a word bank, and a notepad that colors your rhymes.',
        content: read('post-en.html')
            .replace('{{wordbank}}', img(bank, 'Glass jars of blank paper slips with colored tags on a wooden shelf, a picture of the Rhymo word bank'))
            .replace('{{studio}}', img(studio, 'A record player, an open notebook and a microphone joined by one sound wave that turns into rhythmic bars')),
        cover: { ...cover, alt: 'A home studio desk at night with a songwriting notebook, headphones, a microphone and colored rhyme ribbons rising from the page' },
        tags: ['Rhymo', 'Rhyme finder', 'Songwriting', 'Rap'],
        authorName: 'The Rhymo team',
        seo: {
            title: 'Rhymo in English: a rhyme finder and lyric notebook',
            description: 'A first look at Rhymo in English, coming soon: perfect, near and multi-syllable rhymes, syllables and stress, a word bank and a notepad that colors rhymes.',
            focusKeyword: 'rhyme finder',
        },
    };
}

for (const lang of langs) {
    const p = await build(lang);
    const body = { ...p, status: 'published', featured: true, translation: null };
    delete body.oldSlugs;
    const existing = await BlogPost.findOne({ lang, $or: [{ slug: p.slug }, ...p.oldSlugs.map((s) => ({ slug: s }))] }).select('_id publishedAt');
    if (existing?.publishedAt) body.publishedAt = existing.publishedAt;
    const out = existing
        ? await call(ctl.update.bind(ctl), { params: { id: String(existing._id) }, body })
        : await call(ctl.create.bind(ctl), { body });
    console.log(lang, out.state, out.url, `${out.wordCount} words`, out.translation ? 'linked' : 'standalone');
}
await mongoose.disconnect();
