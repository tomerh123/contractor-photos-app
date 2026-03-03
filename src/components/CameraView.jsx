import React, { useRef, useState, useEffect } from 'react';

const CameraView = ({ projectId, navigateTo }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [errorDetails, setErrorDetails] = useState('');
    const [flashOn, setFlashOn] = useState(false);
    const [supportsTorch, setSupportsTorch] = useState(false);

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

                // Check for flash (torch) support
                const track = mediaStream.getVideoTracks()[0];
                if (track) {
                    try {
                        const capabilities = track.getCapabilities();
                        if (capabilities.torch) {
                            setSupportsTorch(true);
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
                // The video feed is wider than 3:4 (e.g. landscape 4:3 or 16:9)
                // We need to crop the sides off to force 3:4 portrait
                cropWidth = videoHeight * targetAspect;
                cropX = (videoWidth - cropWidth) / 2;
            } else {
                // The video feed is taller than 3:4 (e.g. skinny 9:16 portrait)
                // We need to crop the top and bottom off to force 3:4 portrait
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
            <div
                style={{
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10
                }}
            >
                <button
                    onClick={cancelAndGoBack}
                    style={{
                        background: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.5rem 1rem',
                        backdropFilter: 'blur(5px)'
                    }}
                >
                    Cancel
                </button>
                {supportsTorch && (
                    <button
                        onClick={toggleFlash}
                        style={{
                            background: flashOn ? 'white' : 'rgba(0,0,0,0.5)',
                            color: flashOn ? 'black' : 'white',
                            border: 'none',
                            borderRadius: '20px',
                            padding: '0.5rem 1rem',
                            backdropFilter: 'blur(5px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {flashOn ? '⚡ Flash On' : '⚡ Flash Off'}
                    </button>
                )}
            </div>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            </div>

            <div style={{
                padding: '2rem',
                display: 'flex',
                justifyContent: 'center',
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0
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
                    <div style={{ width: '60px', height: '60px', borderRadius: '30px', backgroundColor: 'white' }}></div>
                </button>
            </div>
        </div>
    );
};

export default CameraView;
