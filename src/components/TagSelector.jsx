import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Tag as TagIcon, PenTool, Trash2, Check } from 'lucide-react';
import { useApp } from '../AppContext';
import * as db from '../db';
import { createPortal } from 'react-dom';

export const DEFAULT_TAGS = ['Before', 'During', 'After', 'Issue', 'Complete'];

export const TRADE_TAGS = {
    'General Contractor': ['Foundation', 'Permit', 'Inspection', 'Punch List', 'Change Order'],
    'Low Voltage': ['Data Drop', 'Rack', 'Camera', 'Access Control', 'Wire Pull', 'Terminated'],
    'Electrical': ['Panel', 'Rough-In', 'Fixture', 'Circuit', 'Switch/Outlet', 'Trim'],
    'Plumbing': ['Rough-In', 'Leak', 'Fixture', 'Drain', 'Water Heater', 'Testing'],
    'HVAC': ['Ductwork', 'Condenser', 'Furnace', 'Thermostat', 'Filter', 'Ventilation'],
    'Framing': ['Studs', 'Joists', 'Trusses', 'Sheathing', 'Header', 'Plate'],
    'Drywall': ['Hanging', 'Taping', 'Mudding', 'Sanding', 'Patch', 'Texture'],
    'Painting': ['Prep', 'Primer', 'First Coat', 'Final Coat', 'Trim', 'Touch-up'],
    'Roofing': ['Underlayment', 'Shingles', 'Flashing', 'Gutter', 'Membrane'],
    'Tile / Stone': ['Substrate', 'Layout', 'Thin-set', 'Grout', 'Sealer', 'Pattern'],
    'Flooring': ['Subfloor', 'Underlayment', 'Planks', 'Transition', 'Baseboard', 'Padding'],
    'Cabinetry': ['Layout', 'Boxes', 'Doors/Drawers', 'Hardware', 'Countertop', 'Filler'],
    'Landscaping': ['Grading', 'Irrigation', 'Planting', 'Hardscape', 'Mulch', 'Sod'],
    'Other': []
};

