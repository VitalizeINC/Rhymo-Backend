import { PostHog } from 'posthog-node';

/**
 * Server-side PostHog.
 *
 * The app only reports what its installed build knows how to report, and only
 * once people update. The server sees every request from every version, so
 * the core actions (rhyme search, word lookup, word save, word bank) and every
 * failure are sent from here, starting the moment this is deployed.
 *
 * distinct_id is the user id, the same id the app passes to identify(), so
 * server and app events land on one person. A request with no signed-in user
 * is sent without creating a person profile.
 *
 * Off when POSTHOG_KEY is unset, so local runs stay quiet.
 */
const KEY = process.env.POSTHOG_KEY;
const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

export const posthog = KEY ? new PostHog(KEY, { host: HOST, flushAt: 20, flushInterval: 10000 }) : null;

export function capture(userId, event, properties = {}) {
    if (!posthog) return;
    try {
        const props = { ...properties, source: 'server' };
        if (userId) {
            posthog.capture({ distinctId: String(userId), event, properties: props });
        } else {
            posthog.capture({
                distinctId: `anon-${properties.request_id || 'unknown'}`,
                event,
                properties: { ...props, $process_person_profile: false },
            });
        }
    } catch { /* analytics must never break a request */ }
}

export function captureException(error, userId, properties = {}) {
    if (!posthog) return;
    try {
        posthog.captureException(error, userId ? String(userId) : undefined, { ...properties, source: 'server' });
    } catch { /* ignore */ }
}

// Send what is queued before the process exits (pm2 restart sends SIGINT).
let stopping = false;
async function flushAndExit(code) {
    if (stopping) return;
    stopping = true;
    try {
        if (posthog) await (posthog.shutdown ? posthog.shutdown(3000) : posthog._shutdown(3000));
    } catch { /* ignore */ }
    process.exit(code);
}
if (posthog) {
    process.once('SIGINT', () => flushAndExit(0));
    process.once('SIGTERM', () => flushAndExit(0));
}
