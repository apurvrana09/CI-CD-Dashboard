import axios, { InternalAxiosRequestConfig } from 'axios';

const baseURL: string = import.meta.env.VITE_API_URL ?? '/api/v1';

export const api = axios.create({
  baseURL,
});

// Attach token if present
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    // ensure headers exists, then set Authorization header
    (config.headers as any) = config.headers || {};
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export default api;
