const User = require('../models/User');

async function auditLog({ userId = null, action, details = '', req }) {
  try {
    await User.addAuditLog({ userId, action, details, ipAddress: req?.ip || null });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

async function getAuditLogs(userId, limit = 25) {
  return User.getAuditLogs(userId, limit);
}

module.exports = { auditLog, getAuditLogs };
