const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dein-geheimes-passwort';

function createJWT(user) {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    SECRET,
    { expiresIn: '7d' }
  );
}

function verifyJWT(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { createJWT, verifyJWT }; 