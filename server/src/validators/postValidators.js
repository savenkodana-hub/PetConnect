const { body, query } = require('express-validator');
const {
  rejectUnknownFields,
  rejectUnknownQuery,
  requireAtLeastOneField,
  handleValidationErrors
} = require('./commonValidators');

const postFields = [
  'content', 'imageUrl', 'videoUrl', 'stickerData', 'group', 'pet',
  'removeImage', 'removeVideo'
];

const validateStickerPayload = (value) => {
  let drawing = value;
  if (typeof drawing === 'string') {
    try {
      drawing = JSON.parse(drawing);
    } catch (error) {
      throw new Error('stickerData must be valid JSON');
    }
  }
  if (JSON.stringify(drawing).length > 50000) throw new Error('stickerData is too large');
  if (!Array.isArray(drawing) || drawing.length > 30) {
    throw new Error('stickerData must contain at most 30 strokes');
  }
  drawing.forEach((stroke) => {
    if (!stroke || typeof stroke.color !== 'string' || stroke.color.length > 32 || !Array.isArray(stroke.points)) {
      throw new Error('stickerData contains an invalid stroke');
    }
    if (stroke.points.length > 500) throw new Error('A drawing stroke cannot exceed 500 points');
    stroke.points.forEach((point) => {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
        throw new Error('stickerData contains an invalid point');
      }
    });
  });
  return true;
};

const validateCreatePost = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Post content is required')
    .isLength({ max: 5000 })
    .withMessage('Post content cannot exceed 5000 characters'),
  body('imageUrl')
    .optional({ checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('imageUrl must be a valid URL'),
  body('videoUrl')
    .optional({ checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('videoUrl must be a valid URL'),
  body('stickerData')
    .optional()
    .custom(validateStickerPayload),
  body('group')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('group must be a valid ObjectId'),
  body('pet')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('pet must be a valid ObjectId'),
  body('removeImage').optional().isBoolean().toBoolean(),
  body('removeVideo').optional().isBoolean().toBoolean()
];

const validateUpdatePost = [
  body('content')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Post content cannot be empty')
    .isLength({ max: 5000 })
    .withMessage('Post content cannot exceed 5000 characters'),
  body('imageUrl')
    .optional({ checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('imageUrl must be a valid URL'),
  body('videoUrl')
    .optional({ checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('videoUrl must be a valid URL'),
  body('stickerData')
    .optional()
    .custom(validateStickerPayload),
  body('group')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('group must be a valid ObjectId'),
  body('pet')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('pet must be a valid ObjectId'),
  body('removeImage').optional().isBoolean().toBoolean(),
  body('removeVideo').optional().isBoolean().toBoolean()
];

const validateSearchPosts = [
  query('keyword')
    .optional()
    .isString()
    .withMessage('keyword must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('keyword cannot exceed 100 characters'),
  query('group')
    .optional()
    .isMongoId()
    .withMessage('group must be a valid ObjectId'),
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

const validateComment = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Comment text is required')
    .isLength({ max: 2000 })
    .withMessage('Comment text cannot exceed 2000 characters')
];

module.exports = {
  validateCreatePost,
  validateUpdatePost: [requireAtLeastOneField(postFields), ...validateUpdatePost],
  validateSearchPosts,
  validateComment,
  rejectPostFields: rejectUnknownFields(postFields),
  rejectCommentFields: rejectUnknownFields(['text']),
  rejectPostSearchFields: rejectUnknownQuery(['keyword', 'group', 'startDate', 'endDate']),
  handleValidationErrors
};
