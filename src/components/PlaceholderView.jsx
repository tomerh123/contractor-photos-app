import React from 'react';
import { ArrowLeft, Settings, User, Image as ImageIcon, PenTool } from 'lucide-react';

const PlaceholderView = ({ title, type, navigateTo, returnView = 'HOME' }) => {
    // Generate dummy items based on type
    const getDummyContent = () => {
        if (type === 'settings' || type === 'profile') {
            return (
                <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                        {type === 'settings' ? <Settings size={64} className="text-[var(--primary-color)]" /> : <User size={64} className="text-[var(--primary-color)]" />}
                    </div>
                    <h3>Coming Soon</h3>
                    <p style={{ marginTop: '0.5rem' }}>This screen is just a placeholder to demonstrate the intended app flow.</p>
                </div>
            );
        }

        return (
            <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                    {type === 'photos' ? <ImageIcon size={64} className="text-[var(--text-tertiary)]" /> : <PenTool size={64} className="text-[var(--text-tertiary)]" />}
                </div>
                <h3>No {type} yet.</h3>
                <p style={{ marginTop: '0.5rem' }}>This space is currently empty.</p>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--background)' }}>
            <header className="header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '64px', borderBottom: '1px solid var(--border)' }}>
                <button
                    onClick={() => navigateTo(returnView)}
                    style={{ position: 'absolute', left: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <h2 style={{ fontSize: '1.3rem', margin: 0, textAlign: 'center', padding: '0 40px' }}>{title}</h2>
            </header>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {getDummyContent()}
            </div>
        </div>
    );
};

export default PlaceholderView;
