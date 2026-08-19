const { validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Please check the highlighted fields',
      errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
    });
  }
  next();
}

function strongPassword(value) {
  if (!value || value.length < 8) throw new Error('Password must be at least 8 characters');
  if (!/[A-Z]/.test(value)) throw new Error('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(value)) throw new Error('Password must contain at least one lowercase letter');
  if (!/\d/.test(value)) throw new Error('Password must contain at least one number');
  if (!/[^A-Za-z\d]/.test(value)) throw new Error('Password must contain at least one special character (e.g. !@#$%)');
  return true;
}

module.exports = { handleValidation, strongPassword };
