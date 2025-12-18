import React from 'react';
import { useNotification } from '../hooks/useNotification';
import './NotificationContainer.css';

function NotificationContainer() {
    const { notifications, removeNotification } = useNotification();

    return (
        <div className="notification-container">
            {notifications.map(notification => (
                <div
                    key={notification.id}
                    className={`notification notification-${notification.type}`}
                    onClick={() => removeNotification(notification.id)}
                >
                    <div className="notification-icon">
                        {notification.type === 'success' && '✓'}
                        {notification.type === 'error' && '✕'}
                        {notification.type === 'info' && 'ℹ'}
                        {notification.type === 'warning' && '⚠'}
                    </div>
                    <div className="notification-message">{notification.message}</div>
                </div>
            ))}
        </div>
    );
}

export default NotificationContainer;
