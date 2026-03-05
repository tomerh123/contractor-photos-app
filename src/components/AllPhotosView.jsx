import React, { useEffect, useState } from 'react';
import * as db from '../db';
import PhotoViewer from './PhotoViewer';
import { ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';

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
    const [activeTagFilter, setActiveTagFilter] = useState('All');

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

    const uniqueTags = Array.from(new Set(photos.flatMap(p => p.Tags || []))).sort();
    const displayedPhotos = photos.filter(p => activeTagFilter === 'All' ? true : (p.Tags && p.Tags.includes(activeTagFilter)));

    return (
        <div className="project-detail-view" style={{ paddingBottom: '110px' }}>
            <header className="header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '64px' }}>
                <button className="btn" onClick={() => navigateTo('HOME')} style={{ position: 'absolute', left: '1.5rem', padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ textAlign: 'center', overflow: 'hidden', padding: '0 50px', width: '100%' }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        All Photos
                    </h2>
                </div>
                <button
                    onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                    style={{
                        position: 'absolute',
                        right: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                    }}
                >
                    Newest
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
                                    All Photos
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
                                            background: 'rgba(0, 0, 0, 0.65)',
                                            color: 'white',
                                            fontSize: '0.65rem',
                                            fontWeight: '500',
                                            padding: '3px 6px',
                                            borderRadius: '12px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: '100%',
                                            backdropFilter: 'blur(4px)',
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
        </div>
    );
};

export default AllPhotosView;
