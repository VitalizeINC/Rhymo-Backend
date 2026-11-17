import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

/**
 * Per-request context.
 *
 * Every request gets an id. It is sent back in the `x-request-id` header and
 * written on every log line, so one failure can be followed from the app to
 * the exact line in the log.
 *
 * The context also collects any Error a controller logs with console.error
 * while handling the request. 35 controller catch blocks log the error and
 * answer 500 themselves, so the central error handler never sees them; this
 * is how their stack still reaches the request log without rewriting them.
 */
export const als = new AsyncLocalStorage();

export function currentContext() {
    return als.getStore();
}

export function requestContext(req, res, next) {
    const incoming = req.get('x-request-id');
    const id = incoming && /^[\w-]{6,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    als.run({ id, errors: [] }, () => next());
}

// Tag console.error output with the request id and keep the Error itself.
const originalError = console.error.bind(console);
console.error = (...args) => {
    const ctx = als.getStore();
    if (!ctx) return originalError(...args);
    const err = args.find((a) => a instanceof Error);
    if (err && ctx.errors.length < 5) ctx.errors.push(err);
    return originalError(`[${ctx.id.slice(0, 8)}]`, ...args);
};
