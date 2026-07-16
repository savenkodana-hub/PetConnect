import axios from 'axios';

export const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is required. Copy client/.env.example to client/.env.');
}

export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || API_URL.replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

let unauthorizedHandler = null;
let isHandlingUnauthorized = false;

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
};

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && unauthorizedHandler && !isHandlingUnauthorized) {
      isHandlingUnauthorized = true;
      try {
        await unauthorizedHandler();
      } finally {
        isHandlingUnauthorized = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
