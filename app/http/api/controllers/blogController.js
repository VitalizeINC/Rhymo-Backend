import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import multer from 'multer';
import sharp from 'sharp';
import controller from './controller.js';
import BlogPost from '../../../models/blogPost.js';
import { sanitizePostHtml } from '../../../helpers/blog/sanitize.js';
import { cleanTags, countWords, htmlToText, isValidSlug, readingMinutes, slugify, summarize } from '../../../helpers/blog/text.js';
import { postPath, renderPost, SITE } from '../../../helpers/blog/site.js';
import { clearBlogCache, relatedPosts } from '../../../routes/site/blog.js';

/**
 * Blog posts for the admin panel, and the public blog API for the apps.
 *
 * Messages for the panel are in Persian (the panel shows Persian text from
 * the server as it is). Saving always cleans the HTML, works out the word
 * count and reading time, keeps old slugs for redirects, and keeps the fa/en
 * translation link the same on both posts.
 */

const UPLOAD_DIR = path.resolve('public/uploads/blog');
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => cb(null, IMAGE_TYPES.includes(file.mimetype)),
});

const isId = (id) => mongoose.isValidObjectId(id);

function statusOf(p) {
    if (p.status !== 'published') return 'draft';
    return p.publishedAt && new Date(p.publishedAt) > new Date() ? 'scheduled' : 'published';
}

function listItem(p) {
    return {
        id: String(p._id),
        lang: p.lang,
        title: p.title,
        slug: p.slug,
        state: statusOf(p),
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
        cover: p.cover?.url ? p.cover : null,
        tags: p.tags || [],
        featured: !!p.featured,
        views: p.views || 0,
        wordCount: p.wordCount || 0,
        hasTranslation: !!p.translation,
        url: SITE + postPath(p),
    };
}

function fullPost(p) {
    return { ...listItem(p), excerpt: p.excerpt, content: p.content, authorName: p.authorName,
        status: p.status, translation: p.translation ? String(p.translation) : null,
        seo: p.seo || {}, readingMinutes: p.readingMinutes, createdAt: p.createdAt,
        createdBy: p.createdBy, updatedBy: p.updatedBy };
}

