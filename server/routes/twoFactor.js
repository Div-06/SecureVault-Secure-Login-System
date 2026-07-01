const express = require('express');
const qrcode = require('qrcode');
const speakeasy = require('speakeasy');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { signToken } = require('../utils/tokens');
const { auditLog } = require('../utils/audit');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    username: user.username,
    email: user.email,
    two_factor_enabled: Boolean(user.two_factor_enabled),
    last_login: user.last_login,
    created_at: user.created_at,
  };
}

router.post('/enable', requireAuth, async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `SecureVault (${req.user.email})`,
      issuer: 'SecureVault',
      length: 20,
    });
    await User.setTwoFactorTempSecret(req.user.id, secret.base32);
    res.json({ success: true, secret: secret.base32, qrCode: await qrcode.toDataURL(secret.otpauth_url) });
  } catch (err) {
    next(err);
  }
});

router.post('/verify', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findByEmail(req.user.email);
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_temp_secret,
      encoding: 'base32',
      token: req.body.token,
      window: 1,
    });
    if (!verified) return res.status(400).json({ success: false, message: 'Invalid verification code' });
    await User.enableTwoFactor(req.user.id);
    await auditLog({ userId: req.user.id, action: '2fa_enabled', details: 'Authenticator app enabled', req });
    res.json({ success: true, message: 'Two-factor authentication enabled' });
  } catch (err) {
    next(err);
  }
});

router.post('/disable', requireAuth, async (req, res, next) => {
  try {
    await User.disableTwoFactor(req.user.id);
    await auditLog({ userId: req.user.id, action: '2fa_disabled', details: 'Authenticator app disabled', req });
    res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (err) {
    next(err);
  }
});

router.post('/login-verify', async (req, res, next) => {
  try {
    const userId = req.session.pending2faUserId;
    if (!userId) return res.status(400).json({ success: false, message: 'No pending 2FA login' });
    const user = await User.findById(userId);
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: req.body.token,
      window: 1,
    });
    if (!verified) return res.status(400).json({ success: false, message: 'Invalid verification code' });
    delete req.session.pending2faUserId;
    await User.resetFailedAttempts(user.id);
    await User.updateLastLogin(user.id);
    await User.addLoginHistory({ user_id: user.id, ip_address: req.ip, user_agent: req.headers['user-agent'], status: 'success', device_type: '2fa' });
    await auditLog({ userId: user.id, action: 'login_success', details: 'Two-factor login', req });
    const fresh = await User.findById(user.id);
    res.json({ success: true, message: 'Logged in', user: publicUser(fresh), token: signToken(fresh) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
