import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, MessageSquare, PenTool, Download, ChevronLeft, Pencil } from 'lucide-react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import TagSelector from './TagSelector';

const ZoomableSlide = ({ photo, index, swiperRef }) => {
    const [scale, setScale] = useState(1);

    return (
        <TransformWrapper
            minScale={1}
            maxScale={5}
            initialScale={1}
            doubleClick={{ mode: "toggle", step: 4 }}
            panning={{ disabled: scale <= 1 }}
            onTransformed={(ref) => {
                setScale(ref.state.scale);
                if (swiperRef && ref.state.scale > 1) {
                    swiperRef.allowTouchMove = false;
                } else if (swiperRef) {
                    swiperRef.allowTouchMove = true;
                }
            }}
        >
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                    src={photo.ImageFile}
                    alt={`Project Photo ${index + 1}`}
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
            </TransformComponent>
        </TransformWrapper>
    );
};

const PhotoViewer = ({ photos, initialIndex, onClose, onAnnotate, onUpdateNotes, onDelete, disableAnimation = false, getFolderName }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
    const [showUI, setShowUI] = useState(true);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesText, setNotesText] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    // Swiper ref for manual navigation
    const [swiperRef, setSwiperRef] = useState(null);

    const currentPhoto = photos[currentIndex];

    // Sync notes text when changing photos
    useEffect(() => {
        setNotesText(currentPhoto?.Notes || '');
        setSelectedTags(currentPhoto?.Tags || []);
        setIsEditingNotes(false);
    }, [currentIndex, currentPhoto]);

    if (!currentPhoto) return null;

    const handleNext = (e) => {
        if (e) e.stopPropagation();
        swiperRef?.slideNext();
    };

    const handlePrev = (e) => {
        if (e) e.stopPropagation();
        swiperRef?.slidePrev();
    };

    const toggleUI = () => {
        if (!isEditingNotes) {
            setShowUI(!showUI);
        }
    };

    const saveNotes = async () => {
        setIsSaving(true);
        await onUpdateNotes(currentPhoto.PhotoID, notesText, selectedTags);
        setIsSaving(false);
        setIsEditingNotes(false);
    };



    const handleDelete = () => {
        setShowDeleteModal(true);
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            if (Capacitor.isNativePlatform()) {
                const isDataUrl = currentPhoto.ImageFile.startsWith('data:');
                let savedFileUri;

                if (isDataUrl) {
                    const base64Data = currentPhoto.ImageFile.split(',')[1];
                    const fileName = `photo_${Date.now()}.jpg`;
                    const savedFile = await Filesystem.writeFile({
                        path: fileName,
                        data: base64Data,
                        directory: Directory.Cache
                    });
                    savedFileUri = savedFile.uri;
                } else {
                    const fileName = `photo_${Date.now()}.jpg`;
                    const response = await fetch(currentPhoto.ImageFile);
                    if (!response.ok) throw new Error("Could not download photo from cloud.");
                    const blob = await response.blob();
                    const base64Data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    const savedFile = await Filesystem.writeFile({
                        path: fileName,
                        data: base64Data,
                        directory: Directory.Cache
                    });
                    savedFileUri = savedFile.uri;
                    if (!savedFileUri.startsWith('file://')) {
                        savedFileUri = 'file://' + savedFileUri;
                    }
                }

                await Media.savePhoto({ path: savedFileUri });
                alert("Saved!");
            } else {
                // Web fallback
                try {
                    const response = await fetch(currentPhoto.ImageFile);
                    if (!response.ok) throw new Error("Fetch failed");
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `photo_${Date.now()}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    alert("Photo downloaded!");
                } catch (webErr) {
                    // Fallback if CORS blocks the fetch (common on Firebase Storage Web client)
                    console.log("CORS blocked fetch, falling back to direct link", webErr);
                    const a = document.createElement('a');
                    a.href = currentPhoto.ImageFile;
                    a.target = '_blank';
                    a.download = `photo_${Date.now()}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            }
        } catch (err) {
            console.error("Error saving photo:", err);
            alert("Failed to save photo: " + (err?.message || err?.toString() || "Unknown error"));
        } finally {
            setIsDownloading(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <motion.div
            initial={disableAnimation ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.45 }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#000',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                touchAction: 'none',
                willChange: 'transform'
            }}
        >
            {/* Header Controls */}
            <header style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 100, // Boosted to stay above Swiper
                paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
                paddingBottom: '2rem',
                paddingLeft: '0.75rem',
                paddingRight: '1rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
                opacity: showUI ? 1 : 0,
                transition: 'opacity 0.25s ease',
                pointerEvents: showUI ? 'auto' : 'none',
            }}>
                <button
                    onClick={handleClose}
                    style={{
                        position: 'absolute',
                        left: '0.75rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '0.5rem 0.25rem',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        fontWeight: '500',
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                    }}
                >
                    <ChevronLeft size={28} strokeWidth={2.5} />
                </button>
                <button
                    onClick={() => onAnnotate(currentPhoto)}
                    style={{
                        position: 'absolute',
                        right: '1rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                    }}
                >
                    <Pencil size={20} />
                </button>
                <div style={{ textAlign: 'center', backdropFilter: 'blur(5px)', padding: '0.2rem 0.5rem', borderRadius: '5px' }}>
                    {currentPhoto.Timestamp ? (
                        <>
                            <div style={{ color: 'white', fontWeight: '600', fontSize: '0.95rem', lineHeight: 1.2 }}>
                                {(() => {
                                    const photoDate = new Date(currentPhoto.Timestamp);
                                    const now = new Date();
                                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                    const yesterdayStart = new Date(todayStart);
                                    yesterdayStart.setDate(todayStart.getDate() - 1);
                                    const daysDiff = (now.getTime() - photoDate.getTime()) / (1000 * 60 * 60 * 24);
                                    if (photoDate >= todayStart) {
                                        return 'Today';
                                    } else if (photoDate >= yesterdayStart) {
                                        return 'Yesterday';
                                    } else if (daysDiff < 7) {
                                        return photoDate.toLocaleDateString('en-US', { weekday: 'long' });
                                    } else {
                                        const isDifferentYear = photoDate.getFullYear() !== now.getFullYear();
                                        return photoDate.toLocaleDateString('en-US', {
                                            month: 'long',
                                            day: 'numeric',
                                            ...(isDifferentYear ? { year: 'numeric' } : {})
                                        });
                                    }
                                })()}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span>{new Date(currentPhoto.Timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                {currentPhoto.EditedAt && (() => {
                                    const editDate = new Date(currentPhoto.EditedAt);
                                    const now = new Date();
                                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                    const yesterdayStart = new Date(todayStart);
                                    yesterdayStart.setDate(todayStart.getDate() - 1);
                                    let dateLabel;
                                    if (editDate >= todayStart) dateLabel = 'Today';
                                    else if (editDate >= yesterdayStart) dateLabel = 'Yesterday';
                                    else dateLabel = editDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    return (
                                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                                            Edited {dateLabel} at {editDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                        </span>
                                    );
                                })()}
                            </div>
                        </>
                    ) : (
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                            {currentPhoto.EditedAt ? (
                                <span>Edited {new Date(currentPhoto.EditedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            ) : (
                                "No date"
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Image Container using Swiper.js */}
            <div
                onClick={toggleUI}
                style={{
                    position: 'absolute',
                    top: isEditingNotes ? '60px' : '140px',
                    left: 0,
                    right: 0,
                    bottom: isEditingNotes ? '260px' : '180px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'top 0.3s ease, bottom 0.3s ease',
                }}
            >
                {/* Desktop Prev Button */}
                {currentIndex > 0 && showUI && (
                    <button
                        onClick={handlePrev}
                        style={{ position: 'absolute', left: '1rem', zIndex: 5, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer' }}>
                        &lt;
                    </button>
                )}

                <Swiper
                    modules={[]} // Removed Zoom module
                    initialSlide={initialIndex}
                    onSwiper={setSwiperRef}
                    onSlideChange={(swiper) => setCurrentIndex(swiper.activeIndex)}
                    style={{ width: '100%', height: '100%', '--swiper-theme-color': '#fff' }}
                >
                    {photos.map((photo, index) => (
                        <SwiperSlide key={photo.PhotoID}>
                            <ZoomableSlide photo={photo} index={index} swiperRef={swiperRef} />
                        </SwiperSlide>
                    ))}
                </Swiper>

                {currentIndex < photos.length - 1 && showUI && (
                    <button
                        onClick={handleNext}
                        style={{ position: 'absolute', right: '1rem', zIndex: 5, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.2rem', cursor: 'pointer' }}>
                        &gt;
                    </button>
                )}
            </div>

            {/* Metadata overlay - in the black space below the photo */}
            {showUI && (currentPhoto.FolderID || (currentPhoto.Tags && currentPhoto.Tags.length > 0) || currentPhoto.Notes) && (
                <div style={{
                    position: 'absolute',
                    bottom: '120px',
                    left: 0,
                    right: 0,
                    zIndex: 49,
                    padding: '0.5rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem',
                    opacity: showUI ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: 'none',
                }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.35rem' }}>
                        {currentPhoto.FolderID && getFolderName && getFolderName(currentPhoto.FolderID) && (
                            <span style={{ backgroundColor: '#0ea5e9', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                {getFolderName(currentPhoto.FolderID)}
                            </span>
                        )}
                        {currentPhoto.Tags && currentPhoto.Tags.map(tag => (
                            <span key={tag} style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                #{tag}
                            </span>
                        ))}
                    </div>
                    {currentPhoto.Notes && (
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{currentPhoto.Notes}</p>
                    )}
                </div>
            )}

            {/* Bottom Action Bar */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                maxHeight: isEditingNotes ? '80%' : '45%',
                overflowY: isEditingNotes ? 'visible' : 'auto',
                backgroundColor: 'rgba(20, 20, 20, 0.85)',
                color: 'var(--text-primary)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                transform: showUI ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.25s ease',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {isEditingNotes ? (
                    <div style={{ padding: '1rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <TagSelector selectedTags={selectedTags} onTagsChange={setSelectedTags} />
                        </div>
                        <textarea
                            value={notesText}
                            onChange={e => setNotesText(e.target.value)}
                            placeholder="Add a comment or note..."
                            autoFocus
                            style={{
                                width: '100%',
                                height: '80px',
                                backgroundColor: 'var(--background)',
                                color: 'white',
                                border: '1px solid var(--primary-color)',
                                borderRadius: '8px',
                                padding: '0.8rem',
                                marginBottom: '1rem',
                                fontFamily: 'inherit',
                                fontSize: '1rem' // Prevents iOS auto-zoom and improves readability
                            }}
                        />
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setIsEditingNotes(false)} disabled={isSaving}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveNotes} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Details'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0.5rem 1rem' }}>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1, padding: '0.3rem 0.75rem' }}
                        >
                            <Trash2 size={22} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Delete</span>
                        </button>
                        <button
                            onClick={() => setIsEditingNotes(true)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', padding: '0.3rem 0.75rem' }}
                        >
                            <MessageSquare size={22} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>Add Note</span>
                        </button>
                        {currentPhoto.Source !== 'gallery' && (
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', opacity: isDownloading ? 0.5 : 1, padding: '0.3rem 0.75rem' }}
                            >
                                <Download size={22} />
                                <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>{isDownloading ? 'Saving...' : 'Save'}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="modal-overlay" style={{ zIndex: 3000, alignItems: 'center', padding: '1.5rem' }}>
                    <div className="modal-content" style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '24px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem auto',
                            color: '#ef4444'
                        }}>
                            <Trash2 size={24} />
                        </div>
                        <h3 style={{ marginBottom: '0.5rem' }}>Delete Photo</h3>
                        <p style={{ marginBottom: '1.5rem' }}>Are you sure you want to delete this photo forever? This action cannot be undone.</p>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                className="btn"
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none' }}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default PhotoViewer;
