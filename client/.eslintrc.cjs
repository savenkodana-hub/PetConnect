module.exports = {
  env: { browser: true, es2022: true },
  extends: ['eslint:recommended'],
  plugins: ['react'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  globals: { FormData: 'readonly', process: 'readonly' },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react/jsx-uses-vars': 'error'
  }
};
