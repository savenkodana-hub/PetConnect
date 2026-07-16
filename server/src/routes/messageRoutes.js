const express = require('express');

const {
  getConversation,
  getMyConversations
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateConversationParams,
  handleValidationErrors
} = require('../validators/messageValidators');

const router = express.Router();

router.use(protect);

router.get('/conversations', getMyConversations);
router.get(
  '/conversation/:userId',
  validateConversationParams,
  handleValidationErrors,
  getConversation
);

module.exports = router;
