const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PUBLIC_USER_FIELDS = 'username';

module.exports = {
  escapeRegex,
  PUBLIC_USER_FIELDS
};
