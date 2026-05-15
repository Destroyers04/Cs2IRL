import axios from 'axios';
import { getToken } from './auth';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(requestConfig => {
  const storedToken = getToken();
  if (storedToken) requestConfig.headers.Authorization = `Bearer ${storedToken}`;
  return requestConfig;
});

export default api;
