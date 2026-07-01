const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'change_this_to_a_long_random_secret_at_least_64_chars';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { signToken, verifyToken };
