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
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(value);
}

module.exports = { handleValidation, strongPassword };
