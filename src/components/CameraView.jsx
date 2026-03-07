import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera as CameraIcon } from 'lucide-react';

const CameraView = ({ projectId, navigateTo, returnView = 'HOME' }) => {
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
                    navigateTo('MARKUP', projectId, image.dataUrl);
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
        <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'var(--background)', zIndex: 1000,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '2rem', textAlign: 'center'
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
                <>
                    <CameraIcon size={48} color="var(--primary-color)" style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                    <h2 style={{ marginBottom: '1rem' }}>Linking to Local Camera...</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Waiting for secure Apple Sandbox bridge.</p>
                </>
            )}
        </motion.div>
    );
};

export default CameraView;
