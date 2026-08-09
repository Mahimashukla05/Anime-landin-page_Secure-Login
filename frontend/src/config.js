/**
 * Centralized API Configuration for DemoReco V2 Frontend
 * In production (Vercel), VITE_API_BASE_URL will point to the deployed backend (e.g. https://demoreco-api.onrender.com/api).
 * In development, falls back to http://localhost:5000/api.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
