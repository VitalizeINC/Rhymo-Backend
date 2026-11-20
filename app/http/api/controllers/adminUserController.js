import mongoose from 'mongoose';
import controller from './controller.js';
import User from '../../../models/user.js';
import Word from '../../../models/word.js';
import Note from '../../../models/note.js';
import WordBank from '../../../models/wordBank.js';
import { ALL_LEVELS, cleanLevels, forgetLevels } from '../services/userLevels.js';

/**
 * Users for the admin panel: who they are, how they sign in, which word
 * levels they may see, and the words they added.
 *
 * Never sends passwords, reset codes or sign-in tokens.
 */

// How the person signs in, read from what sign-in leaves on the account.
function signInMethod(u) {
    const tokens = u.tokens || [];
    if (tokens.some(t => String(t).startsWith('google:'))) return 'google';
    if (tokens.some(t => String(t).startsWith('apple:')) || /privaterelay\.appleid\.com$/i.test(u.email || '')) return 'apple';
    return 'email';
}

function publicUser(u, counts = {}) {
    const levels = Array.isArray(u.levels) && u.levels.length && u.levels.length < 10 ? u.levels : ALL_LEVELS;
    return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        admin: !!u.admin,
        signIn: signInMethod(u),
        levels,
        allLevels: levels.length === 10,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        words: counts.words || { total: 0, approved: 0, waiting: 0 },
        alsoAdded: counts.alsoAdded || 0,
        notes: counts.notes || 0,
        bank: counts.bank || 0,
    };
}

async function countsFor(ids) {
    const oids = ids.map(id => new mongoose.Types.ObjectId(id));
    const [own, also, notes, bank] = await Promise.all([
        Word.aggregate([
            { $match: { user: { $in: oids } } },
            { $group: { _id: { u: '$user', a: '$approved' }, n: { $sum: 1 } } },
        ]),
        Word.aggregate([
            { $match: { requestedBy: { $in: oids } } },
            { $unwind: '$requestedBy' },
            { $match: { requestedBy: { $in: oids } } },
            { $group: { _id: '$requestedBy', n: { $sum: 1 } } },
        ]),
        Note.aggregate([{ $match: { user: { $in: oids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
        WordBank.aggregate([{ $match: { user: { $in: oids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    ]);
    const out = {};
    const get = (id) => (out[String(id)] ||= { words: { total: 0, approved: 0, waiting: 0 }, alsoAdded: 0, notes: 0, bank: 0 });
    for (const r of own) {
        const c = get(r._id.u);
        c.words.total += r.n;
        if (r._id.a) c.words.approved += r.n; else c.words.waiting += r.n;
    }
    for (const r of also) get(r._id).alsoAdded = r.n;
    for (const r of notes) get(r._id).notes = r.n;
    for (const r of bank) get(r._id).bank = r.n;
    return out;
}

class AdminUserController extends controller {
    /** GET /admin/users?page&limit&q&role=admin|user&levels=limited */
    async list(req, res) {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
        const query = {};
        const q = String(req.query.q || '').trim();
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [{ name: rx }, { email: rx }];
        }
        if (req.query.role === 'admin') query.admin = true;
        if (req.query.role === 'user') query.admin = { $ne: true };
        if (req.query.levels === 'limited') query['levels.0'] = { $exists: true };

        const result = await User.paginate(query, {
            page, limit, sort: { createdAt: -1 },
            select: 'name email admin levels tokens createdAt updatedAt',
            lean: true,
        });
        const counts = await countsFor(result.docs.map(u => String(u._id)));
        const [total, admins, limited] = await Promise.all([
            User.countDocuments({}),
            User.countDocuments({ admin: true }),
            User.countDocuments({ 'levels.0': { $exists: true } }),
        ]);
        res.json({
            users: result.docs.map(u => publicUser(u, counts[String(u._id)])),
            page: result.page, pages: result.totalPages, total: result.totalDocs,
            summary: { total, admins, limited },
        });
    }

    /** GET /admin/users/:id */
    async show(req, res) {
        const u = await User.findById(req.params.id).select('name email admin levels tokens createdAt updatedAt').lean();
        if (!u) return res.status(404).json('کاربر پیدا نشد');
        const counts = await countsFor([String(u._id)]);
        res.json({ user: publicUser(u, counts[String(u._id)]) });
    }

    /** GET /admin/users/:id/words?page&limit&state=all|approved|waiting — words they added */
    async words(req, res) {
        const id = new mongoose.Types.ObjectId(req.params.id);
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
        const query = { $or: [{ user: id }, { requestedBy: id }] };
        if (req.query.state === 'approved') query.approved = true;
        if (req.query.state === 'waiting') query.approved = false;
        const result = await Word.paginate(query, {
            page, limit, sort: { createdAt: -1 },
            select: 'fullWord fullWordWithNimFaseleh heja ava approved level createdAt user requestedBy dataset',
            lean: true,
        });
        res.json({
            words: result.docs.map(w => ({
                ...w,
                // added it first, or added the same word after someone else
                addedFirst: String(w.user) === String(id),
                user: undefined, requestedBy: undefined,
            })),
            page: result.page, pages: result.totalPages, total: result.totalDocs,
        });
    }

    /** PUT /admin/users/:id  { admin?: boolean, levels?: number[] } */
    async update(req, res) {
        const set = {}, unset = {};
        if (req.body.admin !== undefined) set.admin = !!req.body.admin;
        if (req.body.levels !== undefined) {
            const levels = cleanLevels(req.body.levels);
            if (!levels || !levels.length) return res.status(400).json('دست‌کم یک سطح باید انتخاب شده باشد.');
            if (levels.length === 10) unset.levels = 1; else set.levels = levels;
        }
        if (!Object.keys(set).length && !Object.keys(unset).length) return res.status(400).json('چیزی برای تغییر نیست.');
        const update = {};
        if (Object.keys(set).length) update.$set = set;
        if (Object.keys(unset).length) update.$unset = unset;
        // updateOne, not findOneAndUpdate: the user model re-hashes passwords on that hook.
        const r = await User.updateOne({ _id: req.params.id }, update);
        if (!r.matchedCount) return res.status(404).json('کاربر پیدا نشد');
        forgetLevels(req.params.id);
        return this.show(req, res);
    }
}

export default new AdminUserController();
