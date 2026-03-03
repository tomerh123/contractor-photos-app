import React, { useEffect, useState, useRef } from 'react';
import * as db from '../db';
import PhotoViewer from './PhotoViewer';
import { ArrowLeft, Camera, Upload, Sparkles, MapPin, Share2, ImageIcon, CheckSquare } from 'lucide-react';
import LZString from 'lz-string';
import PunchListView from './PunchListView';

const ProjectDetail = ({ projectId, navigateTo }) => {
    const [activeTab, setActiveTab] = useState('GALLERY');
    const [project, setProject] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showCopyToast, setShowCopyToast] = useState(false);
    const fileInputRef = useRef(null);

    const formatLocation = (location) => {
        if (!location) return null;
        const parts = location.split(',');
        if (parts.length > 1) {
            const street = parts[0];
            const cityState = parts.slice(1).join(',').trim();
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{street},</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{cityState}</span>
                </div>
            );
        }
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <MapPin size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{location}</span>
            </div>
        );
    };

    const openPhotoViewer = (photo) => {
        setSelectedPhoto(photo);
    };

    const handleShare = () => {
        // Create a minimal payload of project data and photos to encode in the URL
        const payloadObj = {
            p: { n: project.ProjectName, l: project.Location },
            i: photos.map(photo => ({
                f: photo.ImageFile,
                n: photo.Notes,
                t: photo.Timestamp
            }))
        };

        // Compress the JSON string into a URI-safe base64 string
        const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payloadObj));
        const shareUrl = `${window.location.origin}/#share=${compressed}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            setShowCopyToast(true);
            setTimeout(() => setShowCopyToast(false), 3000);
        }).catch(err => {
            console.error('Failed to copy share link: ', err);
            alert("Share link: " + shareUrl);
        });
    };

    const handleImportPhoto = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsUploading(true);

        const readAndSavePhoto = (file) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1600; // Scaled down to ensure storage fallback limits aren't hit too quickly
                    const MAX_HEIGHT = 1600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = Math.round((height *= MAX_WIDTH / width));
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = Math.round((width *= MAX_HEIGHT / height));
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Output at quality 0.8 to balance zoom clarity with localStorage fallback limits
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

                    await db.addPhoto({
                        ProjectID: projectId,
                        ImageFile: compressedDataUrl,
                        Notes: ''
                    });

                    URL.revokeObjectURL(img.src);
                    resolve();
                };
                img.src = URL.createObjectURL(file);
            });
        };

        await Promise.all(files.map(file => readAndSavePhoto(file)));

        // Refresh gallery
        const projPhotos = await db.getPhotosForProject(projectId);
        setPhotos(projPhotos);
        setIsUploading(false);

        // Reset input so the same files can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const proj = await db.getProject(projectId);
            const projPhotos = await db.getPhotosForProject(projectId);
            setProject(proj);
            setPhotos(projPhotos);
            setLoading(false);
        };
        if (projectId) {
            fetchData();
        }
    }, [projectId]);

    if (loading) return <div className="content-pad">Loading project details...</div>;
    if (!project) return <div className="content-pad">Project not found.</div>;

    return (
        <div className="project-detail-view" style={{ paddingBottom: '110px' }}>
            {/* Hidden File Input for Camera Roll Import */}
            <input
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImportPhoto}
            />

            <header className="header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '64px' }}>
                <button className="btn" onClick={() => navigateTo('HOME')} style={{ position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)', padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ textAlign: 'center', overflow: 'hidden', padding: '0 50px', width: '100%' }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {project.ProjectName}
                    </h2>
                </div>
                <button
                    className="btn"
                    onClick={handleShare}
                    style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Copy Share Link"
                >
                    <Share2 size={20} />
                </button>
            </header>

            {/* Copy Link Toast Notification */}
            {showCopyToast && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 9999,
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <Share2 size={16} /> Client Share Link Copied!
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
                <button
                    onClick={() => setActiveTab('GALLERY')}
                    style={{
                        flex: 1,
                        padding: '1rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'GALLERY' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        color: activeTab === 'GALLERY' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    <ImageIcon size={18} /> Gallery
                </button>
                <button
                    onClick={() => setActiveTab('PUNCHLIST')}
                    style={{
                        flex: 1,
                        padding: '1rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'PUNCHLIST' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        color: activeTab === 'PUNCHLIST' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    <CheckSquare size={18} /> Punch List
                </button>
            </div>

            <div className="content-pad">
                {/* Project Location Header Context */}
                {project.Location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                        <MapPin size={16} />
                        <span>{project.Location}</span>
                    </div>
                )}

                {activeTab === 'GALLERY' && (
                    <>
                        <h3 style={{ marginBottom: '1rem' }}>Photo Gallery</h3>

                        {isUploading && (
                            <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-color)', borderRadius: '12px', marginBottom: '1rem' }}>
                                Importing photo...
                            </div>
                        )}

                        {photos.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                <p>No photos yet.</p>
                                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Tap the camera icon to take the first photo, or the upload icon to import.</p>
                            </div>
                        ) : (
                            <div className="photo-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '4px'
                            }}>
                                {photos.map(photo => (
                                    <div
                                        key={photo.PhotoID}
                                        className="photo-card"
                                        onClick={() => openPhotoViewer(photo)}
                                        style={{
                                            overflow: 'hidden',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--surface)',
                                            cursor: 'pointer',
                                            position: 'relative'
                                        }}
                                    >
                                        <img
                                            src={photo.ImageFile}
                                            alt="Project thumbnail"
                                            style={{
                                                width: '100%',
                                                aspectRatio: '1 / 1', // Perfect square tiles
                                                objectFit: 'cover', // Fill the square
                                                display: 'block',
                                                transition: 'transform 0.2s'
                                            }}
                                        />
                                        {photo.Notes && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                padding: '4px',
                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                color: 'white',
                                                fontSize: '0.65rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                📝 {photo.Notes}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'PUNCHLIST' && (
                    <PunchListView projectId={projectId} />
                )}
            </div>

            {/* Floating Action Dock (Sleek pill replacing the old round FAB) */}
            <div className="floating-dock">
                <button className="dock-btn" onClick={() => navigateTo('HOME')}><ArrowLeft size={24} /></button>
                <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)' }}></div>
                <button className="dock-btn main" onClick={() => navigateTo('CAMERA', projectId)}><Camera size={26} /></button>
                <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)' }}></div>
                <button className="dock-btn" onClick={() => fileInputRef.current?.click()}><Upload size={22} /></button>
            </div>

            {/* Advanced Photo Viewer */}
            {selectedPhoto && (
                <PhotoViewer
                    photos={photos}
                    initialIndex={photos.findIndex(p => p.PhotoID === selectedPhoto.PhotoID)}
                    onClose={() => setSelectedPhoto(null)}
                    onAnnotate={(photo) => {
                        setSelectedPhoto(null); // Close viewer
                        // Pass the photo ID as the 4th argument so MarkupView knows it's an edit
                        navigateTo('MARKUP', projectId, photo.ImageFile, photo.PhotoID);
                    }}
                    onUpdateNotes={async (photoId, newNotes) => {
                        await db.updatePhotoNotes(photoId, newNotes);
                        // Refresh the photo list so the gallery and viewer update
                        const projPhotos = await db.getPhotosForProject(projectId);
                        setPhotos(projPhotos);
                        if (selectedPhoto.PhotoID === photoId) {
                            setSelectedPhoto(projPhotos.find(p => p.PhotoID === photoId));
                        }
                    }}
                    onDelete={async (photoId) => {
                        await db.deletePhoto(photoId);
                        const projPhotos = await db.getPhotosForProject(projectId);
                        setPhotos(projPhotos);
                        if (projPhotos.length === 0) {
                            setSelectedPhoto(null); // Close viewer if no photos left
                        }
                    }}
                />
            )}
        </div>
    );
};

export default ProjectDetail;
