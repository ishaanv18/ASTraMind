import { useNotification } from '../hooks/useNotification';
import './NotificationProvider.css';

export function NotificationProvider({ children }) {
    const { notifications, removeNotification } = useNotification();

    const getIcon = (type) => {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            loading: '🔄'
        };
        return icons[type] || icons.info;
    };

    return (
        <>
            {children}
            <div className="notification-container">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`notification notification-${notification.type}`}
                    >
                        <div className="notification-indicator">
                            {getIcon(notification.type)}
                        </div>
                        <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            {notification.description && (
                                <div className="notification-description">
                                    {notification.description}
                                </div>
                            )}
                        </div>
                        <div className="notification-actions">
                            {notification.actionLabel && notification.onAction && (
                                <button
                                    className="notification-action-btn"
                                    onClick={() => {
                                        notification.onAction();
                                        removeNotification(notification.id);
                                    }}
                                >
                                    {notification.actionLabel}
                                </button>
                            )}
                            <button
                                className="notification-close-btn"
                                onClick={() => removeNotification(notification.id)}
                                aria-label="Close notification"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
