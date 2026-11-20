import User from '../../../models/user.js'

/**
 * Which word levels (1–10) a person may see.
 *
 * Stored on the user as `levels`; no list means all ten, which is the
 * default. Asked on every signed-in request, so it is kept in memory for a
 * minute; the admin panel clears a person's entry when it changes them.
 */
export const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const TTL_MS = 60 * 1000
const cache = new Map()   // userId -> { levels, at }

export async function levelsFor(userId) {
    if (!userId) return null
    const hit = cache.get(String(userId))
    if (hit && Date.now() - hit.at < TTL_MS) return hit.levels
    let levels = null
    try {
        const u = await User.findById(userId).select('levels').lean()
        levels = u && Array.isArray(u.levels) && u.levels.length && u.levels.length < 10 ? u.levels : null
    } catch {
        levels = null   // an unknown or bad id sees everything, as before
    }
    cache.set(String(userId), { levels, at: Date.now() })
    return levels
}

export function forgetLevels(userId) {
    cache.delete(String(userId))
}

/** Clean list: whole numbers 1–10, no repeats, sorted. */
export function cleanLevels(input) {
    if (!Array.isArray(input)) return null
    const out = [...new Set(input.map(n => parseInt(n)).filter(n => n >= 1 && n <= 10))].sort((a, b) => a - b)
    return out
}
