import sanitizeHtml from 'sanitize-html';

/**
 * Cleans post HTML from the admin editor before it is stored.
 *
 * Only the tags the editor can make are kept. Scripts, styles, event
 * attributes and unknown iframes are removed, so even a pasted page cannot
 * run code on rhymo.app. An <h1> becomes <h2>: the post title is the page's
 * only <h1>, which is what search engines expect.
 */
const VIDEO_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com', 'www.aparat.com', 'aparat.com'];

const options = {
    allowedTags: [
        'h2', 'h3', 'h4', 'p', 'br', 'hr',
        'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'code', 'sub', 'sup',
        'a', 'ul', 'ol', 'li', 'blockquote', 'pre',
        'figure', 'figcaption', 'img', 'iframe',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div',
    ],
    allowedAttributes: {
        a: ['href', 'title', 'rel', 'target'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        iframe: ['src', 'title', 'allowfullscreen', 'width', 'height'],
        th: ['colspan', 'rowspan'],
        td: ['colspan', 'rowspan'],
        p: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
        div: ['data-youtube-video', 'class'],
        '*': ['dir'],
    },
    allowedStyles: {
        '*': { 'text-align': [/^(left|right|center|justify|start|end)$/] },
    },
    allowedClasses: { div: ['video'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    allowedIframeHostnames: VIDEO_HOSTS,
    transformTags: {
        h1: 'h2',
        h5: 'h4',
        h6: 'h4',
        b: 'strong',
        i: 'em',
        a: (tagName, attribs) => {
            const href = attribs.href || '';
            const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?rhymo\.app(\/|$)/i.test(href);
            const out = { href };
            if (attribs.title) out.title = attribs.title;
            if (external) {
                out.rel = 'noopener';
                out.target = '_blank';
            }
            return { tagName: 'a', attribs: out };
        },
    },
    // Drop images with no source and empty paragraphs (blank lines in the editor).
    exclusiveFilter: (frame) =>
        (frame.tag === 'img' && !frame.attribs.src) ||
        (frame.tag === 'iframe' && !frame.attribs.src) ||
        (frame.tag === 'p' && !frame.text.trim() && !(frame.mediaChildren || []).length),
};

export function sanitizePostHtml(html = '') {
    return sanitizeHtml(String(html || ''), options).trim();
}

export function isAllowedVideoUrl(url = '') {
    try { return VIDEO_HOSTS.includes(new URL(url).hostname); } catch { return false; }
}
