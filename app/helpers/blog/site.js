import fs from 'fs';
import path from 'path';
import { escapeHtml as esc, faDigits, headingIds, htmlToText, paragraphText, summarize } from './text.js';

/**
 * Server-rendered blog pages for rhymo.app.
 *
 * Every page is full HTML from the server, so search engines read the whole
 * post without running JavaScript. Each page has its title, description,
 * canonical link, fa/en alternates (hreflang), Open Graph and Twitter cards,
 * and JSON-LD (BlogPosting, Blog, BreadcrumbList).
 *
 * The header and footer are taken from the site's own privacy page at run
 * time, so the blog always matches the rest of the site. Only the head and
 * the <main> part are made here.
 */

export const SITE = (process.env.SITE_URL || 'https://rhymo.app').replace(/\/+$/, '');
const VIEWS = path.resolve('resource/views');
export const PAGE_SIZE = 12;

const T = {
    fa: {
        dir: 'rtl', locale: 'fa_IR', inLanguage: 'fa-IR', root: '/blog/', home: '/',
        site: 'رایمو', blog: 'وبلاگ', blogTitle: 'وبلاگ رایمو',
        listTitle: 'وبلاگ رایمو — آموزش قافیه، شعر و ترانه',
        listDesc: 'آموزش قافیه، هجا و وزن، نکته‌های ترانه‌سرایی و رپ فارسی، و تازه‌های رایمو.',
        heroH1: 'نوشته‌هایی دربارهٔ <em>قافیه و ترانه.</em>',
        heroLede: 'آموزش قافیه، هجا و وزن، نکته‌های ترانه‌سرایی و رپ فارسی، و تازه‌های رایمو.',
        all: 'همه', toc: 'در این نوشته', tags: 'برچسب‌ها', share: 'هم‌رسانی',
        copy: 'کپی پیوند', copied: 'کپی شد', related: 'نوشته‌های بیشتر',
        newer: 'جدیدتر', older: 'قدیمی‌تر', pageN: (n) => `صفحهٔ ${faDigits(n)}`,
        empty: 'هنوز نوشته‌ای اینجا نیست. به‌زودی برمی‌گردیم.',
        tagTitle: (t) => `برچسب «${t}»`, tagDesc: (t) => `همهٔ نوشته‌های وبلاگ رایمو با برچسب «${t}».`,
        updated: 'به‌روزرسانی', minutes: (n) => `${faDigits(n)} دقیقه مطالعه`,
        ctaKicker: 'رایمو', ctaH2: 'قافیهٔ بعدی رو <em>با رایمو پیدا کن.</em>',
        ctaP: 'قافیه‌یاب، تحلیل هجا، بانک واژه و نوت‌پد، در یک اپ فارسی؛ برای iPhone، iPad و Android.',
        ctaBtn: 'دریافت از App Store', ctaHref: 'https://apps.apple.com/app/id6746544972',
        ctaBtn2: 'دریافت از Google Play', ctaHref2: 'https://play.google.com/store/apps/details?id=com.vitalize.rhymo',
        latestKicker: 'وبلاگ', latestH2: 'تازه‌ها از <em>وبلاگ.</em>',
        latestLede: 'آموزش‌ها و نکته‌های کوتاه برای شعر، ترانه و رپ فارسی.',
        allPosts: 'همهٔ نوشته‌ها', rss: 'خوراک RSS وبلاگ رایمو',
        author: 'تیم رایمو', crumbs: 'مسیر صفحه', pages: 'صفحه‌ها',
        preview: 'پیش‌نمایش — این صفحه هنوز عمومی نیست.',
        backToBlog: 'بازگشت به وبلاگ',
    },
    en: {
        dir: 'ltr', locale: 'en_US', inLanguage: 'en', root: '/en/blog/', home: '/en/',
        site: 'Rhymo', blog: 'Blog', blogTitle: 'Rhymo Blog',
        listTitle: 'Rhymo Blog — rhyme, poetry and songwriting',
        listDesc: 'Guides on rhyme, syllables and meter, tips for writing songs and rap, and news from Rhymo.',
        heroH1: 'Notes on <em>rhyme and song.</em>',
        heroLede: 'Guides on rhyme, syllables and meter, tips for writing songs and rap, and news from Rhymo.',
        all: 'All', toc: 'In this post', tags: 'Tags', share: 'Share',
        copy: 'Copy link', copied: 'Copied', related: 'More posts',
        newer: 'Newer', older: 'Older', pageN: (n) => `Page ${n}`,
        empty: 'No posts here yet. Check back soon.',
        tagTitle: (t) => `Tagged “${t}”`, tagDesc: (t) => `All Rhymo Blog posts tagged “${t}”.`,
        updated: 'Updated', minutes: (n) => `${n} min read`,
        ctaKicker: 'Rhymo in English', ctaH2: 'Your next line is <em>one word away.</em>',
        ctaP: 'The English version of Rhymo is on its way. We will announce it here on the blog first.',
        ctaBtn: 'More from the blog', ctaHref: '/en/blog/',
        latestKicker: 'Blog', latestH2: 'Fresh from <em>the blog.</em>',
        latestLede: 'Short guides and tips for poetry, songs and rap.',
        allPosts: 'All posts', rss: 'Rhymo Blog RSS feed',
        author: 'The Rhymo team', crumbs: 'Breadcrumb', pages: 'Pages',
        preview: 'Preview — this page is not public yet.',
        backToBlog: 'Back to the blog',
    },
};
export const strings = (lang) => T[lang === 'en' ? 'en' : 'fa'];

