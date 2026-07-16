const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

const buildMediaUrl = (req, filename) => {
  const configuredUrl = (process.env.PUBLIC_SERVER_URL || '').trim();
  const publicServerUrl = configuredUrl
    ? `${/^https?:\/\//i.test(configuredUrl) ? '' : 'http://'}${configuredUrl}`.replace(/\/+$/, '')
    : '';
  const baseUrl = publicServerUrl || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${encodeURIComponent(filename)}`;
};

const removeUploadedFile = async (file) => {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const removeLocalMediaByUrl = async (mediaUrl) => {
  if (!mediaUrl) return;
  try {
    const pathname = new URL(mediaUrl).pathname;
    if (!pathname.startsWith('/uploads/')) return;
    const filename = path.basename(decodeURIComponent(pathname));
    const filePath = path.resolve(UPLOAD_DIR, filename);
    if (path.dirname(filePath) !== UPLOAD_DIR) return;
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.name !== 'TypeError') throw error;
  }
};

module.exports = {
  buildMediaUrl,
  removeUploadedFile,
  removeLocalMediaByUrl
};
