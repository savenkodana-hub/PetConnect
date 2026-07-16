const { body, query } = require('express-validator');
const {
  rejectUnknownFields,
  rejectUnknownQuery,
  requireAtLeastOneField,
  handleValidationErrors
} = require('./commonValidators');

const groupCategories = ['dogs', 'cats', 'adoption', 'training', 'health', 'general'];
const groupFields = ['name', 'description', 'category', 'isPrivate'];
const managerMemberSearchFields = [
  'username',
  'status',
  'minPosts',
  'maxPosts',
  'startDate',
  'endDate'
];
const MAX_POST_FILTER = 1000000;

const validateCreateGroup = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ max: 100 })
    .withMessage('Group name cannot exceed 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Group description cannot exceed 1000 characters'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Group category is required')
    .isIn(groupCategories)
    .withMessage('Group category must be dogs, cats, adoption, training, health, or general'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean')
    .toBoolean()
];

const validateUpdateGroup = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Group name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Group name cannot exceed 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Group description cannot exceed 1000 characters'),
  body('category')
    .optional()
    .trim()
    .isIn(groupCategories)
    .withMessage('Group category must be dogs, cats, adoption, training, health, or general'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean')
    .toBoolean()
];

const validateSearchGroups = [
  query('name')
    .optional()
    .isString()
    .withMessage('name must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('name cannot exceed 100 characters'),
  query('category')
    .optional()
    .trim()
    .isIn(groupCategories)
    .withMessage('Group category must be dogs, cats, adoption, training, health, or general'),
  query('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be true or false')
];

const validateManagerMemberSearch = [
  query('username')
    .optional()
    .isString()
    .withMessage('username must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('username cannot exceed 100 characters'),
  query('status')
    .optional()
    .isIn(['member', 'pending'])
    .withMessage('status must be member or pending'),
  query('minPosts')
    .optional()
    .isInt({ min: 0, max: MAX_POST_FILTER })
    .withMessage(`minPosts must be an integer between 0 and ${MAX_POST_FILTER}`)
    .toInt(),
  query('maxPosts')
    .optional()
    .isInt({ min: 0, max: MAX_POST_FILTER })
    .withMessage(`maxPosts must be an integer between 0 and ${MAX_POST_FILTER}`)
    .toInt(),
  query('maxPosts').custom((maxPosts, { req }) => {
    if (
      req.query.minPosts !== undefined &&
      maxPosts !== undefined &&
      Number(maxPosts) < Number(req.query.minPosts)
    ) {
      throw new Error('maxPosts must be greater than or equal to minPosts');
    }

    return true;
  }),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid date'),
  query('endDate').custom((endDate, { req }) => {
    if (
      req.query.startDate &&
      endDate &&
      new Date(endDate) < new Date(req.query.startDate)
    ) {
      throw new Error('endDate must be greater than or equal to startDate');
    }

    return true;
  })
];

module.exports = {
  validateCreateGroup,
  validateUpdateGroup: [requireAtLeastOneField(groupFields), ...validateUpdateGroup],
  validateSearchGroups,
  validateManagerMemberSearch,
  rejectGroupFields: rejectUnknownFields(groupFields),
  rejectGroupSearchFields: rejectUnknownQuery(['name', 'category', 'isPrivate']),
  rejectManagerMemberSearchFields: rejectUnknownQuery(managerMemberSearchFields),
  handleValidationErrors
};