const APP_STORE = 'https://apps.apple.com/app/id6746544972';

// ---------- URLs ----------

export const postPath = (p) => `${strings(p.lang).root}${encodeURIComponent(p.slug)}/`;
export const tagPath = (lang, tag) => `${strings(lang).root}tag/${encodeURIComponent(tag)}/`;
export const listPath = (lang, page = 1, tag = null) =>
    (tag ? tagPath(lang, tag) : strings(lang).root) + (page > 1 ? `page/${page}/` : '');
const abs = (p) => (/^https?:\/\//i.test(p) ? p : SITE + p);

// ---------- Shell: the site's own header and footer ----------

const shellCache = {};
function shell(lang) {
    const file = path.join(VIEWS, lang === 'en' ? 'en/privacy/index.html' : 'privacy/index.html');
    const mtime = fs.statSync(file).mtimeMs;
    const hit = shellCache[lang];
    if (hit && hit.mtime === mtime) return hit;
    const html = fs.readFileSync(file, 'utf8');
    const headTail = html.slice(html.indexOf('<link rel="icon"'), html.indexOf('</head>')).trim();
    const top = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('<main id="main">'));
    const bottom = html.slice(html.indexOf('</main>') + '</main>'.length, html.lastIndexOf('</body>'));
    const mark = (html.match(/<svg class="bigmark"[\s\S]*?<\/svg>/) || [''])[0];
    const out = { mtime, headTail, top, bottom, mark };
    shellCache[lang] = out;
    return out;
}

/** The header, with its language switch pointing at `altHref`. */
function header(lang, altHref) {
    let top = shell(lang).top.replace(/(<a class="lang" href=")[^"]*(")/, `$1${altHref}$2`);
    // Add the blog to the menus if the static pages do not list it yet.
    const s = strings(lang);
    if (!top.includes(`href="${s.root}"`)) {
        top = top.replace(/(<nav class="links"[^>]*>[\s\S]*?)(<\/nav>)/, `$1<a href="${s.root}">${s.blog}</a>$2`);
    }
    return top;
}

// ---------- Small pieces ----------

const fmtDate = (d, lang) => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fa-IR-u-ca-persian', {
    year: 'numeric', month: 'long', day: 'numeric',
}).format(new Date(d));
const iso = (d) => new Date(d).toISOString();
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/** A card's or cover's image, with a small version for lists when there is one. */
function img(cover, { sizes, eager = false, cls = '' } = {}) {
    if (!cover?.url) return '';
    const url = esc(cover.url);
    const small = /^\/uploads\/blog\/.+\.webp$/.test(cover.url) ? cover.url.replace(/\.webp$/, '-sm.webp') : null;
    const srcset = small && cover.width > 800 ? ` srcset="${esc(small)} 800w, ${url} ${cover.width}w" sizes="${sizes || '100vw'}"` : '';
    const wh = cover.width && cover.height ? ` width="${cover.width}" height="${cover.height}"` : '';
    const load = eager ? ' fetchpriority="high"' : ' loading="lazy"';
    return `<img${cls ? ` class="${cls}"` : ''} src="${url}"${srcset}${wh} alt="${esc(cover.alt || '')}" decoding="async"${load}>`;
}

