const express = require('express');
const User = require('../models/User');
const { getAuditLogs } = require('../utils/audit');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json({
    success: true,
    session: {
      authenticated: true,
      user_id: req.user.id,
      csrf_ready: Boolean(req.session.csrfToken),
      issued_at: req.session.cookie?._expires || null,
    },
  });
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    res.json({ success: true, history: await User.getLoginHistory(req.user.id, 20) });
  } catch (err) {
    next(err);
  }
});

router.get('/audit', requireAuth, async (req, res, next) => {
  try {
    res.json({ success: true, logs: await getAuditLogs(req.user.id, 30) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
