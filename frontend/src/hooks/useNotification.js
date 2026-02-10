import { useState, useCallback } from 'react';

let addNotificationCallback = null;

export const useNotification = () => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((message, type = 'info') => {
        const id = Date.now();
        const notification = { id, message, type };

        setNotifications(prev => [...prev, notification]);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // Store the callback globally
    if (!addNotificationCallback) {
        addNotificationCallback = addNotification;
    }

    return { notifications, addNotification, removeNotification };
};

// Global function to show notifications from anywhere
export const showNotification = (message, type = 'info') => {
    if (addNotificationCallback) {
        addNotificationCallback(message, type);
    }
};
