const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { 
  registerValidation, 
  loginValidation, 
  passwordResetValidation, 
  newPasswordValidation 
} = require('../middleware/validators');
const { createJWT, verifyJWT } = require('../utils/jwt');
const { checkPassword } = require('../utils/password');

// Registrierung
router.post('/register', registerValidation, AuthController.register);

// Kontoaktivierung
router.get('/activate/:token', AuthController.activate);

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  // ... User-Validierung ...
  if (!user || !checkPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
  }
  const token = createJWT(user); // JWT mit Userdaten und Rolle

  // Setze Cookie auf .rechtly.de
  res.cookie('token', token, {
    domain: '.rechtly.de',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ user: { role: user.role, ...user }, token });
});

// Passwort zurücksetzen anfordern
router.post('/forgot-password', passwordResetValidation, AuthController.requestPasswordReset);

// Passwort zurücksetzen
router.post('/reset-password/:token', newPasswordValidation, AuthController.resetPassword);

router.get('/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Nicht eingeloggt' });
  try {
    const user = verifyJWT(token);
    res.json({ user });
  } catch {
    res.status(401).json({ message: 'Token ungültig' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { domain: '.rechtly.de' });
  res.json({ message: 'Logout erfolgreich' });
});

module.exports = router; 