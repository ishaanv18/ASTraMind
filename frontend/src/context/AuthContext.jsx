import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { showNotification } from '../hooks/useNotification';
import { getToken, getUserFromToken, isTokenExpired, clearToken } from '../utils/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            // Check if we have a valid JWT token
            const token = getToken();

            if (token && !isTokenExpired()) {
                // Get user info from token
                const userInfo = getUserFromToken();
                if (userInfo) {
                    setUser(userInfo);
                    setAuthenticated(true);
                    setLoading(false);
                    return; // Trust the token, don't call server
                }
            }

            // If no valid token, try to check with server (fallback to session)
            // This is for backward compatibility with session-based auth
            try {
                const status = await authService.checkAuthStatus();

                if (status.authenticated) {
                    const userData = await authService.getCurrentUser();
                    setUser(userData);
                    setAuthenticated(true);
                } else {
                    // Not authenticated, clear any invalid token
                    clearToken();
                    setAuthenticated(false);
                    setUser(null);
                }
            } catch (apiError) {
                // Server API call failed, but don't automatically logout
                // Just mark as not authenticated and let user try to login
                console.error('Auth status check failed:', apiError);
                clearToken();
                setAuthenticated(false);
                setUser(null);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setAuthenticated(false);
            setUser(null);
            clearToken();
        } finally {
            setLoading(false);
        }
    };

    const login = async () => {
        try {
            const authUrl = await authService.getGitHubAuthUrl();
            window.location.href = authUrl;
        } catch (error) {
            console.error('Login failed:', error);
            showNotification('Failed to initiate login', 'error');
        }
    };

    const logout = async () => {
        try {
            await authService.logout();
            setUser(null);
            setAuthenticated(false);
            showNotification('Logged out successfully', 'success');
            // Small delay to show notification before redirect
            setTimeout(() => {
                window.location.href = '/login';
            }, 500);
        } catch (error) {
            console.error('Logout failed:', error);
            // Even if logout fails on server, clear local state and redirect
            setUser(null);
            setAuthenticated(false);
            clearToken();
            showNotification('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = '/login';
            }, 500);
        }
    };

    const value = {
        user,
        authenticated,
        loading,
        login,
        logout,
        checkAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
