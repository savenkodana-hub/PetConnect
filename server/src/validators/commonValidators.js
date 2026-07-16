const { body, param, validationResult } = require('express-validator');

const mongoIdParam = (name, label = name) =>
  param(name).isMongoId().withMessage(`${label} must be a valid ObjectId`);

const rejectUnknownFields = (allowedFields) => (req, res, next) => {
  const unknownFields = Object.keys(req.body || {}).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length) {
    res.status(400);
    return next(new Error(`Unsupported fields: ${unknownFields.join(', ')}`));
  }

  return next();
};

const rejectUnknownQuery = (allowedFields) => (req, res, next) => {
  const unknownFields = Object.keys(req.query || {}).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length) {
    res.status(400);
    return next(new Error(`Unsupported query fields: ${unknownFields.join(', ')}`));
  }

  return next();
};

const requireAtLeastOneField = (allowedFields) =>
  body().custom((value) => {
    if (!value || !allowedFields.some((field) => value[field] !== undefined)) {
      throw new Error('At least one supported field is required');
    }
    return true;
  });

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  res.status(400);
  return next(new Error(errors.array().map((error) => error.msg).join(', ')));
};

module.exports = {
  mongoIdParam,
  rejectUnknownFields,
  rejectUnknownQuery,
  requireAtLeastOneField,
  handleValidationErrors
};
