import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera as CameraIcon } from 'lucide-react';
import * as db from '../db';
import LoadingSpinner from './LoadingSpinner';

const CameraView = ({ projectId, currentFolderId, navigateTo, returnView = 'HOME' }) => {
    const hasRequested = useRef(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (hasRequested.current) return;
        hasRequested.current = true;

        const captureNativePhoto = async () => {
            try {
                // Pre-check permissions
                try {
                    await Camera.requestPermissions();
                } catch (permErr) {
                    console.log('OS permission flow handled:', permErr);
                }

                // Invoke Native Apple Camera UI Bypass
                const image = await Camera.getPhoto({
                    quality: 80,
                    allowEditing: false,
                    resultType: CameraResultType.DataUrl,
                    source: CameraSource.Camera,
                    width: 1536 // Balanced for high DPI markup without causing 15s base64 encoding blocks
                });

                if (image && image.dataUrl) {
                    // Convert dataUrl to a File object for unified processing
                    const res = await fetch(image.dataUrl);
                    const blob = await res.blob();
                    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    
                    await db.processAndAddPhoto(file, projectId, currentFolderId, "camera");
                    navigateTo('PROJECT_DETAIL', projectId);
                } else {
                    navigateTo(returnView, projectId);
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
        setTimeout(captureNativePhoto, 300);
    }, [projectId, navigateTo]);

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
