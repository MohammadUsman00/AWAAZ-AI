/**
 * API base URL. Empty = same origin (recommended when using `npm start` server).
 * For split deploys, set before loading main.js: window.__AWAAZ_API_BASE__ = 'https://api.example.com'
 */
function apiBase() {
  if (typeof window !== 'undefined' && window.__AWAAZ_API_BASE__ != null && window.__AWAAZ_API_BASE__ !== '') {
    return String(window.__AWAAZ_API_BASE__).replace(/\/$/, '');
  }
  return '';
}

export const API = {
  get baseUrl() {
    return apiBase();
  },
  analyzePath: '/api/analyze',
};
