import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import * as db from '../db';
import { PenTool, Undo2, Eraser, MessageSquare, Edit2 } from 'lucide-react';

const MarkupView = ({ projectId, photoUrl, editingPhotoId, navigateTo }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const { currentUser } = useApp();

    const [notes, setNotes] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [isDrawMode, setIsDrawMode] = useState(false); // Controls if the canvas is active for drawing
    const [color, setColor] = useState('#ef4444'); // Default red
    const [isSaving, setIsSaving] = useState(false);
    const [history, setHistory] = useState([]);
    const [showNoteModal, setShowNoteModal] = useState(false);

    // If editing an existing photo, fetch its notes
    useEffect(() => {
        if (editingPhotoId) {
            const fetchExistingNotes = async () => {
                const projPhotos = await db.getPhotosForProject(projectId);
                const existingPhoto = projPhotos.find(p => p.PhotoID === editingPhotoId);
                if (existingPhoto && existingPhoto.Notes) {
                    setNotes(existingPhoto.Notes);
                }
            };
            fetchExistingNotes();
        }
    }, [editingPhotoId, projectId]);

    // Load the captured image onto the canvas
    useEffect(() => {
        if (!photoUrl || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            // Internal high-res resolution maps to the image
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Setup drawing style
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            // Scale linewidth based on image size so drawing remains visible at high resolutions
            ctx.lineWidth = Math.max(4, canvas.width * 0.012);

            // Save initial state to history stack
            setHistory([canvas.toDataURL('image/jpeg', 1.0)]);
        };
        img.src = photoUrl;
    }, [photoUrl]);

    // Handle pointer interactions for drawing lines
    const startDrawing = (e) => {
        if (!isDrawMode) return;
        const { offsetX, offsetY } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        ctx.strokeStyle = color;
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing || !isDrawMode) return;
        e.preventDefault(); // Prevent scrolling on touch
        const { offsetX, offsetY } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.closePath();
            setIsDrawing(false);

            // Save state after stroke finishes
            setHistory(prev => [...prev, canvasRef.current.toDataURL('image/jpeg', 1.0)]);
        }
    };

    const handleUndo = () => {
        if (history.length <= 1) return; // Need at least the base image

        const newHistory = [...history];
        newHistory.pop(); // Remove current state

        const previousState = newHistory[newHistory.length - 1];
        setHistory(newHistory);

        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // Re-apply styles
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(4, canvas.width * 0.012);
        };
        img.src = previousState;
    };

    const handleClear = () => {
        if (history.length <= 1) return; // Already cleared

        const baseImage = history[0];
        setHistory([baseImage]);

        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // Re-apply styles
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = Math.max(4, canvas.width * 0.012);
        };
        img.src = baseImage;
    };

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Calculate scaling factor between CSS size and actual canvas resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.nativeEvent.clientX || e.clientX;
            clientY = e.nativeEvent.clientY || e.clientY;
        }

        return {
            offsetX: (clientX - rect.left) * scaleX,
            offsetY: (clientY - rect.top) * scaleY
        };
    };

    const handleRetake = () => {
        navigateTo('CAMERA', projectId);
    };

    const handleSave = async () => {
        setIsSaving(true);

        // Extract canvas content including the drawn lines
        const modifiedPhotoUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);

        if (editingPhotoId) {
            // Overwrite existing photo
            await db.updatePhoto(editingPhotoId, modifiedPhotoUrl, notes);
        } else {
            // Create brand new photo
            const newPhoto = {
                PhotoID: `photo-${Date.now()}`,
                ProjectID: projectId,
                ImageFile: modifiedPhotoUrl,
                Timestamp: new Date().toISOString(),
                UploaderID: currentUser.UserID,
                Notes: notes
            };
            await db.addPhoto(newPhoto);
        }

        setIsSaving(false);

        // Return to the project detail view
        navigateTo('PROJECT_DETAIL', projectId);
    };

    return (
        <div className="markup-view" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100dvh', // Use dynamic viewport height to fix mobile browser chrome issues
            backgroundColor: 'var(--background)'
        }}>
            <header className="header" style={{ justifyContent: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Markup Photo</h2>
            </header>

            {/* Compact Toolbar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                minHeight: '50px'
            }}>
                {/* Left: Tools */}
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <button
                        onClick={() => setIsDrawMode(!isDrawMode)}
                        style={{
                            background: isDrawMode ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                            border: isDrawMode ? '1px solid #ef4444' : '1px solid var(--border)',
                            color: isDrawMode ? '#ef4444' : 'var(--text-primary)',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            padding: '0.4rem 0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.9rem',
                            fontWeight: isDrawMode ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}
                    >
                        <PenTool size={18} /><span style={{ fontSize: '0.85rem' }}>Draw</span>
                    </button>

                    {/* Colors (only show if Draw mode is active to save space) */}
                    {isDrawMode && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem', animation: 'fadeIn 0.2s' }}>
                            {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#ffffff'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '11px',
                                        backgroundColor: c,
                                        border: color === c ? '2px solid var(--text-primary)' : '1px solid transparent',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                        transition: 'transform 0.1s'
                                    }}
                                    aria-label={`Select color ${c}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: History Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={handleUndo}
                        disabled={history.length <= 1}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: history.length <= 1 ? 'var(--border)' : 'var(--text-primary)',
                            cursor: history.length <= 1 ? 'default' : 'pointer',
                            fontSize: '1.2rem',
                            padding: '0.2rem'
                        }}
                        aria-label="Undo"
                    >
                        <Undo2 size={20} />
                    </button>
                    <button
                        onClick={handleClear}
                        disabled={history.length <= 1}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: history.length <= 1 ? 'var(--border)' : 'var(--text-primary)',
                            cursor: history.length <= 1 ? 'default' : 'pointer',
                            fontSize: '1.2rem',
                            padding: '0.2rem'
                        }}
                        aria-label="Clear all"
                    >
                        <Eraser size={20} />
                    </button>
                </div>
            </div>

            {/* Canvas container */}
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    backgroundColor: '#000',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    flex: 1,
                    minHeight: 0
                }}
            >
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                        cursor: 'crosshair',
                        touchAction: 'none',
                        maxWidth: '100%',
                        maxHeight: '100%'
                    }}
                />
            </div>

            {/* Base UI Actions */}
            <div style={{ flex: 'none', display: 'flex', gap: '0.5rem', padding: '1rem 1rem max(1rem, env(safe-area-inset-bottom))', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                <button
                    className="btn"
                    onClick={() => navigateTo('PROJECT_DETAIL', projectId)}
                    style={{ flex: 1, padding: '0.8rem 0.5rem', fontSize: '0.9rem' }}
                >
                    Cancel
                </button>
                {!editingPhotoId && (
                    <button
                        className="btn"
                        onClick={handleRetake}
                        style={{ flex: 1, padding: '0.8rem 0.5rem', fontSize: '0.9rem' }}
                    >
                        Retake
                    </button>
                )}
                <button
                    className="btn"
                    onClick={() => setShowNoteModal(true)}
                    style={{ flex: 1, padding: '0.8rem 0.5rem', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
                >
                    {notes ? <><Edit2 size={16} /> Edit</> : <><MessageSquare size={16} /> Note</>}
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ flex: 1.5, padding: '0.8rem 0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}
                >
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {/* Notes Modal Overlay */}
            {showNoteModal && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        backgroundColor: 'var(--surface)', width: '100%', maxWidth: '400px',
                        borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Project Notes</h3>
                        <textarea
                            autoFocus
                            placeholder="Append notes (e.g., 'Network rack rough-in complete')"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            style={{
                                width: '100%', height: '120px', backgroundColor: 'var(--background)',
                                color: 'var(--text-primary)', border: '1px solid var(--primary-color)',
                                borderRadius: '8px', padding: '1rem', fontFamily: 'inherit',
                                fontSize: '1rem', resize: 'none', marginBottom: '1.5rem'
                            }}
                        />
                        <button className="btn btn-primary" onClick={() => setShowNoteModal(false)} style={{ padding: '0.8rem' }}>
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarkupView;
