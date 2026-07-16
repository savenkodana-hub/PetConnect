const express = require('express');

const {
  createPost,
  getPosts,
  getMyPosts,
  getFeedPosts,
  getFriendsFeedPosts,
  getGroupsFeedPosts,
  searchPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  commentOnPost
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateCreatePost,
  validateUpdatePost,
  validateSearchPosts,
  validateComment,
  rejectPostFields,
  rejectCommentFields,
  rejectPostSearchFields,
  handleValidationErrors
} = require('../validators/postValidators');
const { mongoIdParam } = require('../validators/commonValidators');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', upload.single('media'), rejectPostFields, validateCreatePost, handleValidationErrors, createPost);
router.get('/', getPosts);
router.get('/my', getMyPosts);
router.get('/feed', getFeedPosts);
router.get('/feed/friends', getFriendsFeedPosts);
router.get('/feed/groups', getGroupsFeedPosts);
router.get('/search', rejectPostSearchFields, validateSearchPosts, handleValidationErrors, searchPosts);
router.get('/:id', mongoIdParam('id', 'post id'), handleValidationErrors, getPostById);
router.put('/:id', mongoIdParam('id', 'post id'), upload.single('media'), rejectPostFields, validateUpdatePost, handleValidationErrors, updatePost);
router.delete('/:id', mongoIdParam('id', 'post id'), handleValidationErrors, deletePost);
router.post('/:id/like', mongoIdParam('id', 'post id'), handleValidationErrors, likePost);
router.post('/:id/comment', mongoIdParam('id', 'post id'), rejectCommentFields, validateComment, handleValidationErrors, commentOnPost);

module.exports = router;
