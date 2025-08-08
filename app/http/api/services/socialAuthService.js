import crypto from 'crypto';
import User from '../../../models/user.js';

export async function findOrCreateUser({ provider, providerUserId, email, name }) {
  const providerPhoneNumber = `${provider}:${providerUserId}`;

  // 1) Find by provider-specific phoneNumber surrogate
  let user = await User.findOne({ phoneNumber: providerPhoneNumber }).exec();
  if (user) return user;

  // 2) Fallback: find by email if provided
  if (email) {
    user = await User.findOne({ email }).exec();
    if (user) return user;
  }

  // 3) Create new user with safe defaults
  const displayName = name || (email ? email.split('@')[0] : `${provider}_user`);
  const randomPassword = crypto.randomBytes(24).toString('hex');

  const newUser = await User.create({
    name: displayName,
    phoneNumber: providerPhoneNumber,
    email: email || undefined,
    password: randomPassword,
  });

  return newUser;
}


