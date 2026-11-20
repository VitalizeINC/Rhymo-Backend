/**
 * Publishes the blog's first post, "رایمو چیست؟ / What is Rhymo?", in Persian
 * and English, linked to each other. Safe to run again: it updates the posts.
 *
 *   node scripts/blog/publish-first-post.mjs /path/to/codex-images
 *
 * The folder must hold cover.png, word-bank.png and poetry-to-rap.png (made
 * with Codex). They are stored through the same upload code the admin panel
 * uses. The diagrams and animations live in resource/views/assets/blog/.
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

const [cover, bank, poetry] = await Promise.all([upload('cover.png'), upload('word-bank.png'), upload('poetry-to-rap.png')]);
const img = (i, alt) => `<img src="${i.url}" alt="${alt}" width="${i.width}" height="${i.height}">`;
const here = path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(here, 'first-post', f), 'utf8');

const posts = {
    fa: {
        lang: 'fa', slug: 'رایمو-چیست',
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
    },
    en: {
        lang: 'en', slug: 'what-is-rhymo',
        title: 'What is Rhymo? A writing desk for Persian rhyme, rhythm and song',
        excerpt: 'Type one word, get rhymes. Rhymo is a calm writing desk for Persian poetry, songs and rap: a sound-based rhyme finder, a syllable view, a word bank and a notepad that colors your rhymes.',
        content: read('post-en.html')
            .replace('{{wordbank}}', img(bank, 'A wooden card box with colored tabs, a picture of the Rhymo word bank'))
            .replace('{{poetry}}', img(poetry, 'A Persian reed pen and inkwell beside a studio microphone, joined by one sound wave')),
        cover: { ...cover, alt: 'A writing desk at dusk: an open notebook, a pen, a phone, and colored rhyme ribbons rising from the page' },
        tags: ['Rhymo', 'Persian poetry', 'Songwriting', 'Rap'],
        authorName: 'The Rhymo team',
        seo: {
            title: 'What is Rhymo? A Persian rhyme finder and lyric notebook',
            description: 'Rhymo is a free iPhone and iPad app for Persian poetry, lyrics and rap: find rhymes by sound, see syllables, save words and write in a color-coded notepad.',
            focusKeyword: 'Rhymo',
        },
    },
};

const saved = {};
for (const lang of ['fa', 'en']) {
    const p = posts[lang];
    const body = { ...p, status: 'published', featured: true };
    const existing = await BlogPost.findOne({ lang, slug: p.slug }).select('_id publishedAt');
    if (existing?.publishedAt) body.publishedAt = existing.publishedAt;
    saved[lang] = existing
        ? await call(ctl.update.bind(ctl), { params: { id: String(existing._id) }, body })
        : await call(ctl.create.bind(ctl), { body });
    console.log(lang, saved[lang].state, saved[lang].url, `${saved[lang].wordCount} words`);
}
await call(ctl.update.bind(ctl), { params: { id: saved.en.id }, body: { translation: saved.fa.id } });
console.log('linked fa <-> en');
await mongoose.disconnect();
