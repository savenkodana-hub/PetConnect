const { query } = require('express-validator');
const { mongoIdParam, rejectUnknownQuery, handleValidationErrors } = require('./commonValidators');

const validateUserId = [mongoIdParam('userId', 'userId')];
const validateUserSearch = [
  query('q')
    .optional()
    .isString()
    .withMessage('q must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('q cannot exceed 100 characters')
];

module.exports = {
  validateUserId,
  validateUserSearch,
  rejectUserSearchFields: rejectUnknownQuery(['q']),
  handleValidationErrors
};
