const { removeUploadedFile } = require('../utils/mediaFiles');

const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, _next) => {
  if (req.file) {
    removeUploadedFile(req.file).catch(() => {});
  }
  let statusCode =
    Number.isInteger(err.status) && err.status >= 400 && err.status < 600
      ? err.status
      : res.statusCode === 200
        ? 500
        : res.statusCode;
  let message = err.message || 'Server error';

  if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
    statusCode = 409;
    message = 'Email is already registered';
  }

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Invalid ObjectId';
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((error) => error.message).join(', ');
  }

  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large';
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'Media file is too large';
  }

  if (err.name === 'MulterError' && err.code !== 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'Invalid media upload';
  }

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON request body';
  }

  if (message === 'Origin is not allowed by CORS') {
    statusCode = 403;
  }

  if (statusCode >= 500) {
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    message
  });
};

module.exports = {
  notFound,
  errorHandler
};
