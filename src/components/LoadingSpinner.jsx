import React from 'react';

const LoadingSpinner = ({ fullScreen = true, message = '', size = '40px', padding = '0' }) => {
    const spinner = (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
                width: size, 
                height: size, 
                border: '3px solid var(--border)', 
                borderTopColor: 'var(--primary-color)', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
            }} />
            {message && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>{message}</p>}
        </div>
    );

    if (fullScreen) {
        return (
            <div style={{ height: '100dvh', backgroundColor: 'var(--background)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {spinner}
            </div>
        );
    }

    return (
        <div style={{ padding: padding, display: 'flex', justifyContent: 'center', width: '100%' }}>
            {spinner}
        </div>
    );
};

export default LoadingSpinner;
