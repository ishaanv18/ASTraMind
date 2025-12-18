import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { showNotification } from '../hooks/useNotification';

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
            const status = await authService.checkAuthStatus();
            setAuthenticated(status.authenticated);

            if (status.authenticated) {
                const userData = await authService.getCurrentUser();
                setUser(userData);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setAuthenticated(false);
            setUser(null);
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
