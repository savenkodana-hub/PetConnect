const { body, query } = require('express-validator');
const {
  rejectUnknownFields,
  rejectUnknownQuery,
  requireAtLeastOneField,
  handleValidationErrors
} = require('./commonValidators');

const petTypes = ['dog', 'cat', 'bird', 'rabbit', 'other'];
const petFields = ['name', 'type', 'breed', 'age', 'city', 'bio', 'imageUrl', 'removeImage'];

const validateCreatePet = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Pet name is required')
    .isLength({ max: 100 })
    .withMessage('Pet name cannot exceed 100 characters'),
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Pet type is required')
    .isIn(petTypes)
    .withMessage('Pet type must be dog, cat, bird, rabbit, or other'),
  body('breed')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('age')
    .optional()
    .isNumeric()
    .withMessage('Age must be a number')
    .isFloat({ min: 0 })
    .withMessage('Age cannot be negative'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 }),
  body('imageUrl')
    .optional({ checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('imageUrl must be a valid URL'),
  body('removeImage').optional().isBoolean().toBoolean()
];

const validateUpdatePet = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Pet name cannot be empty')
    .isLength({ max: 100 }),
  body('type')
    .optional()
    .trim()
    .isIn(petTypes)
    .withMessage('Pet type must be dog, cat, bird, rabbit, or other'),
  body('breed')
    .optional()
    .trim(),
  body('age')
    .optional()
    .isNumeric()
    .withMessage('Age must be a number')
    .isFloat({ min: 0 })
    .withMessage('Age cannot be negative'),
  body('city')
    .optional()
    .trim(),
  body('bio')
    .optional()
    .trim(),
  body('imageUrl')
    .optional({ checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('imageUrl must be a valid URL'),
  body('removeImage').optional().isBoolean().toBoolean()
];

const validateSearchPets = [
  query('type')
    .optional()
    .trim()
    .isIn(petTypes)
    .withMessage('Pet type must be dog, cat, bird, rabbit, or other'),
  query('breed')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }),
  query('city')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }),
  query('minAge')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('minAge must be a non-negative number'),
  query('maxAge')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('maxAge must be a non-negative number'),
  query('maxAge').custom((maxAge, { req }) => {
    if (
      req.query.minAge !== undefined &&
      maxAge !== undefined &&
      Number(maxAge) < Number(req.query.minAge)
    ) {
      throw new Error('maxAge must be greater than or equal to minAge');
    }

    return true;
  })
];

module.exports = {
  validateCreatePet,
  validateUpdatePet: [requireAtLeastOneField(petFields), ...validateUpdatePet],
  validateSearchPets,
  rejectPetFields: rejectUnknownFields(petFields),
  rejectPetSearchFields: rejectUnknownQuery(['type', 'breed', 'city', 'minAge', 'maxAge']),
  handleValidationErrors
};
