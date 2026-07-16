const express = require('express');

const {
  getMyActivity,
  getPostsPerMonth,
  getPostsPerGroup,
  getPetsByType,
  getUsersPerMonth
} = require('../controllers/statsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/my-activity', getMyActivity);
router.get('/posts-per-month', getPostsPerMonth);
router.get('/posts-per-group', getPostsPerGroup);
router.get('/pets-by-type', getPetsByType);
router.get('/users-per-month', getUsersPerMonth);

module.exports = router;