function excerptOf(post, max = 160) {
    return post.excerpt || summarize(paragraphText(post.content || ''), max);
}

function card(post, { lead = false, headingTag = 'h3' } = {}) {
    const s = strings(post.lang);
    const tag = post.tags?.[0];
    const media = post.cover?.url
        ? img(post.cover, { sizes: lead ? '(max-width: 860px) 100vw, 60vw' : '(max-width: 620px) 100vw, (max-width: 980px) 50vw, 33vw' })
        : `<span class="bcard-mark" aria-hidden="true">${shell(post.lang).mark}</span>`;
    return `<article class="bcard${lead ? ' lead' : ''}">
  <a class="bcard-link" href="${postPath(post)}">
    <figure class="bcard-img">${media}</figure>
    <div class="bcard-body">
      ${tag ? `<p class="bcard-tag">${esc(tag)}</p>` : ''}
      <${headingTag} class="bcard-title">${esc(post.title)}</${headingTag}>
      <p class="bcard-ex">${esc(excerptOf(post, lead ? 220 : 140))}</p>
      <p class="bcard-meta"><time datetime="${iso(post.publishedAt)}">${fmtDate(post.publishedAt, post.lang)}</time><span aria-hidden="true">·</span><span>${s.minutes(post.readingMinutes || 1)}</span></p>
    </div>
  </a>
</article>`;
}

function pager(lang, page, pages, tag) {
    if (pages <= 1) return '';
    const s = strings(lang);
    const n = (i) => (lang === 'en' ? String(i) : faDigits(i));
    let links = '';
    for (let i = 1; i <= pages; i++) {
        if (pages > 7 && i !== 1 && i !== pages && Math.abs(i - page) > 1) {
            if (!links.endsWith('…</span>')) links += '<span class="gap">…</span>';
            continue;
        }
        links += i === page
            ? `<span class="cur" aria-current="page">${n(i)}</span>`
            : `<a href="${listPath(lang, i, tag)}" aria-label="${s.pageN(i)}">${n(i)}</a>`;
    }
    const prev = page > 1 ? `<a class="step" rel="prev" href="${listPath(lang, page - 1, tag)}">${s.newer}</a>` : '';
    const next = page < pages ? `<a class="step" rel="next" href="${listPath(lang, page + 1, tag)}">${s.older}</a>` : '';
    return `<nav class="bpager" aria-label="${s.pages}">${prev}<span class="nums">${links}</span>${next}</nav>`;
}

// ---------- Page frame ----------

