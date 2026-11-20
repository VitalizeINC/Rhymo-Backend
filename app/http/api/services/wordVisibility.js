/**
 * Who is allowed to see a word.
 *
 * The dictionary is shared by everyone, so a word one person adds would
 * otherwise turn up in everybody's search the moment it is saved. The rule:
 *
 *   - a word is public once an admin approves it
 *   - before that, only the person who added it can see it, and anyone
 *     else who added the same word (requestedBy): the word is stored once
 *
 * A word with no owner stays hidden until it is approved. That covers the
 * words from admin batch uploads, which are waiting for review, and the words
 * added before saveWords started recording who added them.
 *
 * This applies to what a person is SHOWN: searches, suggestions, rhyme
 * results. It must NOT be applied to the "is this word already in the table?"
 * check that runs before an insert — fullWord is unique, so a check that
 * cannot see a hidden word would try to insert a duplicate and fail.
 *
 * Admin routes are unfiltered on purpose: reviewing pending words is the job.
 *
 * Levels: an admin can limit a person to some word levels (1–10). They then
 * see approved words of those levels only; their own words always. Set by the
 * sign-in middleware as req.user.levels (null = all levels).
 */

/**
 * The visibility clause on its own.
 */
export function visibleWordClause(req) {
    const userId = req && req.user ? req.user.id : null;
    const levels = req && req.user && Array.isArray(req.user.levels) ? req.user.levels : null;
    const approved = levels ? { approved: true, level: { $in: levels } } : { approved: true };
    if (!userId) return approved;
    return { $or: [approved, { user: userId }, { requestedBy: userId }] };
}

/**
 * A query with the visibility clause added.
 *
 * Joined with $and rather than merged, because several of these queries
 * already use $or of their own and a plain merge would silently drop it.
 */
export function visibleWords(req, query = {}) {
    const parts = [];

    // Keep an $and the caller already built, so nothing is lost.
    if (Array.isArray(query.$and)) parts.push(...query.$and);

    const rest = { ...query };
    delete rest.$and;
    if (Object.keys(rest).length > 0) parts.push(rest);

    parts.push(visibleWordClause(req));

    return parts.length === 1 ? parts[0] : { $and: parts };
}

export default { visibleWordClause, visibleWords };
