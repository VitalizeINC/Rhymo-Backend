import mongoose from 'mongoose';
import { Schema } from 'mongoose';

/**
 * BlogPost
 * --------
 * One article on rhymo.app/blog (Persian) or rhymo.app/en/blog (English).
 *
 * A post is public when status is "published" and publishedAt is not in the
 * future. A published post with a future publishedAt is "scheduled": it
 * appears by itself at that time, with no job needed, because every public
 * query checks the time.
 *
 * `content` is HTML from the admin editor, cleaned by
 * app/helpers/blog/sanitize.js before it is stored.
 *
 * `slug` is unique per language. When an editor changes it, the old one is
 * kept in `oldSlugs` so old links answer with a permanent redirect.
 *
 * `translation` links a Persian post and its English version (both ways), so
 * each page can tell search engines about the other one (hreflang).
 */
const imageSchema = new Schema({
    url: { type: String, trim: true, default: '' },
    alt: { type: String, trim: true, default: '', maxlength: 250 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
}, { _id: false });

const blogPostSchema = new Schema({
    lang: { type: String, enum: ['fa', 'en'], default: 'fa', index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, maxlength: 120 },
    oldSlugs: { type: [String], default: [] },
    excerpt: { type: String, trim: true, default: '', maxlength: 500 },
    content: { type: String, default: '' },
    cover: { type: imageSchema, default: () => ({}) },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date, default: null, index: true },
    featured: { type: Boolean, default: false },
    authorName: { type: String, trim: true, default: '', maxlength: 80 },
    createdBy: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    translation: { type: Schema.Types.ObjectId, ref: 'BlogPost', default: null },
    seo: {
        title: { type: String, trim: true, default: '', maxlength: 200 },
        description: { type: String, trim: true, default: '', maxlength: 320 },
        focusKeyword: { type: String, trim: true, default: '', maxlength: 100 },
        canonical: { type: String, trim: true, default: '', maxlength: 500 },
        noindex: { type: Boolean, default: false },
    },
    // Worked out from the content on every save.
    wordCount: { type: Number, default: 0 },
    readingMinutes: { type: Number, default: 1 },
    views: { type: Number, default: 0 },
}, { timestamps: true });

blogPostSchema.index({ lang: 1, slug: 1 }, { unique: true });
blogPostSchema.index({ lang: 1, oldSlugs: 1 });
blogPostSchema.index({ status: 1, lang: 1, publishedAt: -1 });
blogPostSchema.index({ tags: 1 });

/** The query for posts anyone may see right now. */
blogPostSchema.statics.publicFilter = function (lang, extra = {}) {
    const q = { status: 'published', publishedAt: { $ne: null, $lte: new Date() }, ...extra };
    if (lang) q.lang = lang;
    return q;
};

blogPostSchema.methods.isPublic = function () {
    return this.status === 'published' && this.publishedAt && this.publishedAt <= new Date();
};

const BlogPost = mongoose.model('BlogPost', blogPostSchema);
export default BlogPost;
