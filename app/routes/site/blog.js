import express from 'express';
import fs from 'fs';
import path from 'path';
import BlogPost from '../../models/blogPost.js';
import {
    PAGE_SIZE, renderHomeSection, renderList, renderPost, renderRss, sitemapEntries, strings, postPath,
} from '../../helpers/blog/site.js';

/**
 * Public blog pages on rhymo.app. Mounted before the static files, so it also
 * adds the "latest posts" section to the home pages and the blog posts to
 * sitemap.xml.
 *
 *   /blog/                      list (Persian)      /en/blog/ … the same in English
 *   /blog/page/2/               more pages
 *   /blog/tag/<tag>/            posts with one tag
 *   /blog/<slug>/               one post
 *   /blog/feed.xml              RSS
 *
 * Rendered pages are kept in memory for a minute and dropped whenever a post
 * is saved (clearBlogCache), so new posts show at once and scheduled posts
 * show within a minute of their time.
 */
const router = express.Router();
const VIEWS = path.resolve('resource/views');
const CACHE_MS = 60 * 1000;
const cache = new Map();

export function clearBlogCache() {
    cache.clear();
}

async function cached(key, make) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await make();
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return value;
}

const LIST_FIELDS = 'lang title slug excerpt cover tags publishedAt updatedAt readingMinutes featured content';

/** Lists keep only a short part of the content, for excerpts. */
function trimForList(posts) {
    return posts.map((p) => ({ ...p, content: p.excerpt ? '' : String(p.content || '').slice(0, 1500) }));
}

async function publicTags(lang) {
    const rows = await BlogPost.aggregate([
        { $match: BlogPost.publicFilter(lang) },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 14 },
    ]);
    return rows.map((r) => ({ tag: r._id, count: r.count }));
}

function sendHtml(res, html, status = 200) {
    res.status(status)
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'public, max-age=0, s-maxage=60')
        .send(html);
}

function notFound(res) {
    const file = path.join(VIEWS, '404.html');
    const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : 'Not found';
    res.status(404).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'no-store').send(html);
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Always end blog URLs with "/", like the rest of the site.
router.use((req, res, next) => {
    const p = req.path;
    if (/^\/(en\/)?blog(\/.*)?$/.test(p) && !p.endsWith('/') && !p.endsWith('.xml')) {
        const q = req.originalUrl.slice(req.path.length);
        return res.redirect(301, p + '/' + q);
    }
    next();
});

// ---------- Lists ----------

