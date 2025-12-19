// JWT Token Management Utilities

/**
 * Extract and store JWT token from URL parameter
 * Called when user is redirected back from OAuth
 */
export const handleAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
        localStorage.setItem('jwt_token', token);
        // Clean up URL (remove token parameter)
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    }
    return false;
};

/**
 * Get stored JWT token
 */
export const getToken = () => {
    return localStorage.getItem('jwt_token');
};

/**
 * Remove token (logout)
 */
export const clearToken = () => {
    localStorage.removeItem('jwt_token');
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
    return !!getToken();
};

/**
 * Decode JWT token to get user info (without verification)
 * Note: This is for display purposes only, server still validates
 */
export const decodeToken = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
};

/**
 * Get user info from stored token
 */
export const getUserFromToken = () => {
    const token = getToken();
    if (!token) return null;

    const decoded = decodeToken(token);
    if (!decoded) return null;

    return {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email
    };
};

/**
 * Check if token is expired
 */
export const isTokenExpired = () => {
    const token = getToken();
    if (!token) return true;

    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    // Check if token expiration time is in the past
    return decoded.exp * 1000 < Date.now();
};
