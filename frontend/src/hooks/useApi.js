import { API_ENDPOINT } from '../config';

/**
 * Hook for making authenticated API calls
 * Automatically adds Authorization: Bearer header with ID token from localStorage
 */
export const useApi = () => {
  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Get token from localStorage and add Authorization header
    const idToken = localStorage.getItem('google_id_token');
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch(`${API_ENDPOINT}${endpoint}`, {
      ...options,
      headers,
    });

    return response;
  };

  return { apiCall };
};
