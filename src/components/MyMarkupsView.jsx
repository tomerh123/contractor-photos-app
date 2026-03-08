import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import * as db from '../db';
import PhotoViewer from './PhotoViewer';
import { ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';

const MyMarkupsView = ({ navigateTo, initialPhotoId }) => {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'
    const [activeTagFilter, setActiveTagFilter] = useState('All');
    // To optionally show which project a photo belongs to
    const [projects, setProjects] = useState([]);

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
            setLoading(true);
            const allPhotos = await db.getAllPhotos();
            const allProjects = await db.getProjects();

            // Only keep marked up photos
            const markedUpPhotos = allPhotos.filter(p => p.IsMarkedUp === true);
            const sortedPhotos = sortPhotos(markedUpPhotos);

            setProjects(allProjects);
            setPhotos(sortedPhotos);
            setLoading(false);

            if (initialPhotoId) {
                const targetPhoto = sortedPhotos.find(p => p.PhotoID === initialPhotoId);
                if (targetPhoto) {
                    setSelectedPhoto(targetPhoto);
                }
            }
        };
        fetchData();
    }, [sortOrder, initialPhotoId]);

    const getProjectName = (projectId) => {
        const p = projects.find(proj => proj.ProjectID === projectId);
        return p ? p.ProjectName : 'Unknown Project';
    };

    if (loading) return <div className="content-pad">Loading photos...</div>;

    const uniqueTags = Array.from(new Set(photos.flatMap(p => p.Tags || []))).sort();
    const displayedPhotos = photos.filter(p => activeTagFilter === 'All' ? true : (p.Tags && p.Tags.includes(activeTagFilter)));

    return (
        <div className="project-detail-view" style={{ paddingBottom: '160px' }}>
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
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>My Markups</h2>
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
                        <p>No marked-up photos yet.</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Photos that you draw on will appear here.</p>
                    </div>
                ) : (
                    <>
                        {/* Tag Filters */}
                        {uniqueTags.length > 0 && (
                            <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '1rem', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                                <div
                                    onClick={() => setActiveTagFilter('All')}
                                    style={{
                                        padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                        backgroundColor: activeTagFilter === 'All' ? 'var(--text-primary)' : 'var(--background)',
                                        color: activeTagFilter === 'All' ? 'var(--background)' : 'var(--text-secondary)',
                                        border: activeTagFilter === 'All' ? '1px solid var(--text-primary)' : '1px solid var(--border)'
                                    }}
                                >
                                    All Markups
                                </div>
                                {uniqueTags.map(tag => (
                                    <div
                                        key={tag}
                                        onClick={() => setActiveTagFilter(tag)}
                                        style={{
                                            padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                            backgroundColor: activeTagFilter === tag ? 'var(--primary-color)' : 'var(--background)',
                                            color: activeTagFilter === tag ? 'white' : 'var(--text-secondary)',
                                            border: activeTagFilter === tag ? '1px solid var(--primary-color)' : '1px solid var(--border)'
                                        }}
                                    >
                                        #{tag}
                                    </div>
                                ))}
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
                                        alt="Project Markup"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    {/* Project Name Badge */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '6px', left: '6px',
                                        background: '#000000',
                                        color: 'white',
                                        fontSize: '0.65rem',
                                        fontWeight: '500',
                                        padding: '3px 6px',
                                        borderRadius: '12px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: 'calc(100% - 12px)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        {getProjectName(photo.ProjectID)}
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
                        onClose={() => setSelectedPhoto(null)}
                        onAnnotate={(photo) => {
                            setSelectedPhoto(null);
                            navigateTo('MARKUP', photo.ProjectID, photo.ImageFile, photo.PhotoID);
                        }}
                        onUpdateNotes={async (photoId, newNotes, newTags) => {
                            await db.updatePhotoDetails(photoId, newNotes, newTags);
                            const newPhotos = await db.getAllPhotos();
                            const markedUpPhotos = newPhotos.filter(p => p.IsMarkedUp === true);
                            setPhotos(sortPhotos(markedUpPhotos));
                            if (selectedPhoto.PhotoID === photoId) {
                                setSelectedPhoto(newPhotos.find(p => p.PhotoID === photoId));
                            }
                        }}
                        onDelete={async (photoId) => {
                            await db.deletePhoto(photoId);
                            const newPhotos = await db.getAllPhotos();
                            const markedUpPhotos = newPhotos.filter(p => p.IsMarkedUp === true);
                            const sorted = sortPhotos(markedUpPhotos);
                            setPhotos(sorted);
                            if (sorted.length === 0) setSelectedPhoto(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default MyMarkupsView;
