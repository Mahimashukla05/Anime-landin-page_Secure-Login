/**
 * Centralized API Configuration for Komorebi V2 Frontend
 * In production, VITE_API_BASE_URL will point to the deployed backend.
 * In development, falls back to http://localhost:5000/api.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
