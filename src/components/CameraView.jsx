import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import * as db from '../db';
import LoadingSpinner from './LoadingSpinner';

const NativePhotoDeleter = Capacitor.registerPlugin('NativePhotoDeleter');

const CameraView = ({ projectId, currentFolderId, navigateTo, returnView = 'HOME' }) => {
    const hasRequested = useRef(false);
    const [error, setError] = useState(null);
    const webInputRef = useRef(null);

    useEffect(() => {
        if (hasRequested.current) return;
        hasRequested.current = true;

        const captureMedia = async () => {
            try {
                if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
                    // Invoke Unified Native iOS Camera
                    const result = await NativePhotoDeleter.captureMedia();

                    if (result && result.type) {
                        if (result.type === 'video') {
                            const safePath = result.path.startsWith('file://') ? result.path : `file://${result.path}`;
                            const webPath = Capacitor.convertFileSrc(safePath);
                            const response = await fetch(webPath);
                            const blob = await response.blob();

                            if (blob.size > 50 * 1024 * 1024) {
                                alert("The recorded video exceeds the 50MB limit and will be skipped!");
                                navigateTo(returnView, projectId);
                                return;
                            }

                            const fileName = `camera_video_${Date.now()}.mp4`;
                            const file = new File([blob], fileName, { type: 'video/mp4' });
                            
                            await db.processAndAddPhoto(file, projectId, currentFolderId, "camera", result.dataUrl);
                            navigateTo('PROJECT_DETAIL', projectId);
                        } else if (result.type === 'image') {
                            const res = await fetch(result.dataUrl);
                            const blob = await res.blob();
                            const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                            
                            await db.processAndAddPhoto(file, projectId, currentFolderId, "camera");
                            navigateTo('PROJECT_DETAIL', projectId);
                        }
                    } else {
                        navigateTo(returnView, projectId);
                    }
                } else {
                    // Web Fallback: Using an input allows the device to prompt for Photo or Video
                    if (webInputRef.current) {
                        webInputRef.current.click();
                    }
                }
            } catch (err) {
                console.error("Camera Error Payload:", err);
                if (err.message && err.message.includes('User cancelled')) {
                    navigateTo(returnView, projectId);
                } else {
                    setError("Could not launch the Native Apple Camera. Please ensure Hardware Camera permissions are granted in iOS Settings.");
                }
            }
        };

        // iOS requires a slight delay to ensure UI stack is ready before launching external view controllers
        setTimeout(captureMedia, 300);
    }, [projectId, navigateTo, currentFolderId, returnView]);

    const handleWebVideoCapture = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            navigateTo(returnView, projectId);
            return;
        }

        if (file.type.startsWith('video/') && file.size > 50 * 1024 * 1024) {
            alert("The recorded video exceeds the 50MB limit!");
            navigateTo(returnView, projectId);
            return;
        }

        try {
            await db.processAndAddPhoto(file, projectId, currentFolderId, "camera");
            navigateTo('PROJECT_DETAIL', projectId);
        } catch (err) {
            console.error("Web Capture Error:", err);
            setError("Failed to process web capture.");
        }
    };

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'var(--background)', zIndex: 1000,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '2rem', textAlign: 'center',
                willChange: 'transform'
            }}
        >
            <input 
                type="file" 
                accept="image/*,video/*" 
                capture="environment"
                ref={webInputRef}
                style={{ display: 'none' }}
                onChange={handleWebVideoCapture}
            />

            {error ? (
                <>
                    <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Hardware Stream Blocked</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
                    <button className="btn btn-primary" onClick={() => navigateTo(returnView, projectId)}>
                        Return
                    </button>
                    <button className="btn" onClick={() => {
                        hasRequested.current = false;
                        setError(null);
                    }} style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--primary-color)' }}>
                        Retry Camera Connection
                    </button>
                </>
            ) : (
                <LoadingSpinner message="Linking to Local Camera..." />
            )}
        </div>
    );
};

export default CameraView;
