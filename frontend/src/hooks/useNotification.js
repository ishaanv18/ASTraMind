import { useState, useCallback } from 'react';

let addNotificationCallback = null;

export const useNotification = () => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((title, type = 'info', description = '', options = {}) => {
        const id = Date.now() + Math.random(); // More unique ID
        const notification = { id, title, type, description, ...options };

        setNotifications(prev => [...prev, notification]);

        // Auto-remove after duration (default 5 seconds)
        const duration = options.duration !== undefined ? options.duration : 5000;
        if (duration > 0) {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, duration);
        }
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    // Store the callback globally
    if (!addNotificationCallback) {
        addNotificationCallback = addNotification;
    }

    return { notifications, addNotification, removeNotification, clearAll };
};

// Global function to show notifications from anywhere
export const showNotification = (title, type = 'info', description = '', options = {}) => {
    if (addNotificationCallback) {
        addNotificationCallback(title, type, description, options);
    }
};
