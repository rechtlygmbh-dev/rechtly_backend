const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['mandant', 'anwalt', 'gutachter', 'admin'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  activationToken: String,
  activationTokenExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  profile: {
    phone: String,
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: String
    },
    company: String,
    position: String,
    specialization: [String]
  },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    language: { type: String, default: 'de' }
  }
}, {
  timestamps: true
});

// Passwort-Hashing vor dem Speichern
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Methode zum Vergleichen von Passwörtern
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Methode zum Generieren des Aktivierungstokens
userSchema.methods.generateActivationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.activationToken = token;
  this.activationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 Stunden
  return token;
};

// Methode zum Generieren des Reset-Tokens
userSchema.methods.generateResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = token;
  this.resetPasswordExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 Stunde
  return token;
};

const User = mongoose.model('User', userSchema);

module.exports = User; 