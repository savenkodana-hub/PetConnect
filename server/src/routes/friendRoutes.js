const express = require('express');

const {
  acceptFriendRequest,
  getFriends,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest
} = require('../controllers/friendController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateUserId,
  validateUserSearch,
  rejectUserSearchFields,
  handleValidationErrors
} = require('../validators/friendValidators');

const router = express.Router();

router.use(protect);

router.get('/', getFriends);
router.get('/users', rejectUserSearchFields, validateUserSearch, handleValidationErrors, searchUsers);
router.post('/request/:userId', validateUserId, handleValidationErrors, sendFriendRequest);
router.post('/accept/:userId', validateUserId, handleValidationErrors, acceptFriendRequest);
router.post('/reject/:userId', validateUserId, handleValidationErrors, rejectFriendRequest);

module.exports = router;
