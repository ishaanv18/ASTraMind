import './GradientButton.css';

function GradientButton({
    children,
    variant = 'default',
    onClick,
    disabled = false,
    className = '',
    type = 'button',
    ...props
}) {
    const variantClass = variant === 'variant' ? 'gradient-button-variant' : '';

    return (
        <button
            type={type}
            className={`gradient-button ${variantClass} ${className}`}
            onClick={onClick}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
}

export default GradientButton;
