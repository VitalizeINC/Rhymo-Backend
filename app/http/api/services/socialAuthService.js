import crypto from 'crypto';
import User from '../../../models/user.js';

/**
 * Is this stored name a stand-in we invented, rather than something the person
 * gave us? A placeholder is the email prefix or `<provider>_user` — see the
 * displayName fallback below. Used to decide whether a real name that arrives
 * later is allowed to replace it.
 */
function isPlaceholderName(storedName, email, provider) {
  if (!storedName) return true;
  if (storedName === `${provider}_user`) return true;
  if (email && storedName === email.split('@')[0]) return true;
  return false;
}

export async function findOrCreateUser({ provider, providerUserId, email, name }) {
  const providerToken = `${provider}:${providerUserId}`;
  const realName = (name || '').trim() || null;

  /**
   * Fill in a name we did not have before.
   *
   * Apple hands over the person's name only on their FIRST authorization, so a
   * single miss used to lose it for good. If a real name turns up later — the
   * person re-authorized, or signed in with another provider — take it, but
   * only over a placeholder. A name the person set themselves is never
   * overwritten.
   */
  const backfillName = async (existing) => {
    if (!realName) return existing;
    if (!isPlaceholderName(existing.name, existing.email, provider)) return existing;
    await User.findByIdAndUpdate(existing._id, { name: realName }).exec();
    existing.name = realName;
    return existing;
  };

  // 1) Find by provider token in `tokens`
  let user = await User.findOne({ tokens: providerToken }).exec();
  if (user) return backfillName(user);

  // 2) Fallback: find by email if provided; attach provider token if found
  if (email) {
    user = await User.findOne({ email }).exec();
    if (user) {
      await User.findByIdAndUpdate(user._id, { $addToSet: { tokens: providerToken } }).exec();
      return backfillName(user);
    }
  }

  // 3) Create new user with safe defaults and store provider token
  const displayName = realName || (email ? email.split('@')[0] : `${provider}_user`);
  const randomPassword = crypto.randomBytes(24).toString('hex');

  const newUser = await User.create({
    name: displayName,
    email: email || undefined,
    password: randomPassword,
    tokens: [providerToken],
  });

  return newUser;
}


