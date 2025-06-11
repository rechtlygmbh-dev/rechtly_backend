const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const EmailService = require('../services/emailService');
const config = require('../config/config');
const logger = require('../utils/logger');

class AuthController {
  // Registrierung
  static async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role } = req.body;

      // Prüfen, ob Benutzer bereits existiert
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: 'Benutzer existiert bereits' });
      }

      // Neuen Benutzer erstellen
      user = new User({
        email,
        password,
        firstName,
        lastName,
        role
      });

      // Aktivierungstoken generieren
      const activationToken = user.generateActivationToken();
      await user.save();

      // Aktivierungs-Email senden
      await EmailService.sendActivationEmail(user, activationToken);

      res.status(201).json({
        message: 'Registrierung erfolgreich. Bitte aktivieren Sie Ihr Konto über den Link in der E-Mail.'
      });
    } catch (error) {
      logger.error('Fehler bei der Registrierung:', error);
      res.status(500).json({ message: 'Server-Fehler' });
    }
  }

  // Kontoaktivierung
  static async activate(req, res) {
    try {
      const { token } = req.params;

      const user = await User.findOne({
        activationToken: token,
        activationTokenExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ message: 'Ungültiger oder abgelaufener Aktivierungslink' });
      }

      user.isActive = true;
      user.activationToken = undefined;
      user.activationTokenExpires = undefined;
      await user.save();

      // Willkommens-Email senden
      await EmailService.sendWelcomeEmail(user);

      res.json({ message: 'Konto erfolgreich aktiviert' });
    } catch (error) {
      logger.error('Fehler bei der Kontoaktivierung:', error);
      res.status(500).json({ message: 'Server-Fehler' });
    }
  }

  // Login
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Benutzer finden
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Ungültige Anmeldedaten' });
      }

      // Prüfen, ob Konto aktiviert ist
      if (!user.isActive) {
        return res.status(401).json({ message: 'Bitte aktivieren Sie zuerst Ihr Konto' });
      }

      // Passwort prüfen
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Ungültige Anmeldedaten' });
      }

      // JWT Token generieren
      const token = jwt.sign(
        { 
          userId: user._id,
          role: user.role
        },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      // Letzten Login aktualisieren
      user.lastLogin = Date.now();
      await user.save();

      res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Fehler beim Login:', error);
      res.status(500).json({ message: 'Server-Fehler' });
    }
  }

  // Passwort zurücksetzen anfordern
  static async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'Benutzer nicht gefunden' });
      }

      const resetToken = user.generateResetToken();
      await user.save();

      await EmailService.sendPasswordResetEmail(user, resetToken);

      res.json({ message: 'E-Mail zum Zurücksetzen des Passworts wurde gesendet' });
    } catch (error) {
      logger.error('Fehler bei der Passwort-Reset-Anfrage:', error);
      res.status(500).json({ message: 'Server-Fehler' });
    }
  }

  // Passwort zurücksetzen
  static async resetPassword(req, res) {
    try {
      const { token } = req.params;
      const { password } = req.body;

      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ message: 'Ungültiger oder abgelaufener Reset-Link' });
      }

      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({ message: 'Passwort erfolgreich zurückgesetzt' });
    } catch (error) {
      logger.error('Fehler beim Zurücksetzen des Passworts:', error);
      res.status(500).json({ message: 'Server-Fehler' });
    }
  }
}

module.exports = AuthController; 