function page({ lang, title, description, canonical, alternates = {}, robots, og = {}, jsonLdList = [], extraHead = '', main, altHref, preview = false }) {
    const s = strings(lang);
    const sh = shell(lang);
    const alt = Object.entries(alternates)
        .map(([l, href]) => `<link rel="alternate" hreflang="${l}" href="${abs(href)}">`).join('');
    const ogImage = og.image ? abs(og.image) : `${SITE}/og.png`;
    const head = `<!doctype html>
<html lang="${lang}" dir="${s.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${preview ? `<base href="${SITE}/">` : ''}
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${preview ? 'noindex, nofollow' : robots || 'index, follow, max-image-preview:large, max-snippet:-1'}">
<meta name="theme-color" content="#5B5E3C">
<meta name="apple-itunes-app" content="app-id=6746544972">
<link rel="canonical" href="${abs(canonical)}">
${alt}
<meta property="og:type" content="${og.type || 'website'}">
<meta property="og:site_name" content="${s.site}">
<meta property="og:title" content="${esc(og.title || title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
${og.imageWidth ? `<meta property="og:image:width" content="${og.imageWidth}"><meta property="og:image:height" content="${og.imageHeight}">` : ''}
${og.imageAlt ? `<meta property="og:image:alt" content="${esc(og.imageAlt)}">` : ''}
<meta property="og:locale" content="${s.locale}">
${og.extra || ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(og.title || title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="alternate" type="application/rss+xml" title="${s.rss}" href="${abs(s.root + 'feed.xml')}">
${extraHead}
${jsonLdList.map(jsonLd).join('\n')}
${sh.headTail}
<link rel="stylesheet" href="/assets/blog.css?v=4">
</head>
<body class="blog-page">
${preview ? `<div class="preview-bar" role="status">${s.preview}</div>` : ''}`;
    return `${head}${header(lang, altHref)}<main id="main">
${main}
</main>${sh.bottom}
<script src="/assets/blog.js?v=1" defer></script>
</body>
</html>`;
}

const breadcrumbLd = (items) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(url) })),
});

const publisherLd = (lang) => ({
    '@type': 'Organization',
    name: strings(lang).site,
    url: SITE + strings(lang).home,
    logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png`, width: 512, height: 512 },
});

// ---------- Post content ----------

/** Adds heading ids (for the contents list), lazy images and scroll wrappers. */
export function prepareContent(html = '') {
    const id = headingIds();
    const toc = [];
    let firstImage = true;
    const out = String(html)
        .replace(/<h([234])([^>]*)>([\s\S]*?)<\/h\1>/g, (m, level, attrs, inner) => {
            const text = htmlToText(inner);
            const hid = id(text);
            if (level !== '4') toc.push({ level: Number(level), id: hid, text });
            return `<h${level}${attrs.replace(/\sid="[^"]*"/, '')} id="${hid}">${inner}</h${level}>`;
        })
        .replace(/<img\b([^>]*?)\s*\/?>/g, (m, attrs) => {
            const lazy = firstImage ? '' : ' loading="lazy"';
            firstImage = false;
            return `<img${attrs} decoding="async"${lazy}>`;
        })
        .replace(/<table>([\s\S]*?)<\/table>/g, '<div class="table-wrap"><table>$1</table></div>')
        .replace(/<iframe\b([^>]*)><\/iframe>/g, (m, attrs) =>
            `<iframe${attrs} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`)
        .replace(/<div data-youtube-video="?"?>/g, '<div class="video">');
    return { html: out, toc };
}

// ---------- Pages ----------

