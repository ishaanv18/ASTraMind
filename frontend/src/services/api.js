import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const API_BASE_URL = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

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
        return response.data;
    },

    checkAuthStatus: async () => {
        const response = await api.get('/auth/status');
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
