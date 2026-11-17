import { currentContext } from './context.js';
import { writeLog } from './logger.js';
import { capture, captureException } from './analytics.js';

/**
 * One place that sees every API response, whoever sent it.
 *
 * For each request under /api it:
 *   - writes one line to logs/app-<day>.log (route, user, status, time)
 *   - on failure, writes the full story to logs/error-<day>.log: the input
 *     that caused it (scrubbed of passwords and tokens), the error message the
 *     client got, and the stack of any Error logged while handling it
 *   - sends the core product actions and every failure to PostHog
 *   - on a 5xx, removes internal details from the body and adds the request id
 *
 * Nothing here can fail a request: every step is guarded.
 */

const SENSITIVE = /pass|token|secret|authorization|credential|cookie|code$/i;

function scrub(value, depth = 0) {
    if (value == null) return value;
    if (depth > 4) return '[…]';
    if (typeof value === 'string') return value.length > 200 ? value.slice(0, 200) + '…' : value;
    if (Array.isArray(value)) {
        const out = value.slice(0, 20).map((v) => scrub(v, depth + 1));
        if (value.length > 20) out.push(`[+${value.length - 20} more]`);
        return out;
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[hidden]' : scrub(v, depth + 1);
        return out;
    }
    return value;
}

// How many results a response carried, for the common shapes this API returns.
function resultCount(body) {
    if (Array.isArray(body)) return body.length;
    if (!body || typeof body !== 'object') return undefined;
    for (const k of ['rhymes', 'docs', 'matches', 'words', 'notes', 'entries', 'data']) {
        if (Array.isArray(body[k])) return body[k].length;
    }
    return undefined;
}

const num = (v) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

/**
 * The core actions sent to PostHog. Matched on the route path. The app's own
 * events use other names; these all start with api_ so the two never mix.
 * suggestWord is left out on purpose: it fires on every keystroke.
 */
const EVENTS = [
    ['GET',  '/api/v1/getRhymes',            'api_rhyme_search',  (q) => ({ mode: 'phonetic', word_id: q.id, page: num(q.page), parts: num(q.partsNumber), professional: q.professional !== 'false' })],
    ['GET',  '/api/v1/getTraditionalRhymes', 'api_rhyme_search',  (q) => ({ mode: 'traditional', word_id: q.id, page: num(q.page), parts: num(q.partsNumber) })],
    ['GET',  '/api/v1/compoundRhymes',       'api_rhyme_search',  (q) => ({ mode: 'compound', page: num(q.page) })],
    ['GET',  '/api/v1/bankRhymes',           'api_rhyme_search',  (q) => ({ mode: 'bank', word_id: q.id, parts: num(q.partsNumber) })],
    ['GET',  '/api/v1/soundSearch',          'api_sound_search',  (q) => ({ pattern: q.pattern, match: q.match, page: num(q.page) })],
    ['GET',  '/api/v1/resolveWord',          'api_word_lookup',   (q) => ({ word: q.string })],
    ['GET',  '/api/v1/wordAnalysis',         'api_word_analysis', (q) => ({ word_id: q.id })],
    ['POST', '/api/v1/getWordDetails',       'api_word_analysed', (q, b) => ({ word: b.string })],
    ['POST', '/api/v1/saveWords',            'api_word_saved',    (q, b) => ({ word: b.s, parts: Array.isArray(b.data) ? b.data.length : undefined })],
    ['POST', '/api/v1/wordBank',             'api_wordbank_add',  (q, b) => ({ source: b.source })],
    ['POST', '/api/v1/note',                 'api_note_saved',    (q, b) => ({ is_new: !b.id })],
];

export function requestLog(req, res, next) {
    const path = req.originalUrl.split('?')[0];
    if (!path.startsWith('/api/')) return next();

    // Taken now, while still inside the request's context: the 'finish'
    // callback below can run outside it. The errors array is shared, so
    // anything logged later in the request still shows up here.
    const ctx = currentContext() || { errors: [] };
    const started = process.hrtime.bigint();
    let errorMessage;
    let results;

    // Look at what is sent back, without changing successful answers.
    const json = res.json.bind(res);
    res.json = (body) => {
        try {
            results = resultCount(body);
            if (res.statusCode >= 400 && body && typeof body === 'object') {
                errorMessage = body.error || body.message;
            } else if (res.statusCode >= 400 && typeof body === 'string') {
                errorMessage = body;
            }
            // A 5xx must not carry internals (Mongo messages, stack text) to the
            // client. Keep the short `error`, drop `details`, add the request id.
            if (res.statusCode >= 500 && body && typeof body === 'object' && !Array.isArray(body)) {
                const { details, error, stack, ...rest } = body;
                body = { ...rest, error: error || 'Something went wrong on our side', requestId: req.id };
            }
        } catch { /* fall through with the original body */ }
        return json(body);
    };

    res.on('finish', () => {
        try {
            const ms = Number(process.hrtime.bigint() - started) / 1e6;
            const status = res.statusCode;
            const user = req.user?.id || null;
            const base = {
                t: new Date().toISOString(),
                id: req.id,
                method: req.method,
                path,
                status,
                ms: Math.round(ms),
                user,
            };
            writeLog('app', results === undefined ? base : { ...base, results });

            // 401 is the normal answer to a signed-out call; logging every one
            // would bury the real failures.
            if (status >= 400 && status !== 401) {
                const err = (ctx.errors || [])[0];
                writeLog('error', {
                    ...base,
                    level: status >= 500 ? 'error' : 'warn',
                    message: errorMessage,
                    query: scrub(req.query),
                    body: scrub(req.body),
                    error: err ? { name: err.name, message: err.message, stack: String(err.stack || '').split('\n').slice(0, 8) } : undefined,
                });
            }

            const match = EVENTS.find(([m, p]) => m === req.method && p === path);
            const common = { request_id: req.id, status, ok: status < 400, ms: Math.round(ms) };
            if (match) {
                const [, , event, pick] = match;
                let extra = {};
                try { extra = pick(req.query || {}, req.body || {}); } catch { /* ignore */ }
                capture(user, event, { ...extra, ...common, results, error: status >= 400 ? errorMessage : undefined });
            }
            if (status >= 500) {
                capture(user, 'api_error', { ...common, path, method: req.method, error: errorMessage });
                const err = (ctx.errors || [])[0] || new Error(`${req.method} ${path} -> ${status}: ${errorMessage || 'server error'}`);
                captureException(err, user, { request_id: req.id, path, method: req.method, status });
            }
        } catch { /* logging must never break anything */ }
    });

    next();
}