export function renderPost(post, { translation = null, related = [], preview = false } = {}) {
    const lang = post.lang;
    const s = strings(lang);
    const url = postPath(post);
    const canonical = post.seo?.canonical || url;
    const description = post.seo?.description || excerptOf(post, 160);
    const title = post.seo?.title || `${post.title} | ${s.blogTitle}`;
    const published = post.publishedAt || post.updatedAt || new Date();
    const modified = post.updatedAt || published;
    const author = post.authorName || s.author;
    const { html, toc } = prepareContent(post.content);

    const alternates = { [lang]: url };
    if (translation) alternates[translation.lang] = postPath(translation);
    if (translation) alternates['x-default'] = lang === 'fa' ? url : postPath(translation);
    const altHref = translation ? postPath(translation) : strings(lang === 'fa' ? 'en' : 'fa').root;

    const ld = [
        {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title.slice(0, 110),
            description,
            image: post.cover?.url ? [abs(post.cover.url)] : [`${SITE}/og.png`],
            datePublished: iso(published),
            dateModified: iso(modified),
            author: post.authorName
                ? { '@type': 'Person', name: author }
                : { '@type': 'Organization', name: s.site, url: SITE + s.home },
            publisher: publisherLd(lang),
            mainEntityOfPage: { '@type': 'WebPage', '@id': abs(url) },
            url: abs(url),
            inLanguage: s.inLanguage,
            wordCount: post.wordCount || undefined,
            keywords: (post.tags || []).join(', ') || undefined,
            articleSection: post.tags?.[0] || undefined,
            isPartOf: { '@type': 'Blog', name: s.blogTitle, url: abs(s.root) },
        },
        breadcrumbLd([[s.site, s.home], [s.blog, s.root], [post.title, url]]),
    ];

    const ogExtra = [
        `<meta property="article:published_time" content="${iso(published)}">`,
        `<meta property="article:modified_time" content="${iso(modified)}">`,
        ...(post.tags || []).map((t) => `<meta property="article:tag" content="${esc(t)}">`),
        translation ? `<meta property="og:locale:alternate" content="${strings(translation.lang).locale}">` : '',
    ].join('');

    const changedLater = new Date(modified) - new Date(published) > 2 * 864e5;
    const tocHtml = toc.filter((h) => h.level === 2).length >= 2
        ? `<nav class="toc" aria-label="${s.toc}"><b>${s.toc}</b>${toc.map((h) =>
            `<a href="#${esc(h.id)}"${h.level === 3 ? ' class="sub"' : ''}>${esc(h.text)}</a>`).join('')}</nav>`
        : '';
    const shareUrl = encodeURIComponent(abs(url));
    const shareText = encodeURIComponent(post.title);
    const share = `<div class="share"><b>${s.share}</b><div class="share-row">
  <a href="https://t.me/share/url?url=${shareUrl}&amp;text=${shareText}" rel="noopener" target="_blank" aria-label="Telegram">Telegram</a>
  <a href="https://x.com/intent/post?url=${shareUrl}&amp;text=${shareText}" rel="noopener" target="_blank" aria-label="X">X</a>
  <a href="https://wa.me/?text=${shareText}%20${shareUrl}" rel="noopener" target="_blank" aria-label="WhatsApp">WhatsApp</a>
  <button type="button" class="copy-link" data-url="${esc(abs(url))}" data-done="${s.copied}">${s.copy}</button>
</div></div>`;

    const main = `
<div class="doc-hero sand post-hero" id="top">
  <div class="wrap">
    <div class="box">
      <nav class="crumbs" aria-label="${s.crumbs}"><a href="${s.home}">${s.site}</a><span aria-hidden="true">/</span><a href="${s.root}">${s.blog}</a></nav>
      <p class="kicker"><i></i>${esc(post.tags?.[0] || s.blog)}</p>
      <h1>${esc(post.title)}</h1>
      ${excerptOf(post) ? `<p class="lede">${esc(excerptOf(post, 240))}</p>` : ''}
      <div class="meta">
        <span class="chip"><span class="dot y"></span><time datetime="${iso(published)}">${fmtDate(published, lang)}</time></span>
        <span class="chip">${s.minutes(post.readingMinutes || 1)}</span>
        <span class="chip">${esc(author)}</span>
        ${changedLater ? `<span class="chip">${s.updated}: <time datetime="${iso(modified)}">${fmtDate(modified, lang)}</time></span>` : ''}
      </div>
    </div>
  </div>
</div>
${post.cover?.url ? `<div class="wrap post-cover"><figure>${img(post.cover, { eager: true, sizes: '(max-width: 1280px) 100vw, 1280px' })}</figure></div>` : ''}
<div class="wrap doc post-doc">
  <aside class="post-side">${tocHtml}${share}</aside>
  <article class="prose post-body">
${html}
    ${(post.tags || []).length ? `<footer class="post-tags"><b>${s.tags}</b>${post.tags.map((t) => `<a href="${tagPath(lang, t)}" rel="tag">#${esc(t)}</a>`).join('')}</footer>` : ''}
  </article>
</div>
${related.length ? `<section class="related" aria-labelledby="related-h">
  <div class="wrap">
    <div class="related-head"><h2 id="related-h">${s.related}</h2><a href="${s.root}">${s.allPosts}</a></div>
    <div class="bgrid">${related.map((p) => card(p)).join('')}</div>
  </div>
</section>` : ''}
${cta(lang)}`;

    return page({
        lang, title, description, canonical, alternates,
        robots: post.seo?.noindex ? 'noindex, follow' : undefined,
        og: {
            type: 'article', title: post.seo?.title || post.title,
            image: post.cover?.url, imageWidth: post.cover?.width, imageHeight: post.cover?.height,
            imageAlt: post.cover?.alt, extra: ogExtra,
        },
        jsonLdList: ld, main, altHref, preview,
    });
}

