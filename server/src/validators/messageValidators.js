const { param } = require('express-validator');
const { handleValidationErrors } = require('./commonValidators');

const validateConversationParams = [
  param('userId')
    .isMongoId()
    .withMessage('userId must be a valid ObjectId')
];

module.exports = {
  validateConversationParams,
  handleValidationErrors
};
