import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Structured log files: one JSON object per line, one file per kind per day.
 *
 *   logs/app-2026-11-17.log    every API request
 *   logs/error-2026-11-17.log  every API request that failed, with context
 *
 * Files older than KEEP_DAYS are removed when a new day's file opens.
 * Writing never throws: a full disk must not take the API down.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const LOG_DIR = process.env.LOG_DIR || path.resolve(here, '../../logs');
const KEEP_DAYS = parseInt(process.env.LOG_KEEP_DAYS || '14', 10);

try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* reported on first write */ }

const open = new Map();

function prune() {
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    try {
        for (const f of fs.readdirSync(LOG_DIR)) {
            const m = f.match(/-(\d{4}-\d{2}-\d{2})\.log$/);
            if (m && Date.parse(m[1]) < cutoff) fs.rmSync(path.join(LOG_DIR, f), { force: true });
        }
    } catch { /* ignore */ }
}

function streamFor(kind) {
    const day = new Date().toISOString().slice(0, 10);
    let s = open.get(kind);
    if (!s || s.day !== day) {
        if (s) s.stream.end();
        s = { day, stream: fs.createWriteStream(path.join(LOG_DIR, `${kind}-${day}.log`), { flags: 'a' }) };
        s.stream.on('error', () => {});
        open.set(kind, s);
        prune();
    }
    return s.stream;
}

export function writeLog(kind, entry) {
    try {
        streamFor(kind).write(JSON.stringify(entry) + '\n');
    } catch { /* never let logging break a request */ }
}

/** Last `limit` entries of a kind, newest first, reading today then yesterday. */
export function readRecent(kind, limit = 50) {
    const out = [];
    for (let back = 0; back < 2 && out.length < limit; back++) {
        const day = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
        const file = path.join(LOG_DIR, `${kind}-${day}.log`);
        if (!fs.existsSync(file)) continue;
        const lines = fs.readFileSync(file, 'utf8').trim().split('\n').reverse();
        for (const l of lines) {
            if (out.length >= limit) break;
            try { out.push(JSON.parse(l)); } catch { /* skip a torn line */ }
        }
    }
    return out;
}
