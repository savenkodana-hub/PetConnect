const express = require('express');

const {
  createGroup,
  getGroups,
  getMyGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  joinGroup,
  approveMember,
  rejectMember,
  removeMember,
  searchGroupMembers,
  searchGroups
} = require('../controllers/groupController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateCreateGroup,
  validateUpdateGroup,
  validateSearchGroups,
  validateManagerMemberSearch,
  rejectGroupFields,
  rejectGroupSearchFields,
  rejectManagerMemberSearchFields,
  handleValidationErrors
} = require('../validators/groupValidators');
const { mongoIdParam } = require('../validators/commonValidators');

const router = express.Router();

router.use(protect);

router.post('/', rejectGroupFields, validateCreateGroup, handleValidationErrors, createGroup);
router.get('/', getGroups);
router.get('/my', getMyGroups);
router.get('/search', rejectGroupSearchFields, validateSearchGroups, handleValidationErrors, searchGroups);
router.get(
  '/:id/members/search',
  mongoIdParam('id', 'group id'),
  rejectManagerMemberSearchFields,
  validateManagerMemberSearch,
  handleValidationErrors,
  searchGroupMembers
);
router.get('/:id', mongoIdParam('id', 'group id'), handleValidationErrors, getGroupById);
router.put('/:id', mongoIdParam('id', 'group id'), rejectGroupFields, validateUpdateGroup, handleValidationErrors, updateGroup);
router.delete('/:id', mongoIdParam('id', 'group id'), handleValidationErrors, deleteGroup);
router.post('/:id/join', mongoIdParam('id', 'group id'), handleValidationErrors, joinGroup);
router.post('/:id/approve/:userId', mongoIdParam('id', 'group id'), mongoIdParam('userId', 'user id'), handleValidationErrors, approveMember);
router.post('/:id/reject/:userId', mongoIdParam('id', 'group id'), mongoIdParam('userId', 'user id'), handleValidationErrors, rejectMember);
router.delete('/:id/members/:userId', mongoIdParam('id', 'group id'), mongoIdParam('userId', 'user id'), handleValidationErrors, removeMember);

module.exports = router;
