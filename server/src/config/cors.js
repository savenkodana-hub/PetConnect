const parseAllowedOrigins = () =>
  (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const getCorsOrigin = () => {
  const allowedOrigins = parseAllowedOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction && allowedOrigins.length === 0) {
    return true;
  }

  return (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin is not allowed by CORS'));
  };
};

module.exports = {
  getCorsOrigin
};
