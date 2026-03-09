import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { X, Camera, Edit2, Check, LogOut, AlertTriangle, Settings } from 'lucide-react';
import { auth } from '../firebase';
import { signOut, deleteUser } from 'firebase/auth';
import * as db from '../db';

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
    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

    // Account Deletion States
    const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
    const [showDeleteAccountDoubleConfirm, setShowDeleteAccountDoubleConfirm] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            // AppContext will see auth change, set currentUser = null, and OnboardingView will show.
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeletingAccount(true);
        try {
            // Unrecoverable data wipe
            await db.completelyDeleteUserAccount();
            const user = auth.currentUser;
            if (user) {
                await deleteUser(user);
            }
            // User is wiped. AppContext will react to the user vanishing and kick us to Onboarding.
        } catch (error) {
            console.error("Error deleting account:", error);
            if (error.code === 'auth/requires-recent-login') {
                alert("For security reasons, Firebase requires a fresh login to delete an account. You will now be logged out so you can log back in and try again.");
                await signOut(auth);
            } else {
                alert("An error occurred while deleting your account. Please log out, log back in, and try again.");
            }
        } finally {
            setIsDeletingAccount(false);
            setShowDeleteAccountDoubleConfirm(false);
            setShowDeleteAccountConfirm(false);
        }
    };

    const getInitials = (nameStr) => {
        if (!nameStr) return 'NA';
        return (nameStr?.split(' ')?.map(n => n[0])?.join('') || 'TH').substring(0, 2).toUpperCase();
    };

    return (
        <div className="profile-view" style={{ paddingBottom: '110px', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
            {/* Header */}
            <header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.5rem', 
                paddingTop: 'calc(1rem + env(safe-area-inset-top))',
                borderBottom: '1px solid var(--border)'
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

            <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <button
                    onClick={() => navigateTo('SETTINGS')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 24px', borderRadius: '8px',
                        backgroundColor: 'var(--surface-active)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 'bold',
                        cursor: 'pointer', width: '100%', justifyContent: 'center'
                    }}
                >
                    <Settings size={18} /> Settings
                </button>

                <button
                    onClick={() => setShowSignOutConfirm(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 24px', borderRadius: '8px',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: 'var(--primary-color)', fontSize: '1rem', fontWeight: 'bold',
                        cursor: 'pointer', width: '100%', justifyContent: 'center'
                    }}
                >
                    <LogOut size={18} /> Sign Out
                </button>

                <button
                    onClick={() => setShowDeleteAccountConfirm(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 24px', borderRadius: '8px',
                        backgroundColor: 'transparent', border: '1px solid rgba(239, 68, 68, 0.1)',
                        color: 'rgba(239, 68, 68, 0.8)', fontSize: '0.9rem', fontWeight: 'bold',
                        cursor: 'pointer', width: '100%', justifyContent: 'center'
                    }}
                >
                    <AlertTriangle size={18} /> Delete Account
                </button>
            </div>

            {/* Sign Out Confirmation Modal */}
            {
                showSignOutConfirm && (
                    <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowSignOutConfirm(false); }} style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', padding: '1.5rem' }}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '2rem', textAlign: 'center', maxWidth: '300px', borderRadius: '24px' }}>
                            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-color)', width: '56px', height: '56px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                <LogOut size={28} />
                            </div>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.8rem' }}>Sign Out?</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                                Are you sure you want to sign out of your account?
                            </p>
                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setShowSignOutConfirm(false); }} style={{ flex: 1, backgroundColor: 'var(--surface-hover)', border: 'none' }}>
                                    Cancel
                                </button>
                                <button type="button" className="btn"
                                    onClick={handleSignOut}
                                    style={{ flex: 1, backgroundColor: 'var(--primary-color)', color: 'white', border: 'none' }}>
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* Delete Account Stage 1 Modal */}
            {
                showDeleteAccountConfirm && !showDeleteAccountDoubleConfirm && (
                    <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowDeleteAccountConfirm(false); }} style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', padding: '1.5rem' }}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '2rem', textAlign: 'center', maxWidth: '300px', borderRadius: '24px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '56px', height: '56px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                <AlertTriangle size={28} />
                            </div>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.8rem', color: '#ef4444' }}>Delete Account?</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                                This will permanently delete your profile, projects, photos, and all data from our servers. This action <strong>cannot</strong> be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setShowDeleteAccountConfirm(false); }} style={{ flex: 1, backgroundColor: 'var(--surface-hover)', border: 'none' }}>
                                    Cancel
                                </button>
                                <button type="button" className="btn"
                                    onClick={() => setShowDeleteAccountDoubleConfirm(true)}
                                    style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none' }}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* Delete Account Stage 2 (Double Confirm) Modal */}
            {
                showDeleteAccountDoubleConfirm && (
                    <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowDeleteAccountDoubleConfirm(false); setShowDeleteAccountConfirm(false); }} style={{ zIndex: 1001, backgroundColor: 'rgba(239, 68, 68, 0.9)', alignItems: 'center', padding: '1.5rem' }}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '2rem', textAlign: 'center', maxWidth: '300px', borderRadius: '24px', backgroundColor: '#000', border: '2px solid #ef4444' }}>
                            <div style={{ color: '#ef4444', margin: '0 auto 1.5rem auto' }}>
                                <AlertTriangle size={48} />
                            </div>
                            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.8rem', color: 'white' }}>Final Warning</h2>
                            <p style={{ color: '#ef4444', fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                Are you absolutely sure?
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                                All of your data will be instantly completely wiped from existence.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <button type="button" className="btn"
                                    onClick={handleDeleteAccount}
                                    disabled={isDeletingAccount}
                                    style={{ width: '100%', backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '1rem', fontWeight: 'bold' }}>
                                    {isDeletingAccount ? 'Wiping Data...' : 'I Understand, Wipe Everything'}
                                </button>
                                <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setShowDeleteAccountDoubleConfirm(false); setShowDeleteAccountConfirm(false); }} style={{ width: '100%', backgroundColor: 'var(--surface-hover)', border: 'none' }} disabled={isDeletingAccount}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

        </div>
    );
};

export default ProfileView;
