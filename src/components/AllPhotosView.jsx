import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import * as db from '../db';
import PhotoViewer from './PhotoViewer';
import { ArrowLeft, ArrowUp, ArrowDown, ChevronDown, Check } from 'lucide-react';

const AllPhotosView = ({ navigateTo, initialPhotoId }) => {
    const [photos, setPhotos] = useState(() => db.getCachedAllPhotos() || []);
    const [loading, setLoading] = useState(() => {
        return !(db.getCachedAllPhotos() && db.getCachedAllProjects());
    });
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'
    // To optionally show which project a photo belongs to
    const [projects, setProjects] = useState(() => db.getCachedAllProjects() || []);
    const [folders, setFolders] = useState(() => db.getCachedAllFolders() || []);
    const [activeProjectFilter, setActiveProjectFilter] = useState('All');
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);

    const openPhotoViewer = (photo) => {
        setSelectedPhoto(photo);
    };

    // Helper to sort photos based on state
    const sortPhotos = (photosArray) => {
        return [...photosArray].sort((a, b) => {
            const dateA = new Date(a.Timestamp);
            const dateB = new Date(b.Timestamp);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!db.getCachedAllPhotos() || !db.getCachedAllProjects() || !db.getCachedAllFolders()) {
                setLoading(true);
            }

            const allProjects = await db.getProjects();

            // Aggressively destroy orphaned ghost photos directly from the Datastore 
            try {
                const swept = await db.scrubOrphanedPhotosByDocId();
                if (swept) {
                    console.log("Database scrubbed. Re-fetching clean baseline.");
                }
            } catch (e) { console.error("Could not sweep photos", e); }

            const rawPhotos = await db.getAllPhotos();
            const allFolders = await db.getAllFolders();

            setProjects(allProjects);
            setFolders(allFolders);

            const activeProjectIds = new Set(
                allProjects.filter(p => !p.ArchivedAt).map(p => p.ProjectID)
            );
            const validPhotos = rawPhotos.filter(photo => activeProjectIds.has(photo.ProjectID));

            const sortedPhotos = sortPhotos(validPhotos);
            setPhotos(sortedPhotos);

            if (initialPhotoId) {
                const targetPhoto = sortedPhotos.find(p => p.PhotoID === initialPhotoId);
                if (targetPhoto) {
                    setSelectedPhoto(targetPhoto);
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [sortOrder, initialPhotoId]);

    // Listen for the router clearing the initialPhotoId (e.g. returning to library after a 'Save')
    useEffect(() => {
        if (!initialPhotoId) {
            setSelectedPhoto(null);
        }
    }, [initialPhotoId]);

    const getProjectName = (projectId) => {
        const p = projects.find(proj => proj.ProjectID === projectId);
        return p ? p.ProjectName : 'Unknown Project';
    };

    const getFolderName = (folderId) => {
        if (!folderId) return null;
        const f = folders.find(folder => folder.FolderID === folderId);
        return f ? f.Name : null;
    };

    if (loading) return <div className="content-pad">Loading photos...</div>;

    const uniqueProjectIds = Array.from(new Set(photos.map(p => p.ProjectID)));
    const uniqueProjects = uniqueProjectIds.map(id => ({
        id,
        name: getProjectName(id)
    })).sort((a, b) => a.name.localeCompare(b.name));

    const displayedPhotos = photos.filter(p => activeProjectFilter === 'All' ? true : p.ProjectID === activeProjectFilter);

    const getFilterLabel = () => {
        if (activeProjectFilter === 'All') return 'All Projects';
        const p = uniqueProjects.find(up => up.id === activeProjectFilter);
        return p ? p.name : 'Unknown Project';
    };

    return (
        <div className="project-detail-view" style={{ paddingBottom: '110px' }}>
            <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <button 
                    className="btn" 
                    onClick={() => navigateTo('HOME')} 
                    style={{ 
                        background: 'var(--surface-active)', 
                        border: '1px solid var(--border)', 
                        padding: '0.5rem', 
                        borderRadius: '50%', 
                        width: '40px', 
                        height: '40px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0 
                    }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>All Photos</h2>
                </div>
                <button
                    onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        width: '70px',
                        justifyContent: 'flex-end'
                    }}
                >
                    {sortOrder === 'newest' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                </button>
            </header>

            <div className="content-pad">
                {photos.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                        <p>No photos yet.</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Photos from all of your projects will appear here.</p>
                    </div>
                ) : (
                    <>
                        {/* Project Filters */}
                        {uniqueProjects.length > 0 && (
                            <div style={{ position: 'relative', marginBottom: '1rem', padding: '0 1.5rem', marginTop: '1rem' }}>
                                <button
                                    onClick={() => setShowProjectDropdown(v => !v)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, width: '100%', justifyContent: 'space-between' }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Filter:</span>
                                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                            {getFilterLabel()}
                                        </span>
                                    </span>
                                    <ChevronDown size={16} color="var(--text-secondary)" style={{ transform: showProjectDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                                </button>

                                {showProjectDropdown && (
                                    <>
                                        {/* Backdrop */}
                                        <div onClick={() => setShowProjectDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                                        {/* Panel */}
                                        <div className="hide-scrollbar" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '1.5rem', right: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflowY: 'auto', maxHeight: '300px', zIndex: 51, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                            <div
                                                onClick={() => { setActiveProjectFilter('All'); setShowProjectDropdown(false); }}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', backgroundColor: activeProjectFilter === 'All' ? 'rgba(249,115,22,0.1)' : 'transparent' }}
                                            >
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: activeProjectFilter === 'All' ? 'var(--primary-color)' : 'var(--text-primary)' }}>
                                                    All Projects
                                                </span>
                                                {activeProjectFilter === 'All' && <Check size={16} color="var(--primary-color)" />}
                                            </div>
                                            {uniqueProjects.map(proj => (
                                                <div
                                                    key={proj.id}
                                                    onClick={() => { setActiveProjectFilter(proj.id); setShowProjectDropdown(false); }}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', backgroundColor: activeProjectFilter === proj.id ? 'rgba(249,115,22,0.1)' : 'transparent' }}
                                                >
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: activeProjectFilter === proj.id ? 'var(--primary-color)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {proj.name}
                                                    </span>
                                                    {activeProjectFilter === proj.id && <Check size={16} color="var(--primary-color)" flexShrink={0} />}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="photo-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '2px', // Instagram style tight grid
                            margin: '0 -1.5rem' // Break out of container padding for edge-to-edge
                        }}>
                            {displayedPhotos.map((photo, idx) => (
                                <div key={photo.PhotoID} className="aspect-square bg-gray-200 cursor-pointer overflow-hidden" onClick={() => openPhotoViewer(photo)} style={{ position: 'relative', aspectRatio: '1/1', backgroundColor: 'var(--surface)' }}>
                                    <img
                                        src={photo.ImageFile}
                                        alt="Project"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    {/* Project & Room Badges */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '6px', left: '6px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        maxWidth: 'calc(100% - 12px)',
                                        alignItems: 'flex-start'
                                    }}>
                                        <div style={{
                                            background: '#000000',
                                            color: 'white',
                                            fontSize: '0.65rem',
                                            fontWeight: '500',
                                            padding: '3px 6px',
                                            borderRadius: '12px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: '100%',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            {getProjectName(photo.ProjectID)}
                                        </div>
                                        {photo.FolderID && getFolderName(photo.FolderID) && (
                                            <div style={{
                                                background: '#0ea5e9',
                                                color: 'white',
                                                fontSize: '0.65rem',
                                                fontWeight: '600',
                                                padding: '3px 6px',
                                                borderRadius: '12px',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: '100%',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }}>
                                                {getFolderName(photo.FolderID)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <AnimatePresence>
                {selectedPhoto && (
                    <PhotoViewer
                        photos={photos}
                        initialIndex={photos.findIndex(p => p.PhotoID === selectedPhoto.PhotoID)}
                        disableAnimation={selectedPhoto.PhotoID === initialPhotoId}
                        onClose={() => setSelectedPhoto(null)}
                        onAnnotate={(photo) => {
                            // DO NOT close viewer! Keep it mounted behind the Markup overlay!
                            navigateTo('MARKUP', photo.ProjectID, photo.ImageFile, photo.PhotoID);
                        }}
                        onUpdateNotes={async (photoId, newNotes, newTags) => {
                            await db.updatePhotoDetails(photoId, newNotes, newTags);
                            const newPhotos = await db.getAllPhotos();
                            setPhotos(sortPhotos(newPhotos));
                            if (selectedPhoto.PhotoID === photoId) {
                                setSelectedPhoto(newPhotos.find(p => p.PhotoID === photoId));
                            }
                        }}
                        onDelete={async (photoId) => {
                            await db.deletePhoto(photoId);
                            const newPhotos = await db.getAllPhotos();
                            const sorted = sortPhotos(newPhotos);
                            setPhotos(sorted);
                            if (sorted.length === 0) setSelectedPhoto(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AllPhotosView;
