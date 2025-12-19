import axios from 'axios';
import { getToken, clearToken } from '../utils/auth';

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
// Ensure base URL ends with /api (add it only if not already present)
const API_BASE_URL = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add JWT token to all requests
api.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle 401 errors (unauthorized) - clear token and redirect to login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            clearToken();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const authService = {
    getGitHubAuthUrl: async () => {
        const response = await api.get('/auth/github');
        return response.data.authUrl;
    },

    getCurrentUser: async () => {
        const response = await api.get('/auth/user');
        return response.data;
    },

    logout: async () => {
        const response = await api.post('/auth/logout');
        clearToken(); // Clear JWT token on logout
        return response.data;
    },

    checkAuthStatus: async () => {
        const response = await api.get('/auth/status');
        return response.data;
    },

    validateToken: async (token) => {
        const response = await api.post('/auth/validate', { token });
        return response.data;
    },
};

export const githubService = {
    listRepositories: async () => {
        const response = await api.get('/github/repositories');
        return response.data;
    },

    getRepository: async (owner, repo) => {
        const response = await api.get(`/github/repository/${owner}/${repo}`);
        return response.data;
    },
};

export default api;
