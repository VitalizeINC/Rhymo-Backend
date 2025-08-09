import crypto from 'crypto';
import User from '../../../models/user.js';

export async function findOrCreateUser({ provider, providerUserId, email, name }) {
  const providerToken = `${provider}:${providerUserId}`;

  // 1) Find by provider token in `tokens`
  let user = await User.findOne({ tokens: providerToken }).exec();
  if (user) return user;

  // 2) Fallback: find by email if provided; attach provider token if found
  if (email) {
    user = await User.findOne({ email }).exec();
    if (user) {
      await User.findByIdAndUpdate(user._id, { $addToSet: { tokens: providerToken } }).exec();
      return user;
    }
  }

  // 3) Create new user with safe defaults and store provider token
  const displayName = name || (email ? email.split('@')[0] : `${provider}_user`);
  const randomPassword = crypto.randomBytes(24).toString('hex');

  const newUser = await User.create({
    name: displayName,
    email: email || undefined,
    password: randomPassword,
    tokens: [providerToken],
  });

  return newUser;
}


