// src/utils/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.VITE_API_URL,
});

export default api;
