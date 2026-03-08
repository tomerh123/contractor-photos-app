import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import * as db from '../db';
import {
    Folder, Image as ImageIcon, PenTool, Settings,
    Search, Bell, User, Plus, Camera, Sparkles,
    Trash2, MapPin, Star, Share2
} from 'lucide-react';

const QuickLink = ({ icon, title }) => (
    <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '16px',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        cursor: 'pointer',
        border: '1px solid var(--border)'
    }}>
        <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            backgroundColor: 'var(--surface-active)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)'
        }}>
            {icon}
        </div>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</span>
    </div>
);

import ProjectCard from './ProjectCard';
import AddressAutocomplete from './AddressAutocomplete';

const ProjectList = ({ navigateTo }) => {
    const { currentUser, projects, loading, refreshProjects } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [showCameraProjectSelector, setShowCameraProjectSelector] = useState(false);
    const [showShareProjectSelector, setShowShareProjectSelector] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [newLat, setNewLat] = useState(null);
    const [newLon, setNewLon] = useState(null);
    const [nearbyProject, setNearbyProject] = useState(null);
    const [isLocating, setIsLocating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeFilter, setActiveFilter] = useState('Recent');
    const [activeTab, setActiveTab] = useState('Active'); // 'Active' or 'Archived'
    const [isCreatingFromCamera, setIsCreatingFromCamera] = useState(false);

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        setIsSubmitting(true);

        let finalLat = newLat;
        let finalLon = newLon;

        // Auto-fetch coordinates if the user typed an address but hit Submit before the dropdown could attach coordinates
        if (newLocation && (finalLat === null || finalLon === null)) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newLocation)}&countrycodes=us&addressdetails=1&limit=1`, {
                    headers: { 'Accept-Language': 'en-US,en;q=0.9' }
                });
                const data = await response.json();
                if (data && data.length > 0) {
                    finalLat = parseFloat(data[0].lat);
                    finalLon = parseFloat(data[0].lon);
                }
            } catch (err) {
                console.warn('Geolocation auto-fetch failed on submit', err);
            }
        }

        const newProject = await db.addProject({
            ProjectName: newProjectName,
            Location: newLocation || '',
            Lat: finalLat,
            Lon: finalLon
        });
        await refreshProjects();
        setNewProjectName('');
        setNewLocation('');
        setNewLat(null);
        setNewLon(null);
        setShowModal(false);
        setIsSubmitting(false);

        if (isCreatingFromCamera) {
            setIsCreatingFromCamera(false);
            navigateTo('CAMERA', newProject.ProjectID);
        }
    };

    const handleLocationChange = (name, lat, lon) => {
        setNewLocation(name);
        setNewLat(lat !== undefined ? lat : null);
        setNewLon(lon !== undefined ? lon : null);
    };

    // Haversine formula for distance in meters
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const handleGlobalCameraClick = () => {
        setIsLocating(true);
        setShowCameraProjectSelector(true);
        setNearbyProject(null);

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;

                let closest = null;
                let minDistance = 15000; // max radius in meters (increased to 15km to account for desktop IP location inaccuracy)

                projects.forEach(p => {
                    if (p.Lat && p.Lon) {
                        const dist = getDistance(userLat, userLon, p.Lat, p.Lon);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closest = p;
                        }
                    }
                });

                setNearbyProject(closest);
                setIsLocating(false);
            }, (error) => {
                console.warn('Geolocation error:', error);
                setIsLocating(false);
            }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
        } else {
            setIsLocating(false);
        }
    };

    const displayedProjects = [...projects]
        .filter(p => {
            // Tab filtering
            if (activeTab === 'Active' && p.ArchivedAt) return false;
            if (activeTab === 'Archived' && !p.ArchivedAt) return false;

            // Pill filtering (only applies to Active tab)
            if (activeTab === 'Active' && activeFilter === 'Favorites' && !p.IsFavorite) return false;

            return true;
        })
        .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

    return (
        <div className="project-list-view" style={{ paddingBottom: '160px', overflowX: 'hidden' }}>
            {/* Top Toolbar */}
            <header className="header" style={{ position: 'relative', borderBottom: 'none' }}>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <div
                        onClick={() => navigateTo('PROFILE')}
                        style={{
                            width: 40, height: 40, borderRadius: '20px', backgroundColor: 'var(--surface-active)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                            fontSize: '1rem', border: '1px solid var(--border)', cursor: 'pointer'
                        }}>
                        {currentUser?.Name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'TH'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>

                    <button style={{ width: 40, height: 40, borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bell size={18} />
                    </button>
                </div>
            </header>

            <div style={{ padding: '0 1.5rem' }}>
                {/* Greeting */}
                <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem', textAlign: 'center' }}>Welcome, {currentUser?.Name?.split(' ')[0] || 'Tomer'}</h1>

                {/* Workspace Section (Elevated to Top) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Recent Projects</h2>
                    <span onClick={() => navigateTo('ALL_PROJECTS')} style={{ fontSize: '0.95rem', color: 'var(--primary-color)', backgroundColor: 'var(--surface)', padding: '6px 14px', borderRadius: '20px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)' }}>View All ({projects.filter(p => !p.ArchivedAt).length})</span>
                </div>

                {/* Projects Carousel Feed */}
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading projects...</div>
                ) : displayedProjects.length === 0 ? (
                    <div style={{ padding: '0 2rem', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--surface)', borderRadius: '24px', height: '240px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)' }}>
                        No active projects. Tap the + to create one.
                    </div>
                ) : (
                    <div className="hide-scrollbar" style={{
                        display: 'flex',
                        gap: '1rem',
                        overflowX: 'auto',
                        paddingBottom: '1.5rem',
                        margin: '0 -1.5rem',
                        paddingLeft: '1.5rem',
                        paddingRight: '1.5rem'
                    }}>
                        {displayedProjects.slice(0, 2).map(project => (
                            <div key={project.ProjectID} style={{ width: 'calc(50vw - 2rem)', minWidth: '160px', flex: 'none', scrollSnapAlign: 'start' }}>
                                <ProjectCard project={project} navigateTo={navigateTo} hideLocation={true} />
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Links Grid */}
                <h2 style={{ fontSize: '1.3rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>Navigation</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', paddingBottom: '2rem' }}>
                    <div onClick={() => navigateTo('ALL_PROJECTS')}>
                        <QuickLink icon={<Folder size={22} />} title="All Projects" />
                    </div>
                    <div onClick={() => navigateTo('RECENT_PHOTOS')}>
                        <QuickLink icon={<ImageIcon size={22} />} title="All Photos" />
                    </div>
                    <div onClick={() => { setIsCreatingFromCamera(false); setShowModal(true); }}>
                        <QuickLink icon={<Plus size={22} />} title="New Project" />
                    </div>
                    <div onClick={() => setShowShareProjectSelector(true)}>
                        <QuickLink icon={<Share2 size={22} />} title="Share Project" />
                    </div>
                </div>
            </div>

            {/* Floating Action Dock */}
            <div className="floating-dock">
                <button className="dock-btn main" onClick={handleGlobalCameraClick}><Camera size={26} /></button>
            </div>

            {/* Create Project Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Create New Project</h2>
                        <form onSubmit={handleCreateProject}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Project Name *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. Smith Residence - Pre-wire"
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Location (Optional)</label>
                                <AddressAutocomplete
                                    value={newLocation}
                                    onChange={handleLocationChange}
                                    placeholder="e.g. 123 Main St"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={!newProjectName.trim() || isSubmitting} style={{ flex: 1 }}>
                                    {isSubmitting ? 'Creating...' : 'Create Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Camera Project Selector Modal */}
            {showCameraProjectSelector && (
                <div className="modal-overlay" onClick={() => setShowCameraProjectSelector(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.3rem' }}>Select a Project</h2>

                        <div className="hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '350px', overflowY: 'auto', marginBottom: '1.5rem', padding: '0.2rem' }}>
                            <button
                                onClick={() => {
                                    setShowCameraProjectSelector(false);
                                    setIsCreatingFromCamera(true);
                                    setShowModal(true);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', textAlign: 'left', padding: '1rem',
                                    backgroundColor: 'var(--surface)', border: '1px dashed var(--border)',
                                    borderRadius: '12px', cursor: 'pointer', width: '100%',
                                    transition: 'background-color 0.2s',
                                }}
                            >
                                <div style={{ marginRight: '1rem', width: '24px', height: '24px', borderRadius: '12px', backgroundColor: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Plus size={16} />
                                </div>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.05rem' }}>Create New Project</div>
                            </button>

                            {projects.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', textAlign: 'center' }}>
                                    No active projects found.
                                </p>
                            ) : (
                                <>
                                    {isLocating && (
                                        <div style={{ padding: '0.8rem', textAlign: 'center', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-color)', borderRadius: '12px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <div style={{ width: '12px', height: '12px', border: '2px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                            Detecting nearby projects...
                                        </div>
                                    )}

                                    {nearbyProject && (
                                        <button
                                            onClick={() => {
                                                setShowCameraProjectSelector(false);
                                                navigateTo('CAMERA', nearbyProject.ProjectID);
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', textAlign: 'left', padding: '1rem',
                                                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                                                border: '1px solid rgba(34, 197, 94, 0.5)',
                                                borderRadius: '12px', cursor: 'pointer', width: '100%',
                                                position: 'relative', overflow: 'hidden'
                                            }}
                                        >
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: '#22c55e' }}></div>
                                            <span style={{ marginRight: '1rem', color: '#22c55e' }}>
                                                <MapPin size={24} />
                                            </span>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.05rem' }}>{nearbyProject.ProjectName}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#22c55e', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                                    📍 You are here
                                                </div>
                                            </div>
                                        </button>
                                    )}

                                    {projects.filter(p => !nearbyProject || p.ProjectID !== nearbyProject.ProjectID).map(p => (
                                        <button
                                            key={p.ProjectID}
                                            onClick={() => {
                                                setShowCameraProjectSelector(false);
                                                navigateTo('CAMERA', p.ProjectID);
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', textAlign: 'left', padding: '1rem',
                                                backgroundColor: 'var(--background)', border: '1px solid var(--border)',
                                                borderRadius: '12px', cursor: 'pointer', width: '100%',
                                                transition: 'border-color 0.2s',
                                            }}
                                        >
                                            <span style={{ marginRight: '1rem', color: 'var(--primary-color)' }}>
                                                <Folder size={24} />
                                            </span>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.05rem' }}>{p.ProjectName}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <MapPin size={12} /> {p.Location}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                        <button className="btn" onClick={() => setShowCameraProjectSelector(false)} style={{ width: '100%' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {/* Share Project Selector Modal */}
            {showShareProjectSelector && (
                <div className="modal-overlay" onClick={() => setShowShareProjectSelector(false)} style={{ zIndex: 1100 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                        padding: '1.5rem',
                        display: 'flex', flexDirection: 'column', gap: '1rem',
                        maxHeight: '80vh'
                    }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>Share Project</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            Select a project from your library to generate a public, read-only viewing link.
                        </p>
                        <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto' }}>
                            {projects.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', textAlign: 'center' }}>
                                    No active projects found.
                                </p>
                            ) : (
                                projects.map(p => (
                                    <button
                                        key={p.ProjectID}
                                        onClick={() => {
                                            setShowShareProjectSelector(false);
                                            alert("We are still working on this feature! Check back soon.");
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', textAlign: 'left', padding: '1rem',
                                            backgroundColor: 'var(--background)', border: '1px solid var(--border)',
                                            borderRadius: '12px', cursor: 'pointer', width: '100%',
                                            transition: 'border-color 0.2s',
                                        }}
                                    >
                                        <span style={{ marginRight: '1rem', color: 'var(--primary-color)' }}>
                                            <Folder size={24} />
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.05rem' }}>{p.ProjectName}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={12} /> {p.Location}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        <button className="btn" onClick={() => setShowShareProjectSelector(false)} style={{ width: '100%' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectList;
