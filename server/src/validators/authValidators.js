const { body } = require('express-validator');
const { rejectUnknownFields, handleValidationErrors } = require('./commonValidators');

const validateRegister = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Username must be 2-50 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be valid')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be 6-128 characters')
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be valid')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

module.exports = {
  validateRegister,
  validateLogin,
  rejectRegisterFields: rejectUnknownFields(['username', 'email', 'password']),
  rejectLoginFields: rejectUnknownFields(['email', 'password']),
  handleValidationErrors
};
