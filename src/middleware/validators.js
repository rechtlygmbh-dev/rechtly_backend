const { body } = require('express-validator');

const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Das Passwort muss mindestens 8 Zeichen lang sein')
    .matches(/\d/)
    .withMessage('Das Passwort muss mindestens eine Zahl enthalten')
    .matches(/[A-Z]/)
    .withMessage('Das Passwort muss mindestens einen Großbuchstaben enthalten')
    .matches(/[a-z]/)
    .withMessage('Das Passwort muss mindestens einen Kleinbuchstaben enthalten'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Vorname ist erforderlich'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Nachname ist erforderlich'),
  body('role')
    .isIn(['mandant', 'anwalt', 'gutachter', 'admin'])
    .withMessage('Ungültige Benutzerrolle')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Passwort ist erforderlich')
];

const passwordResetValidation = [
  body('email')
    .isEmail()
    .withMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein')
    .normalizeEmail()
];

const newPasswordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Das Passwort muss mindestens 8 Zeichen lang sein')
    .matches(/\d/)
    .withMessage('Das Passwort muss mindestens eine Zahl enthalten')
    .matches(/[A-Z]/)
    .withMessage('Das Passwort muss mindestens einen Großbuchstaben enthalten')
    .matches(/[a-z]/)
    .withMessage('Das Passwort muss mindestens einen Kleinbuchstaben enthalten')
];

module.exports = {
  registerValidation,
  loginValidation,
  passwordResetValidation,
  newPasswordValidation
}; 