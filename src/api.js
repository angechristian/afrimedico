const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
  || (import.meta.env.PROD && !API_BASE_URL);

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
