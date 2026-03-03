import React, { useRef, useState, useEffect } from 'react';
import { Zap, ZapOff } from 'lucide-react';

const CameraView = ({ projectId, navigateTo }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [errorDetails, setErrorDetails] = useState('');
    const [flashOn, setFlashOn] = useState(false);
    const [supportsTorch, setSupportsTorch] = useState(false);

    // Zoom state
    const [zoom, setZoom] = useState(1);
    const [zoomCapabilities, setZoomCapabilities] = useState({ min: 1, max: 1 });
    const initialPinchDistanceRef = useRef(null);
    const initialZoomRef = useRef(null);

    // Start the camera
    useEffect(() => {
        let activeStream = null;

        const startCamera = async () => {
            try {
                let mediaStream;
                try {
                    // Try exact rear camera first (critical for mobile) with 4:3 aspect ratio (native iOS)
                    mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: { exact: 'environment' },
                            // iPhones take 4:3 photos natively (e.g. 4032 x 3024 at 12MP)
                            aspectRatio: { ideal: 4 / 3 },
                            width: { ideal: 4032, min: 1280 },
                            height: { ideal: 3024, min: 960 }
                        },
                        audio: false
                    });
                } catch (e) {
                    // Fallback to any camera for desktop web browsers testing (also requesting high res 4:3)
                    mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            aspectRatio: { ideal: 4 / 3 },
                            width: { ideal: 1920 },
                            height: { ideal: 1440 }
                        },
                        audio: false
                    });
                }

                activeStream = mediaStream;
                setStream(mediaStream);

                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }

                // Check for flash (torch) and zoom support
                const track = mediaStream.getVideoTracks()[0];
                if (track) {
                    try {
                        const capabilities = track.getCapabilities();
                        if (capabilities.torch) {
                            setSupportsTorch(true);
                        }
                        if (capabilities.zoom) {
                            setZoomCapabilities({ min: capabilities.zoom.min, max: capabilities.zoom.max });
                            setZoom(track.getSettings().zoom || 1);
                        }
                    } catch (e) { }
                }
            } catch (error) {
                console.error("Error accessing camera:", error);
                setErrorDetails("Could not access camera. Please ensure you have granted camera permissions.");
            }
        };

        startCamera();

        // Cleanup function to stop the camera stream when component unmounts
        return () => {
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const toggleFlash = async () => {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        if (track && supportsTorch) {
            try {
                await track.applyConstraints({
                    advanced: [{ torch: !flashOn }]
                });
                setFlashOn(!flashOn);
            } catch (e) {
                console.error('Error toggling flash:', e);
            }
        }
    };

    // Zoom handlers
    const handleTouchStart = (e) => {
        if (e.touches.length === 2 && zoomCapabilities.max > 1) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            initialPinchDistanceRef.current = dist;
            initialZoomRef.current = zoom;
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && initialPinchDistanceRef.current && zoomCapabilities.max > 1) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

            const scale = dist / initialPinchDistanceRef.current;
            let newZoom = initialZoomRef.current * scale;
            newZoom = Math.max(zoomCapabilities.min, Math.min(newZoom, zoomCapabilities.max));

            if (Math.abs(newZoom - zoom) > 0.05) {
                setZoom(newZoom);
                const track = stream.getVideoTracks()[0];
                if (track) {
                    track.applyConstraints({
                        advanced: [{ zoom: newZoom }]
                    }).catch(e => console.warn('Zoom not supported on this track', e));
                }
            }
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Video source dimensions (what the browser actually gave us)
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            // We want to force a classic 4:3 aspect ratio (or 3:4 in portrait)
            // just like the native iOS camera, safely cutting out the rest.
            const targetAspect = 3 / 4; // Portrait assumption for mobile app
            const currentAspect = videoWidth / videoHeight;

            let cropWidth = videoWidth;
            let cropHeight = videoHeight;
            let cropX = 0;
            let cropY = 0;

            if (currentAspect > targetAspect) {
                cropWidth = videoHeight * targetAspect;
                cropX = (videoWidth - cropWidth) / 2;
            } else {
                cropHeight = videoWidth / targetAspect;
                cropY = (videoHeight - cropHeight) / 2;
            }

            // Output the perfectly center-cropped 3:4 image
            canvas.width = cropWidth;
            canvas.height = cropHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // Stop the stream tracks before navigating away
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            // Convert canvas to Data URI with maximum quality for zoom sharpness
            const dataUri = canvas.toDataURL('image/jpeg', 1.0);

            // Route output to Markup View
            navigateTo('MARKUP', projectId, dataUri);
        }
    };

    const cancelAndGoBack = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        navigateTo('PROJECT_DETAIL', projectId);
    };

    return (
        <div className="camera-view" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Top Toolbar */}
            <div
                style={{
                    padding: 'max(1.5rem, env(safe-area-inset-top)) 1.5rem 1rem 1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)'
                }}
            >
                <button
                    onClick={cancelAndGoBack}
                    style={{
                        background: 'transparent',
                        color: 'white',
                        border: 'none',
                        fontSize: '1.1rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        padding: '0.5rem 0',
                        textShadow: '0 1px 4px rgba(0,0,0,0.5)'
                    }}
                >
                    Cancel
                </button>
                {supportsTorch && (
                    <button
                        onClick={toggleFlash}
                        style={{
                            background: flashOn ? '#ffcc00' : 'transparent',
                            color: flashOn ? 'black' : 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: flashOn ? '0 0 10px rgba(255, 204, 0, 0.5)' : 'none'
                        }}
                        aria-label="Toggle Flash"
                    >
                        {flashOn ? <Zap size={20} fill="black" /> : <ZapOff size={20} />}
                    </button>
                )}
            </div>

            <div
                style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                {errorDetails ? (
                    <div style={{ color: 'white', padding: '2rem', textAlign: 'center' }}>
                        <p>{errorDetails}</p>
                        <button className="btn btn-primary" onClick={cancelAndGoBack} style={{ marginTop: '1rem' }}>Go Back</button>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain' // Show the full uncropped 4:3 sensor frame (will have black bars on tall screens)
                        }}
                    />
                )}
                {/* Hidden canvas for capturing the frame */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Optional Zoom Indicator (shows briefly when zooming) */}
                {zoomCapabilities.max > 1 && zoom > 1.05 && (
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        color: '#ffcc00',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        pointerEvents: 'none'
                    }}>
                        {zoom.toFixed(1)}x
                    </div>
                )}
            </div>

            <div style={{
                padding: '2rem',
                display: 'flex',
                justifyContent: 'center',
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingBottom: 'max(2rem, env(safe-area-inset-bottom))'
            }}>
                <button
                    onClick={capturePhoto}
                    disabled={!!errorDetails}
                    style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '40px',
                        backgroundColor: 'transparent',
                        border: '4px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0
                    }}
                    aria-label="Capture button"
                >
                    <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: 'white' }}></div>
                </button>
            </div>
        </div>
    );
};

export default CameraView;
