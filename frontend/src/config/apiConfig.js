// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
    console.error('VITE_API_BASE_URL is not set! Check your environment variables.');
    throw new Error('API base URL is not configured. Please set VITE_API_BASE_URL environment variable.');
}

export default API_BASE_URL;