function cta(lang) {
    const s = strings(lang);
    return `<div class="wrap"><div class="post-cta">
  <div><p class="kicker"><i></i>${s.ctaKicker}</p><h2>${s.ctaH2}</h2><p>${s.ctaP}</p></div>
  <div class="post-cta-btns">
    <a class="btn olive" href="${s.ctaHref || APP_STORE}"${/^https?:/.test(s.ctaHref || APP_STORE) ? ' rel="noopener"' : ''}><span class="beat" aria-hidden="true"></span>${s.ctaBtn}</a>
    ${s.ctaBtn2 ? `<a class="btn olive" href="${s.ctaHref2}" rel="noopener"><span class="beat" aria-hidden="true"></span>${s.ctaBtn2}</a>` : ''}
  </div>
</div></div>`;
}

export function renderList({ lang, posts, page: pageNo, pages, tag = null, tags = [], hasOther = true }) {
    const s = strings(lang);
    const url = listPath(lang, pageNo, tag);
    const otherLang = lang === 'fa' ? 'en' : 'fa';
    const title = tag
        ? `${s.tagTitle(tag)} | ${s.blogTitle}${pageNo > 1 ? ` — ${s.pageN(pageNo)}` : ''}`
        : `${s.listTitle}${pageNo > 1 ? ` — ${s.pageN(pageNo)}` : ''}`;
    const description = tag ? s.tagDesc(tag) : s.listDesc;
    const alternates = !tag && pageNo === 1 && hasOther
        ? { fa: strings('fa').root, en: strings('en').root, 'x-default': strings('fa').root }
        : {};
    const extraHead = [
        pageNo > 1 ? `<link rel="prev" href="${abs(listPath(lang, pageNo - 1, tag))}">` : '',
        pageNo < pages ? `<link rel="next" href="${abs(listPath(lang, pageNo + 1, tag))}">` : '',
    ].join('');

    const lead = pageNo === 1 && !tag && posts.length ? (posts.find((p) => p.featured) || posts[0]) : null;
    const rest = lead ? posts.filter((p) => p !== lead) : posts;

    const ld = [
        {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: s.blogTitle,
            description: s.listDesc,
            url: abs(s.root),
            inLanguage: s.inLanguage,
            publisher: publisherLd(lang),
            blogPost: posts.map((p) => ({
                '@type': 'BlogPosting',
                headline: p.title.slice(0, 110),
                url: abs(postPath(p)),
                datePublished: iso(p.publishedAt),
                image: p.cover?.url ? abs(p.cover.url) : undefined,
            })),
        },
        breadcrumbLd(tag ? [[s.site, s.home], [s.blog, s.root], [tag, tagPath(lang, tag)]] : [[s.site, s.home], [s.blog, s.root]]),
    ];

    const tagBar = tags.length
        ? `<nav class="tagbar" aria-label="${s.tags}"><a href="${s.root}"${!tag ? ' aria-current="page"' : ''}>${s.all}</a>${tags.map((t) =>
            `<a href="${tagPath(lang, t.tag)}"${t.tag === tag ? ' aria-current="page"' : ''}>${esc(t.tag)}</a>`).join('')}</nav>`
        : '';

    const main = `
<div class="doc-hero blog-hero" id="top">
  <div class="wrap">
    <div class="box">
      ${shell(lang).mark}
      <p class="kicker"><i></i>${tag ? s.tags : s.blog}</p>
      <h1>${tag ? `${esc(s.tagTitle(tag))}` : s.heroH1}</h1>
      <p class="lede">${tag ? esc(s.tagDesc(tag)) : s.heroLede}</p>
    </div>
  </div>
</div>
<div class="wrap blog-wrap">
  ${tagBar}
  ${posts.length ? '' : `<p class="bempty">${s.empty}</p>`}
  ${lead ? `<div class="blead">${card(lead, { lead: true, headingTag: 'h2' })}</div>` : ''}
  ${rest.length ? `<div class="bgrid">${rest.map((p) => card(p, { headingTag: lead ? 'h3' : 'h2' })).join('')}</div>` : ''}
  ${pager(lang, pageNo, pages, tag)}
</div>
${cta(lang)}`;

    const altHref = alternates[otherLang] || strings(otherLang).root;
    return page({ lang, title, description, canonical: url, alternates, extraHead, jsonLdList: ld, main, altHref });
}

