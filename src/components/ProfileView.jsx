import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { X, Camera, Edit2, Check } from 'lucide-react';

// Reusable Info Item Component
const InfoItem = ({ label, value, isEditing, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
        {isEditing ? (
            <input
                type="text"
                className="input-field"
                style={{ marginTop: '4px', marginBottom: 0, padding: '8px 12px' }}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
            />
        ) : (
            <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{value || <span style={{ opacity: 0.5 }}>Not set</span>}</span>
        )}
    </div>
);

// Reusable Info Select Component
const InfoSelect = ({ label, value, options, isEditing, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
        {isEditing ? (
            <select
                className="input-field"
                style={{ marginTop: '4px', marginBottom: 0, padding: '8px 12px', appearance: 'auto' }}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Select a trade...</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        ) : (
            <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{value || <span style={{ opacity: 0.5 }}>Not set</span>}</span>
        )}
    </div>
);

// Reusable Section Component
const InfoSection = ({ title, children }) => (
    <div style={{
        padding: '1.5rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--background)'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <div>
            {children}
        </div>
    </div>
);

const ProfileView = ({ navigateTo }) => {
    const { currentUser, updateCurrentUser } = useApp();

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ ...currentUser });

    useEffect(() => {
        if (currentUser) setFormData({ ...currentUser });
    }, [currentUser]);

    const handleEdit = () => {
        setFormData({ ...currentUser }); // Reset to current state before editing
        setIsEditing(true);
    };

    const handleSave = async () => {
        await updateCurrentUser(formData);
        setIsEditing(false);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const getInitials = (nameStr) => {
        if (!nameStr) return 'NA';
        return nameStr.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <div className="profile-view" style={{ paddingBottom: '110px', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
            {/* Header */}
            <header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)'
            }}>
                <button onClick={() => navigateTo('HOME')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0 }}>
                    <X size={26} />
                </button>
                <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    My Info
                </h2>
                {isEditing ? (
                    <button
                        onClick={handleSave}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', borderRadius: '20px',
                            backgroundColor: 'var(--primary-color)', border: 'none',
                            color: 'white', fontSize: '0.85rem', fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        <Check size={14} /> Save
                    </button>
                ) : (
                    <button
                        onClick={handleEdit}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', borderRadius: '20px',
                            backgroundColor: 'var(--surface-active)', border: 'none',
                            color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        <Edit2 size={14} /> Edit
                    </button>
                )}
            </header>

            {/* Avatar Name Banner */}
            <div style={{
                padding: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1rem',
                borderBottom: '1px solid var(--border)'
            }}>
                <div style={{ position: 'relative' }}>
                    <div style={{
                        width: 70, height: 70, borderRadius: '35px', backgroundColor: 'var(--surface-active)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                        fontSize: '1.8rem', border: '1px solid var(--border)', color: 'var(--text-primary)'
                    }}>
                        {getInitials(name)}
                    </div>
                    {/* Small Camera Badge */}
                    <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 26, height: 26, borderRadius: '13px', backgroundColor: 'var(--primary-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--background)',
                        color: 'white'
                    }}>
                        <Camera size={12} />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{currentUser?.Name}</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{currentUser?.Company}</span>
                </div>
            </div>

            {/* Sections */}
            <InfoSection title="Account Info">
                <InfoItem label="Email Address" value={isEditing ? formData.Email : currentUser?.Email} isEditing={isEditing} onChange={(v) => handleChange('Email', v)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Password</span>
                    <span style={{ fontSize: '1.4rem', color: 'var(--text-primary)', letterSpacing: '4px', lineHeight: '1rem', marginTop: '4px' }}>
                        ••••••••••••
                    </span>
                </div>
            </InfoSection>

            <InfoSection title="Profile Info">
                <InfoItem label="Full name" value={isEditing ? formData.Name : currentUser?.Name} isEditing={isEditing} onChange={(v) => handleChange('Name', v)} />
                <InfoItem label="Phone Number" value={isEditing ? formData.Phone : currentUser?.Phone} isEditing={isEditing} onChange={(v) => handleChange('Phone', v)} />
                <InfoItem label="Job Title" value={isEditing ? formData.JobTitle : currentUser?.JobTitle} isEditing={isEditing} onChange={(v) => handleChange('JobTitle', v)} />
            </InfoSection>

            <InfoSection title="Company Info">
                <InfoItem label="Company Name" value={isEditing ? formData.Company : currentUser?.Company} isEditing={isEditing} onChange={(v) => handleChange('Company', v)} />
                <InfoSelect
                    label="Primary Trade (Optional)"
                    value={isEditing ? formData.Trade : currentUser?.Trade}
                    isEditing={isEditing}
                    onChange={(v) => handleChange('Trade', v)}
                    options={['General Contractor', 'Electrical', 'Low Voltage', 'Plumbing', 'HVAC', 'Framing', 'Drywall', 'Painting', 'Roofing', 'Landscaping', 'Other']}
                />
            </InfoSection>

        </div>
    );
};

export default ProfileView;
