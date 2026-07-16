const crypto = require('crypto');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm'
};

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, callback) => {
    const extension = MIME_EXTENSIONS[file.mimetype];
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MEDIA_MAX_BYTES) || 25 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      const error = new Error('Unsupported media type');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  }
});

module.exports = upload;