const TagSelector = ({ selectedTags, onTagsChange, availableTags, dropdownDirection = 'up', projectId = null }) => {
    const { currentUser, updateCurrentUser, refreshProjects } = useApp();
    const defaultTradeTags = currentUser?.Trade ? (TRADE_TAGS[currentUser.Trade] || []) : [];
    // If trade is 'Other', start completely empty (no DEFAULT_TAGS either)
    const defaultTagsList = currentUser?.Trade === 'Other' ? [] : [...DEFAULT_TAGS, ...defaultTradeTags];

    // User's explicitly added custom tags (separate from defaults)
    const customTags = Array.isArray(currentUser?.CustomTags) ? currentUser.CustomTags : [];

    // Tags the user has explicitly deleted (including any defaults)
    const deletedTags = Array.isArray(currentUser?.DeletedTags) ? currentUser.DeletedTags : [];

    // Final visible list = defaults + custom tags, minus anything explicitly deleted
    const activeDatabaseTags = Array.from(new Set([...defaultTagsList, ...customTags]))
        .filter(tag => !deletedTags.includes(tag));

    const baseTags = availableTags || activeDatabaseTags;

    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [customTagInput, setCustomTagInput] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [tagToDelete, setTagToDelete] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isAddingCustom) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isAddingCustom]);

    const toggleTag = (tag) => {
        if (selectedTags.includes(tag)) {
            onTagsChange(selectedTags.filter(t => t !== tag));
        } else {
            onTagsChange([...selectedTags, tag]);
        }
    };

    const handleSelectChange = (value) => {
        if (value === '_custom_') {
            setIsAddingCustom(true);
        } else if (value && value !== '') {
            if (!selectedTags.includes(value)) {
                onTagsChange([...selectedTags, value]);
            }
        }
        setShowDropdown(false);
    };

    const handleAddCustom = () => {
        const cleanTag = customTagInput.trim().replace(/^#+/, '');
        if (cleanTag) {
            if (!selectedTags.includes(cleanTag)) {
                onTagsChange([...selectedTags, cleanTag]);
            }
            const profileUpdates = {};
            if (!customTags.includes(cleanTag) && !defaultTagsList.includes(cleanTag)) {
                profileUpdates.CustomTags = [...customTags, cleanTag];
            }
            if (deletedTags.includes(cleanTag)) {
                profileUpdates.DeletedTags = deletedTags.filter(t => t !== cleanTag);
            }
            if (Object.keys(profileUpdates).length > 0) {
                updateCurrentUser(profileUpdates);
            }
        }
        setCustomTagInput('');
        setIsAddingCustom(false);
    };

    const confirmDeleteGlobal = async () => {
        if (!tagToDelete) return;
        setIsDeleting(true);
        const tag = tagToDelete;

        try {
            // 1. Update user profile (Suggestion List cleanup)
            const profileUpdates = {};
            if (!deletedTags.includes(tag)) {
                profileUpdates.DeletedTags = [...deletedTags, tag];
            }
            if (customTags.includes(tag)) {
                profileUpdates.CustomTags = customTags.filter(t => t !== tag);
            }
            if (Object.keys(profileUpdates).length > 0) {
                await updateCurrentUser(profileUpdates);
            }

            // 2. Remove from current photo selection if present
            if (selectedTags.includes(tag)) {
                onTagsChange(selectedTags.filter(t => t !== tag));
            }

            // 3. Remove from all photos in project (Global cleanup)
            if (projectId) {
                await db.deleteTagGlobally(projectId, tag);
                refreshProjects();
            }

            setShowConfirmModal(false);
            setTagToDelete(null);
        } catch (err) {
            console.error("Failed to delete tag globally", err);
            alert("Could not delete tag. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustom();
        } else if (e.key === 'Escape') {
            setCustomTagInput('');
            setIsAddingCustom(false);
        }
    };

    // Combine dynamic baseTags with any currently selected custom tags so they show in the dropdown options
    const allKnownTags = Array.from(new Set([...baseTags, ...selectedTags]));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>

            {/* Selected Tags Display */}
            {selectedTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {selectedTags.map(tag => (
                        <div
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            style={{
                                padding: '0.3rem 0.6rem',
                                borderRadius: '16px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: 'var(--primary-color)',
                                color: '#0f1115',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            title="Click to remove"
                        >
                            #{tag} <X size={14} />
                        </div>
                    ))}
                </div>
            )}

            {/* Add Tag UI */}
            {isAddingCustom ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', animation: 'fadeIn 0.2s', width: '100%' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontWeight: 'bold' }}>#</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={customTagInput}
                            onChange={(e) => setCustomTagInput(e.target.value)}
                            placeholder="Custom tag name..."
                            onKeyDown={handleKeyDown}
                            style={{
                                width: '100%',
                                padding: '0.6rem 0.8rem 0.6rem 1.6rem',
                                borderRadius: '8px',
                                backgroundColor: 'var(--background)',
                                color: 'white',
                                border: '1px solid var(--primary-color)',
                                fontSize: '0.9rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <button onClick={handleAddCustom} className="btn btn-primary" style={{ padding: '0.6rem 1rem', flexShrink: 0 }}>Add</button>
                    <button onClick={() => setIsAddingCustom(false)} className="btn" style={{ padding: '0.6rem', flexShrink: 0 }} aria-label="Cancel"><X size={18} /></button>
                </div>
            ) : (
                <div style={{ position: 'relative', width: '100%' }}>
                    <div
                        onClick={() => setShowDropdown(!showDropdown)}
                        style={{
                            padding: '0.6rem 0.8rem',
                            borderRadius: '8px',
                            backgroundColor: 'var(--background)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            fontSize: '0.9rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <span>+ Add a Tag...</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>

                    {showDropdown && (
                        <div style={{
                            position: 'absolute',
                            bottom: dropdownDirection === 'up' ? '100%' : 'auto',
                            top: dropdownDirection === 'down' ? '100%' : 'auto',
                            left: 0,
                            right: 0,
                            marginBottom: dropdownDirection === 'up' ? '4px' : '0',
                            marginTop: dropdownDirection === 'down' ? '4px' : '0',
                            backgroundColor: 'var(--background)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            boxShadow: '0 -4px 12px rgba(0,0,0,0.3)',
                            zIndex: 100
                        }}>
                            <div
                                onClick={() => handleSelectChange('_custom_')}
                                style={{ padding: '0.8rem', borderBottom: '1px solid var(--border)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <PenTool size={16} /> Create Custom Tag...
                            </div>

                            {allKnownTags.length > 0 && (
                                <div style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                    Your Tags
                                </div>
                            )}
                            {allKnownTags.map(tag => {
                                const isSelected = selectedTags.includes(tag);
                                return (
                                    <div
                                        key={tag}
                                        onClick={() => handleSelectChange(tag)}
                                        style={{ padding: '0.8rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {isSelected ? <Check size={16} color="var(--primary-color)" /> : <div style={{ width: 16 }} />}
                                            <span style={{ color: isSelected ? 'var(--primary-color)' : 'var(--text-primary)', fontWeight: isSelected ? 'bold' : 'normal' }}>#{tag}</span>
                                        </div>
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setTagToDelete(tag);
                                                setShowConfirmModal(true);
                                            }}
                                            style={{ padding: '4px', paddingRight: '0', color: '#ef4444', display: 'flex' }}
                                        >
                                            <Trash2 size={16} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Consolidated Confirmation Modal */}
            {showConfirmModal && createPortal(
                <div className="modal-overlay" onClick={() => { if (!isDeleting) { setShowConfirmModal(false); setTagToDelete(null); } }} style={{ zIndex: 3000 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '340px' }}>
                        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '48px', height: '48px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                            <Trash2 size={24} />
                        </div>
                        <h3 style={{ marginBottom: '0.5rem' }}>Remove from all photos?</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                            If you delete this tag it will remove itself from any other photo in the project that the tag is assigned to.
                        </p>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button className="btn" style={{ flex: 1 }} onClick={() => { setShowConfirmModal(false); setTagToDelete(null); }} disabled={isDeleting}>Cancel</button>
                            <button className="btn" style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none' }} onClick={confirmDeleteGlobal} disabled={isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};

export default TagSelector;
