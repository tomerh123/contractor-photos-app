import React, { useEffect, useState } from 'react';
import * as db from '../db';
import PhotoViewer from './PhotoViewer';
import { ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';

const AllPhotosView = ({ navigateTo, initialPhotoId }) => {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'
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

            setProjects(allProjects);
            const sortedPhotos = sortPhotos(allPhotos);
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
                    <div className="photo-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '2px', // Instagram style tight grid
                        margin: '0 -1.5rem' // Break out of container padding for edge-to-edge
                    }}>
                        {photos.map((photo, idx) => (
                            <div key={photo.PhotoID} className="aspect-square bg-gray-200 cursor-pointer overflow-hidden" onClick={() => openPhotoViewer(photo)} style={{ position: 'relative', aspectRatio: '1/1', backgroundColor: 'var(--surface)' }}>
                                <img
                                    src={photo.ImageFile}
                                    alt="Project"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                {/* Project Name Badge */}
                                <div style={{
                                    position: 'absolute',
                                    top: '6px', left: '6px',
                                    background: 'rgba(0,0,0,0.5)',
                                    color: 'white',
                                    fontSize: '0.65rem',
                                    fontWeight: '500',
                                    padding: '3px 6px',
                                    borderRadius: '12px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: 'calc(100% - 12px)',
                                    backdropFilter: 'blur(8px)',
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
                )}
            </div>

            {selectedPhoto && (
                <PhotoViewer
                    photos={photos}
                    initialIndex={photos.findIndex(p => p.PhotoID === selectedPhoto.PhotoID)}
                    onClose={() => setSelectedPhoto(null)}
                    onAnnotate={(photo) => {
                        setSelectedPhoto(null);
                        navigateTo('MARKUP', photo.ProjectID, photo.ImageFile, photo.PhotoID);
                    }}
                    onUpdateNotes={async (photoId, newNotes) => {
                        await db.updatePhotoNotes(photoId, newNotes);
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
