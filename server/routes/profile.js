const bcrypt = require('bcrypt');
const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const { handleValidation, strongPassword } = require('../middleware/validate');

const router = express.Router();

function publicUser(user) {
  const { two_factor_secret, two_factor_temp_secret, reset_token, reset_token_expires, password_hash, ...safe } = user;
  return safe;
}

router.get('/', requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

router.put(
  '/',
  requireAuth,
  [
    body('full_name').optional().trim().isLength({ min: 2, max: 100 }),
    body('username').optional().trim().isLength({ min: 3, max: 50 }).matches(/^[A-Za-z0-9_]+$/),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const fields = {};
      if (req.body.full_name) fields.full_name = req.body.full_name.trim();
      if (req.body.username && req.body.username !== req.user.username) {
        const existing = await User.findByUsername(req.body.username);
        if (existing) return res.status(409).json({ success: false, message: 'Username is already taken' });
        fields.username = req.body.username.trim();
      }
      await User.update(req.user.id, fields);
      await auditLog({ userId: req.user.id, action: 'profile_updated', details: Object.keys(fields).join(', '), req });
      res.json({ success: true, message: 'Profile updated', user: publicUser(await User.findById(req.user.id)) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/change-password',
  requireAuth,
  [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password').custom(strongPassword).withMessage('New password does not meet requirements'),
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const user = await User.findByEmail(req.user.email);
      const ok = await bcrypt.compare(req.body.current_password, user.password_hash);
      if (!ok) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      await User.updatePassword(user.id, await bcrypt.hash(req.body.new_password, 12));
      await auditLog({ userId: user.id, action: 'password_changed', details: 'Password changed from profile', req });
      res.json({ success: true, message: 'Password changed' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