/** The "latest posts" section for the home page. Empty when there are none. */
export function renderHomeSection(lang, posts) {
    if (!posts.length) return '';
    const s = strings(lang);
    return `<section id="blog" class="home-blog">
  <div class="wrap">
    <div class="head">
      <div><p class="kicker"><i></i>${s.latestKicker}</p><h2>${s.latestH2}</h2></div>
      <div class="side"><p class="lede">${s.latestLede}</p><a class="btn" href="${s.root}">${s.allPosts}</a></div>
    </div>
    <div class="bgrid">${posts.map((p) => card(p)).join('')}</div>
  </div>
</section>`;
}

export function renderRss(lang, posts) {
    const s = strings(lang);
    const items = posts.map((p) => `<item>
<title>${esc(p.title)}</title>
<link>${abs(postPath(p))}</link>
<guid isPermaLink="true">${abs(postPath(p))}</guid>
<pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
${(p.tags || []).map((t) => `<category>${esc(t)}</category>`).join('')}
<description>${esc(excerptOf(p, 300))}</description>
${p.cover?.url ? `<enclosure url="${esc(abs(p.cover.url))}" type="image/webp" length="0"/>` : ''}
</item>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(s.blogTitle)}</title>
<link>${abs(s.root)}</link>
<atom:link href="${abs(s.root + 'feed.xml')}" rel="self" type="application/rss+xml"/>
<description>${esc(s.listDesc)}</description>
<language>${s.inLanguage}</language>
${posts[0] ? `<lastBuildDate>${new Date(posts[0].updatedAt || posts[0].publishedAt).toUTCString()}</lastBuildDate>` : ''}
${items}
</channel>
</rss>`;
}

/** Blog URLs for sitemap.xml, with alternates and cover images. */
export function sitemapEntries(posts, translations) {
    const byId = new Map(translations.map((t) => [String(t._id), t]));
    const lastFor = (lang) => posts.filter((p) => p.lang === lang)[0];
    const entries = [];
    for (const lang of ['fa', 'en']) {
        const last = lastFor(lang);
        if (!last) continue;
        entries.push(`<url><loc>${abs(strings(lang).root)}</loc><lastmod>${iso(last.updatedAt || last.publishedAt)}</lastmod></url>`);
    }
    for (const p of posts) {
        if (p.seo?.noindex || p.seo?.canonical) continue;
        const t = p.translation && byId.get(String(p.translation));
        const alts = t ? `<xhtml:link rel="alternate" hreflang="${p.lang}" href="${abs(postPath(p))}"/><xhtml:link rel="alternate" hreflang="${t.lang}" href="${abs(postPath(t))}"/>` : '';
        const image = p.cover?.url ? `<image:image><image:loc>${esc(abs(p.cover.url))}</image:loc></image:image>` : '';
        entries.push(`<url><loc>${abs(postPath(p))}</loc><lastmod>${iso(p.updatedAt || p.publishedAt)}</lastmod>${alts}${image}</url>`);
    }
    return entries.join('');
}
