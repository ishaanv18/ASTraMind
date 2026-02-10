import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return '✅';
            case 'error':
                return '❌';
            case 'warning':
                return '⚠️';
            case 'loading':
                return '🔄';
            case 'info':
            default:
                return 'ℹ️';
        }
    };

    return (
        <div className={`toast toast-${type}`}>
            <div className="toast-icon">{getIcon()}</div>
            <div className="toast-content">
                <div className="toast-message">{message}</div>
            </div>
            <button className="toast-close" onClick={onClose}>×</button>
        </div>
    );
};

export default Toast;
