import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as db from '../db';
import { useApp } from '../AppContext';
import { Trash2, Edit2, Star, MapPin, RefreshCcw } from 'lucide-react';
import AddressAutocomplete from './AddressAutocomplete';

const ProjectCard = ({ project, navigateTo, hideLocation = false }) => {
    const [thumbnail, setThumbnail] = useState(null);
    const [openTodosCount, setOpenTodosCount] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editName, setEditName] = useState(project.ProjectName);
    const [editLocation, setEditLocation] = useState(project.Location);
    const [editLat, setEditLat] = useState(project.Lat);
    const [editLon, setEditLon] = useState(project.Lon);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { refreshProjects } = useApp();

    const handleLocationChange = (name, lat, lon) => {
        setEditLocation(name);
        setEditLat(lat !== undefined ? lat : null);
        setEditLon(lon !== undefined ? lon : null);
    };

    useEffect(() => {
        const fetchData = async () => {
            const photos = await db.getPhotosForProject(project.ProjectID);
            if (photos && photos.length > 0) {
                photos.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
                setThumbnail(photos[0].ImageFile);
            }

            const todos = await db.getTodosForProject(project.ProjectID);
            if (todos) {
                const openCount = todos.filter(t => !t.IsCompleted).length;
                setOpenTodosCount(openCount);
            }
        };
        fetchData();
    }, [project.ProjectID]);

    return (
        <div
            onClick={() => navigateTo('PROJECT_DETAIL', project.ProjectID)}
            style={{
                height: '240px',
                borderRadius: '24px',
                backgroundColor: 'var(--surface)',
                marginBottom: '1rem',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid var(--border)'
            }}>
            {thumbnail ? (
                <img src={thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} alt="Thumbnail" />
            ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                    No Photos Yet
                </div>
            )}

            {/* Text Info Overlay */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '1.2rem',
                background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 40%, transparent 100%)',
                pointerEvents: 'none' // Let clicks pass through to card
            }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {project.ProjectName}
                    {openTodosCount > 0 && (
                        <span style={{
                            backgroundColor: 'white',
                            color: 'var(--background)',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                        }}>
                            {openTodosCount} left
                        </span>
                    )}
                </h3>
                {!hideLocation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
                        <MapPin size={12} /> {project.Location || 'No location set'}
                    </div>
                )}
                <div style={{ marginTop: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
                    Created {new Date(project.CreatedAt).toLocaleDateString()}
                </div>
                {project.ArchivedAt && (
                    <div style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: '#ef4444', fontWeight: 600, textAlign: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        Archived {Math.floor((new Date() - new Date(project.ArchivedAt)) / (1000 * 60 * 60 * 24))} days ago
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {
                project.ArchivedAt ? (
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                await db.restoreProject(project.ProjectID);
                                refreshProjects();
                            }}
                            style={{
                                padding: '0.4rem 0.8rem', borderRadius: '20px',
                                backgroundColor: 'rgba(56, 189, 248, 0.9)', color: '#000',
                                border: '1px solid rgba(56, 189, 248, 1)', cursor: 'pointer', backdropFilter: 'blur(5px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                fontWeight: 700, fontSize: '0.8rem'
                            }}
                        >
                            <RefreshCcw size={14} /> Restore
                        </button>
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(true);
                            }}
                            style={{
                                padding: '0.4rem 0.8rem', borderRadius: '20px',
                                backgroundColor: 'rgba(239, 68, 68, 0.9)', color: '#fff',
                                border: '1px solid rgba(239, 68, 68, 1)', cursor: 'pointer', backdropFilter: 'blur(5px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                fontWeight: 700, fontSize: '0.8rem'
                            }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Action Buttons (Centered Top) */}
                        <div style={{ position: 'absolute', top: '1rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.6rem', zIndex: 10 }}>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    await db.updateProject(project.ProjectID, { IsFavorite: !project.IsFavorite });
                                    refreshProjects();
                                }}
                                style={{
                                    width: '36px', height: '36px',
                                    borderRadius: '18px', backgroundColor: 'var(--surface)', backdropFilter: 'blur(5px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid var(--border)', color: project.IsFavorite ? '#f59e0b' : 'var(--text-primary)',
                                    cursor: 'pointer', transition: 'transform 0.2s'
                                }}
                            >
                                <Star size={16} fill={project.IsFavorite ? "#f59e0b" : "none"} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                                style={{
                                    width: '36px', height: '36px',
                                    borderRadius: '18px', backgroundColor: 'var(--surface)', backdropFilter: 'blur(5px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid var(--border)', color: 'var(--text-primary)',
                                    cursor: 'pointer', transition: 'transform 0.2s'
                                }}
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    setShowArchiveConfirm(true);
                                }}
                                style={{
                                    width: '36px', height: '36px',
                                    borderRadius: '18px', backgroundColor: 'rgba(239, 68, 68, 0.9)', backdropFilter: 'blur(5px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid rgba(239, 68, 68, 1)', color: '#ffffff',
                                    cursor: 'pointer', transition: 'transform 0.2s'
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </>
                )}

            {/* Edit Project Modal */}
            {
                isEditing && createPortal(
                    <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <h2 style={{ marginBottom: '1.5rem' }}>Edit Project Details</h2>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!editName.trim()) return;
                                setIsSubmitting(true);
                                await db.updateProject(project.ProjectID, {
                                    ProjectName: editName,
                                    Location: editLocation,
                                    Lat: editLat,
                                    Lon: editLon
                                });
                                setIsSubmitting(false);
                                setIsEditing(false);
                                refreshProjects(); // Cleanly refresh state without flashing white
                            }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Project Name *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div style={{ marginTop: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Location (Optional)</label>
                                    <AddressAutocomplete
                                        value={editLocation}
                                        onChange={handleLocationChange}
                                        placeholder="e.g. 123 Main St"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                    <button type="button" className="btn" onClick={() => setIsEditing(false)} style={{ flex: 1 }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={!editName.trim() || isSubmitting} style={{ flex: 1 }}>
                                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Archive Confirmation Modal */}
            {
                showArchiveConfirm && createPortal(
                    <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowArchiveConfirm(false); }} style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', padding: '1.5rem' }}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '2rem', textAlign: 'center', maxWidth: '300px', borderRadius: '24px' }}>
                            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '56px', height: '56px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                <Trash2 size={28} />
                            </div>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.8rem' }}>Archive Project?</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                                Are you sure you want to move "{project.ProjectName}" to the archive?
                            </p>
                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setShowArchiveConfirm(false); }} style={{ flex: 1, backgroundColor: 'var(--surface-hover)', border: 'none' }}>
                                    Cancel
                                </button>
                                <button type="button" className="btn"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        await db.updateProject(project.ProjectID, { ArchivedAt: new Date().toISOString() });
                                        setShowArchiveConfirm(false);
                                        refreshProjects();
                                    }}
                                    style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none' }}>
                                    Archive
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Permanent Delete Confirmation Modal */}
            {
                showDeleteConfirm && createPortal(
                    <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }} style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', padding: '1.5rem' }}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '2rem', textAlign: 'center', maxWidth: '300px', borderRadius: '24px' }}>
                            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '56px', height: '56px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                <Trash2 size={28} />
                            </div>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.8rem' }}>Delete Forever?</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                                "{project.ProjectName}" and all of its photos will be permanently deleted. This cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }} style={{ flex: 1, backgroundColor: 'var(--surface-hover)', border: 'none' }}>
                                    Cancel
                                </button>
                                <button type="button" className="btn"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        await db.permanentlyDeleteProject(project.ProjectID);
                                        setShowDeleteConfirm(false);
                                        refreshProjects();
                                    }}
                                    style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none' }}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default ProjectCard;
