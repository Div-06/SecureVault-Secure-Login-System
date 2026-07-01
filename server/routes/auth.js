const crypto = require('crypto');
const bcrypt = require('bcrypt');
const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { signToken } = require('../utils/tokens');
const { auditLog } = require('../utils/audit');
const { sendResetEmail, hasSmtpConfig } = require('../utils/email');
const { handleValidation, strongPassword } = require('../middleware/validate');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordRules = body('password')
  .custom(strongPassword)
  .withMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');

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

function deviceType(userAgent = '') {
  return /mobile|android|iphone|ipad/i.test(userAgent) ? 'mobile' : 'desktop';
}

router.post(
  '/register',
  [
    body('full_name').trim().isLength({ min: 2, max: 100 }).withMessage('Full name is required'),
    body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[A-Za-z0-9_]+$/).withMessage('Use 3-50 letters, numbers, or underscores'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    passwordRules,
    body('confirm_password').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const { full_name, username, email, password } = req.body;
      if (await User.findByEmail(email)) {
        return res.status(409).json({ success: false, message: 'Email is already registered' });
      }
      if (await User.findByUsername(username)) {
        return res.status(409).json({ success: false, message: 'Username is already taken' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const id = await User.create({ full_name: full_name.trim(), username: username.trim(), email, password_hash });
      const user = await User.findById(id);
      await auditLog({ userId: id, action: 'register', details: 'Account created', req });

      res.status(201).json({ success: true, message: 'Account created', user: publicUser(user), token: signToken(user) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  handleValidation,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (user.is_locked && user.locked_until && new Date(user.locked_until) > new Date()) {
        await User.addLoginHistory({ user_id: user.id, ip_address: req.ip, user_agent: req.headers['user-agent'], status: 'locked', device_type: deviceType(req.headers['user-agent']) });
        return res.status(423).json({ success: false, message: 'Account is temporarily locked' });
      }
      if (user.is_locked) await User.unlockAccount(user.id);

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        await User.incrementFailedAttempts(user.id);
        if ((user.failed_attempts || 0) + 1 >= 5) {
          await User.lockAccount(user.id, new Date(Date.now() + 15 * 60 * 1000));
        }
        await User.addLoginHistory({ user_id: user.id, ip_address: req.ip, user_agent: req.headers['user-agent'], status: 'failed', device_type: deviceType(req.headers['user-agent']) });
        await auditLog({ userId: user.id, action: 'login_failed', details: 'Invalid password', req });
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (user.two_factor_enabled) {
        req.session.pending2faUserId = user.id;
        return res.json({ success: true, requires2fa: true, message: 'Two-factor code required' });
      }

      await User.resetFailedAttempts(user.id);
      await User.updateLastLogin(user.id);
      await User.addLoginHistory({ user_id: user.id, ip_address: req.ip, user_agent: req.headers['user-agent'], status: 'success', device_type: deviceType(req.headers['user-agent']) });
      await auditLog({ userId: user.id, action: 'login_success', details: 'Password login', req });
      const fresh = await User.findById(user.id);
      res.json({ success: true, message: 'Logged in', user: publicUser(fresh), token: signToken(fresh) });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/logout', async (req, res) => {
  req.session.destroy(() => res.json({ success: true, message: 'Logged out' }));
});

router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], handleValidation, async (req, res, next) => {
  try {
    const user = await User.findByEmail(req.body.email);
    if (!user) {
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await User.setResetToken(user.id, token, new Date(Date.now() + 60 * 60 * 1000));
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await sendResetEmail(user.email, resetUrl);
    await auditLog({ userId: user.id, action: 'password_reset_requested', details: 'Reset token issued', req });

    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent',
      devToken: hasSmtpConfig() ? undefined : token,
      devResetUrl: hasSmtpConfig() ? undefined : resetUrl,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', [body('token').notEmpty(), passwordRules], handleValidation, async (req, res, next) => {
  try {
    const user = await User.findByResetToken(req.body.token);
    if (!user) return res.status(400).json({ success: false, message: 'Reset token is invalid or expired' });
    await User.updatePassword(user.id, await bcrypt.hash(req.body.password, 12));
    await User.clearResetToken(user.id);
    await auditLog({ userId: user.id, action: 'password_reset_completed', details: 'Password changed via reset token', req });
    res.json({ success: true, message: 'Password reset complete' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