/** A cover or image URL we are happy to store: our uploads or any https link. */
function cleanImage(img) {
    if (!img || typeof img !== 'object') return { url: '', alt: '', width: null, height: null };
    const url = String(img.url || '').trim();
    const okUrl = /^\/uploads\/blog\/[\w\-/.]+$/.test(url) || /^https:\/\/[^\s"'<>]+$/.test(url);
    return {
        url: okUrl ? url : '',
        alt: String(img.alt || '').trim().slice(0, 250),
        width: Number(img.width) > 0 ? Math.round(Number(img.width)) : null,
        height: Number(img.height) > 0 ? Math.round(Number(img.height)) : null,
    };
}

class BlogController extends controller {
    // ---------- Admin ----------

    async list(req, res) {
        const { q = '', state = '', lang = '' } = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 20));
        const now = new Date();
        const filter = {};
        if (lang === 'fa' || lang === 'en') filter.lang = lang;
        if (state === 'draft') filter.status = 'draft';
        if (state === 'published') Object.assign(filter, { status: 'published', publishedAt: { $lte: now } });
        if (state === 'scheduled') Object.assign(filter, { status: 'published', publishedAt: { $gt: now } });
        if (q.trim()) {
            const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ title: rx }, { slug: rx }, { tags: rx }];
        }
        const [rows, total, counts] = await Promise.all([
            BlogPost.find(filter).select('-content').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            BlogPost.countDocuments(filter),
            BlogPost.aggregate([{ $group: {
                _id: null,
                all: { $sum: 1 },
                draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
                scheduled: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'published'] }, { $gt: ['$publishedAt', now] }] }, 1, 0] } },
                published: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'published'] }, { $lte: ['$publishedAt', now] }] }, 1, 0] } },
                views: { $sum: '$views' },
            } }]),
        ]);
        const c = counts[0] || { all: 0, draft: 0, scheduled: 0, published: 0, views: 0 };
        delete c._id;
        res.json({ posts: rows.map(listItem), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit, counts: c });
    }

    async show(req, res) {
        if (!isId(req.params.id)) return res.status(404).json('نوشته پیدا نشد.');
        const post = await BlogPost.findById(req.params.id).lean();
        if (!post) return res.status(404).json('نوشته پیدا نشد.');
        res.json(fullPost(post));
    }

    async tags(req, res) {
        const rows = await BlogPost.aggregate([
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 200 },
        ]);
        res.json(rows.map((r) => ({ tag: r._id, count: r.count })));
    }

    /** Is this slug free in this language? Also suggests one from a title. */
    async slugCheck(req, res) {
        const lang = req.query.lang === 'en' ? 'en' : 'fa';
        const slug = slugify(req.query.slug || req.query.title || '');
        const taken = slug ? await this.slugTaken(lang, slug, req.query.id) : false;
        res.json({ slug, valid: isValidSlug(slug), available: !taken });
    }

    async slugTaken(lang, slug, exceptId) {
        const q = { lang, $or: [{ slug }, { oldSlugs: slug }] };
        if (exceptId && isId(exceptId)) q._id = { $ne: exceptId };
        return !!(await BlogPost.exists(q));
    }

    async create(req, res) {
        return this.save(req, res, null);
    }

    async update(req, res) {
        if (!isId(req.params.id)) return res.status(404).json('نوشته پیدا نشد.');
        const post = await BlogPost.findById(req.params.id);
        if (!post) return res.status(404).json('نوشته پیدا نشد.');
        return this.save(req, res, post);
    }

    async save(req, res, post) {
        const b = req.body || {};
        const isNew = !post;
        if (isNew) post = new BlogPost({ createdBy: req.user?.email || '' });

        // Optimistic lock: refuse to overwrite a newer save from another tab.
        if (!isNew && b.updatedAt && post.updatedAt && new Date(b.updatedAt).getTime() !== post.updatedAt.getTime()) {
            return res.status(409).json('این نوشته در جای دیگری ذخیره شده. صفحه را دوباره باز کن تا آخرین نسخه را ببینی.');
        }

        const title = String(b.title ?? post.title ?? '').replace(/\s+/g, ' ').trim();
        if (!title) return res.status(400).json('عنوان نوشته را بنویس.');
        const lang = b.lang === 'en' ? 'en' : b.lang === 'fa' ? 'fa' : (post.lang || 'fa');

        let slug = String(b.slug ?? post.slug ?? '').trim();
        slug = slug ? slugify(slug) : slugify(title);
        if (!slug) slug = `post-${Date.now().toString(36)}`;
        if (!isValidSlug(slug)) return res.status(400).json('نشانی (slug) فقط می‌تواند حرف، عدد و خط تیره داشته باشد.');
        if (await this.slugTaken(lang, slug, post._id)) {
            return res.status(409).json('این نشانی برای نوشتهٔ دیگری استفاده شده. نشانی دیگری بنویس.');
        }

        const status = b.status === 'published' ? 'published' : b.status === 'draft' ? 'draft' : post.status;
        let publishedAt = b.publishedAt !== undefined ? (b.publishedAt ? new Date(b.publishedAt) : null) : post.publishedAt;
        if (publishedAt && isNaN(publishedAt)) return res.status(400).json('تاریخ انتشار درست نیست.');
        if (status === 'published' && !publishedAt) publishedAt = new Date();

        const content = b.content !== undefined ? sanitizePostHtml(b.content) : post.content;
        const text = htmlToText(content);
        if (status === 'published' && countWords(text) < 1) return res.status(400).json('نوشتهٔ خالی را نمی‌شود منتشر کرد.');

        const seo = b.seo || {};
        const canonical = String(seo.canonical ?? post.seo?.canonical ?? '').trim();
        if (canonical && !/^https:\/\/[^\s"'<>]+$/.test(canonical)) return res.status(400).json('نشانی canonical باید با https:// شروع شود.');

        // A post that was public keeps its old address as a redirect.
        if (!isNew && post.slug && post.slug !== slug && (post.status === 'published' || (post.oldSlugs || []).length)) {
            post.oldSlugs = [...new Set([...(post.oldSlugs || []), post.slug])].filter((s) => s !== slug);
        }

        Object.assign(post, {
            lang, title, slug, status, publishedAt, content,
            excerpt: String(b.excerpt ?? post.excerpt ?? '').replace(/\s+/g, ' ').trim().slice(0, 500),
            cover: b.cover !== undefined ? cleanImage(b.cover) : post.cover,
            tags: b.tags !== undefined ? cleanTags(b.tags) : post.tags,
            featured: b.featured !== undefined ? !!b.featured : post.featured,
            authorName: String(b.authorName ?? post.authorName ?? '').trim().slice(0, 80),
            updatedBy: req.user?.email || '',
            wordCount: countWords(text),
            readingMinutes: readingMinutes(countWords(text), lang),
            seo: {
                title: String(seo.title ?? post.seo?.title ?? '').trim().slice(0, 200),
                description: String(seo.description ?? post.seo?.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 320),
                focusKeyword: String(seo.focusKeyword ?? post.seo?.focusKeyword ?? '').trim().slice(0, 100),
                canonical,
                noindex: seo.noindex !== undefined ? !!seo.noindex : !!post.seo?.noindex,
            },
        });

        // Translation: the other language's post, linked both ways.
        if (b.translation !== undefined) {
            const before = post.translation ? String(post.translation) : null;
            const next = b.translation && isId(b.translation) ? String(b.translation) : null;
            if (next) {
                const other = await BlogPost.findById(next).select('lang translation');
                if (!other || other.lang === lang || String(other._id) === String(post._id)) {
                    return res.status(400).json('ترجمه باید نوشته‌ای به زبان دیگر باشد.');
                }
            }
            post.translation = next;
            await post.save();
            if (before && before !== next) await BlogPost.updateOne({ _id: before, translation: post._id }, { translation: null });
            if (next) {
                const other = await BlogPost.findById(next).select('translation');
                if (other.translation && String(other.translation) !== String(post._id)) {
                    await BlogPost.updateOne({ _id: other.translation, translation: other._id }, { translation: null });
                }
                await BlogPost.updateOne({ _id: next }, { translation: post._id });
            }
        } else {
            await post.save();
        }

        clearBlogCache();
        res.status(isNew ? 201 : 200).json(fullPost(post.toObject()));
    }

    async remove(req, res) {
        if (!isId(req.params.id)) return res.status(404).json('نوشته پیدا نشد.');
        const post = await BlogPost.findByIdAndDelete(req.params.id);
        if (!post) return res.status(404).json('نوشته پیدا نشد.');
        if (post.translation) await BlogPost.updateOne({ _id: post.translation }, { translation: null });
        clearBlogCache();
        res.json({ deleted: true });
    }

    /** The post as the public page will look, even before it is published. */
    async preview(req, res) {
        if (!isId(req.params.id)) return res.status(404).send('Not found');
        const post = await BlogPost.findById(req.params.id).lean();
        if (!post) return res.status(404).send('Not found');
        const translation = post.translation ? await BlogPost.findById(post.translation).select('lang slug').lean() : null;
        const related = await relatedPosts(post);
        if (!post.publishedAt) post.publishedAt = new Date();
        res.set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'no-store')
            .set('X-Robots-Tag', 'noindex')
            .send(renderPost(post, { translation, related, preview: true }));
    }

    /**
     * An image for a post. Saved as WebP, at most 1600px wide, with an
     * 800px copy for lists ("-sm.webp"). Returns the URL and size.
     */
    async uploadImage(req, res) {
        if (!req.file) return res.status(400).json('یک تصویر JPG، PNG، WebP، GIF یا AVIF تا ۱۲ مگابایت انتخاب کن.');
        const now = new Date();
        const dir = path.join(UPLOAD_DIR, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
        await fs.promises.mkdir(dir, { recursive: true });
        const base = (slugify(path.parse(req.file.originalname || '').name).replace(/[^a-z0-9-]/g, '') || 'image').slice(0, 40);
        const name = `${base}-${crypto.randomBytes(4).toString('hex')}`;
        let info;
        try {
            const img = sharp(req.file.buffer, { animated: false }).rotate();
            info = await img.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 })
                .toFile(path.join(dir, `${name}.webp`));
            await img.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 78 })
                .toFile(path.join(dir, `${name}-sm.webp`));
        } catch (e) {
            console.error('blog image upload failed', e);
            return res.status(400).json('این فایل تصویر قابل خواندن نیست.');
        }
        const url = `/uploads/blog/${path.relative(UPLOAD_DIR, dir).split(path.sep).join('/')}/${name}.webp`;
        res.status(201).json({ url, width: info.width, height: info.height, size: info.size });
    }

    // ---------- Public API (for the apps) ----------

    async publicList(req, res) {
        const lang = req.query.lang === 'en' ? 'en' : 'fa';
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(30, Math.max(1, parseInt(req.query.limit) || 10));
        const filter = BlogPost.publicFilter(lang, req.query.tag ? { tags: String(req.query.tag) } : {});
        const [rows, total] = await Promise.all([
            BlogPost.find(filter).select('lang title slug excerpt cover tags publishedAt updatedAt readingMinutes content')
                .sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            BlogPost.countDocuments(filter),
        ]);
        res.set('Cache-Control', 'public, max-age=60');
        res.json({
            posts: rows.map((p) => ({
                id: String(p._id), lang: p.lang, slug: p.slug, title: p.title,
                excerpt: p.excerpt || summarize(htmlToText(p.content || ''), 160),
                cover: p.cover?.url ? { ...p.cover, url: p.cover.url.startsWith('/') ? SITE + p.cover.url : p.cover.url } : null,
                tags: p.tags, publishedAt: p.publishedAt, readingMinutes: p.readingMinutes,
                url: SITE + postPath(p),
            })),
            page, pages: Math.max(1, Math.ceil(total / limit)), total,
        });
    }

    async publicShow(req, res) {
        const lang = req.params.lang === 'en' ? 'en' : 'fa';
        const p = await BlogPost.findOne(BlogPost.publicFilter(lang, { slug: req.params.slug })).lean();
        if (!p) return res.status(404).json({ error: 'Post not found' });
        res.set('Cache-Control', 'public, max-age=60');
        res.json({
            id: String(p._id), lang: p.lang, slug: p.slug, title: p.title, excerpt: p.excerpt,
            content: p.content.replace(/(src|href)="\/(?!\/)/g, `$1="${SITE}/`),
            cover: p.cover?.url ? { ...p.cover, url: p.cover.url.startsWith('/') ? SITE + p.cover.url : p.cover.url } : null,
            tags: p.tags, publishedAt: p.publishedAt, updatedAt: p.updatedAt,
            readingMinutes: p.readingMinutes, authorName: p.authorName, url: SITE + postPath(p),
        });
    }
}

export default new BlogController();