async function list(req, res, lang, pageNo, tag = null) {
    if (!Number.isInteger(pageNo) || pageNo < 1) return notFound(res);
    const html = await cached(`list:${lang}:${tag || ''}:${pageNo}`, async () => {
        const filter = BlogPost.publicFilter(lang, tag ? { tags: tag } : {});
        const total = await BlogPost.countDocuments(filter);
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (pageNo > pages || (tag && !total)) return null;
        const posts = await BlogPost.find(filter).select(LIST_FIELDS)
            .sort({ publishedAt: -1 }).skip((pageNo - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean();
        const otherLang = lang === 'fa' ? 'en' : 'fa';
        const hasOther = (await BlogPost.countDocuments(BlogPost.publicFilter(otherLang))) > 0;
        return renderList({ lang, posts: trimForList(posts), page: pageNo, pages, tag, tags: await publicTags(lang), hasOther });
    });
    return html ? sendHtml(res, html) : notFound(res);
}

for (const lang of ['fa', 'en']) {
    const base = lang === 'en' ? '/en/blog' : '/blog';
    router.get(`${base}/`, wrap((req, res) => list(req, res, lang, 1)));
    router.get(`${base}/page/:n/`, wrap((req, res) => {
        const n = Number(req.params.n);
        if (n === 1) return res.redirect(301, `${base}/`);
        return list(req, res, lang, n);
    }));
    router.get(`${base}/tag/:tag/`, wrap((req, res) => list(req, res, lang, 1, req.params.tag)));
    router.get(`${base}/tag/:tag/page/:n/`, wrap((req, res) => list(req, res, lang, Number(req.params.n), req.params.tag)));

    router.get(`${base}/feed.xml`, wrap(async (req, res) => {
        const xml = await cached(`rss:${lang}`, async () => {
            const posts = await BlogPost.find(BlogPost.publicFilter(lang)).select(LIST_FIELDS)
                .sort({ publishedAt: -1 }).limit(30).lean();
            return renderRss(lang, trimForList(posts));
        });
        res.set('Content-Type', 'application/rss+xml; charset=utf-8').set('Cache-Control', 'public, max-age=0, s-maxage=300').send(xml);
    }));

    // ---------- One post ----------
    router.get(`${base}/:slug/`, wrap(async (req, res) => {
        const slug = req.params.slug;
        const result = await cached(`post:${lang}:${slug}`, async () => {
            const post = await BlogPost.findOne(BlogPost.publicFilter(lang, { slug })).lean();
            if (!post) {
                // An old address of a post that was renamed: send people and search engines on.
                const moved = await BlogPost.findOne(BlogPost.publicFilter(lang, { oldSlugs: slug })).select('lang slug').lean();
                return moved ? { redirect: postPath(moved) } : null;
            }
            const [translation, related] = await Promise.all([
                post.translation ? BlogPost.findOne(BlogPost.publicFilter(null, { _id: post.translation })).select('lang slug').lean() : null,
                relatedPosts(post),
            ]);
            return { id: post._id, html: renderPost(post, { translation, related: trimForList(related) }) };
        });
        if (!result) return notFound(res);
        if (result.redirect) return res.redirect(301, result.redirect);
        if (!/bot|crawl|spider|slurp|preview|facebookexternalhit/i.test(req.get('user-agent') || '')) {
            BlogPost.updateOne({ _id: result.id }, { $inc: { views: 1 } }).catch(() => {});
        }
        return sendHtml(res, result.html);
    }));
}

/** Up to three other posts: same tags first, then the newest. */
export async function relatedPosts(post) {
    const base = BlogPost.publicFilter(post.lang, { _id: { $ne: post._id } });
    const sameTag = post.tags?.length
        ? await BlogPost.find({ ...base, tags: { $in: post.tags } }).select(LIST_FIELDS).sort({ publishedAt: -1 }).limit(3).lean()
        : [];
    if (sameTag.length >= 3) return sameTag;
    const more = await BlogPost.find({ ...base, _id: { $nin: [post._id, ...sameTag.map((p) => p._id)] } })
        .select(LIST_FIELDS).sort({ publishedAt: -1 }).limit(3 - sameTag.length).lean();
    return [...sameTag, ...more];
}

// ---------- Home pages: add the latest posts ----------

const MARK = '<!--blog:latest-->';
for (const [lang, route, file] of [['fa', '/', 'index.html'], ['en', '/en/', 'en/index.html']]) {
    const handler = wrap(async (req, res, next) => {
        const full = path.join(VIEWS, file);
        const html = await cached(`home:${lang}:${fs.statSync(full).mtimeMs}`, async () => {
            const page = fs.readFileSync(full, 'utf8');
            if (!page.includes(MARK)) return page;
            const posts = await BlogPost.find(BlogPost.publicFilter(lang)).select(LIST_FIELDS)
                .sort({ publishedAt: -1 }).limit(3).lean();
            const section = renderHomeSection(lang, trimForList(posts));
            if (!section) return page.replace(MARK, '');
            return page
                .replace('</head>', '<link rel="stylesheet" href="/assets/blog.css?v=1">\n</head>')
                .replace(MARK, section);
        });
        sendHtml(res, html);
    });
    router.get(route, handler);
    router.get(route + 'index.html', handler);
}

// ---------- sitemap.xml: the static pages plus the blog ----------

router.get('/sitemap.xml', wrap(async (req, res) => {
    const xml = await cached('sitemap', async () => {
        const base = fs.readFileSync(path.join(VIEWS, 'sitemap.xml'), 'utf8');
        const posts = await BlogPost.find(BlogPost.publicFilter(null)).select('lang slug updatedAt publishedAt cover translation seo')
            .sort({ publishedAt: -1 }).lean();
        const ids = posts.filter((p) => p.translation).map((p) => p.translation);
        const translations = ids.length
            ? await BlogPost.find(BlogPost.publicFilter(null, { _id: { $in: ids } })).select('lang slug').lean()
            : [];
        let out = base;
        if (!/xmlns:image=/.test(out)) {
            out = out.replace('<urlset ', '<urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ');
        }
        return out.replace('</urlset>', sitemapEntries(posts, translations) + '</urlset>');
    });
    res.set('Content-Type', 'application/xml; charset=utf-8').set('Cache-Control', 'public, max-age=0, s-maxage=300').send(xml);
}));

export default router;
export { strings };
