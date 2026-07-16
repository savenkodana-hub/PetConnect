const express = require('express');

const {
  register,
  login,
  getCurrentUser
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin,
  rejectRegisterFields,
  rejectLoginFields,
  handleValidationErrors
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register', rejectRegisterFields, validateRegister, handleValidationErrors, register);
router.post('/login', rejectLoginFields, validateLogin, handleValidationErrors, login);
router.get('/me', protect, getCurrentUser);

module.exports = router;
