import React, { useEffect, useState } from 'react';
import LZString from 'lz-string';
import { Camera } from 'lucide-react';

const SharedProjectView = ({ payload }) => {
    const [project, setProject] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const parseSharedData = () => {
            setLoading(true);
            try {
                if (payload) {
                    const decompressed = LZString.decompressFromEncodedURIComponent(payload);
                    if (decompressed) {
                        const parsedData = JSON.parse(decompressed);

                        // Reconstruct project format
                        setProject({
                            ProjectName: parsedData.p.n || 'Unnamed Project',
                            Location: parsedData.p.l || ''
                        });

                        // Reconstruct photos format
                        if (parsedData.i && Array.isArray(parsedData.i)) {
                            const reconstructedPhotos = parsedData.i.map((item, index) => ({
                                PhotoID: `shared_photo_${index}`,
                                ImageFile: item.f,
                                Notes: item.n,
                                Timestamp: item.t
                            }));
                            setPhotos(reconstructedPhotos);
                        }
                    }
                }
            } catch (error) {
                console.error("Error parsing shared project payload:", error);
            }
            setLoading(false);
        };

        parseSharedData();
    }, [payload]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
                <p style={{ color: '#6b7280' }}>Loading project gallery...</p>
            </div>
        );
    }

    if (!project) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', flexDirection: 'column' }}>
                <Camera size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
                <h2 style={{ color: '#111827', margin: '0 0 0.5rem 0' }}>Project Not Found</h2>
                <p style={{ color: '#6b7280' }}>This shared link may have expired or is invalid.</p>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#ffffff', // Clean white background for client-facing view
            color: '#111827',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            {/* Clean, branded header */}
            <header style={{
                padding: '1.5rem',
                borderBottom: '1px solid #f3f4f6',
                position: 'sticky',
                top: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                zIndex: 10
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#2563eb',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <Camera size={20} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>{project.ProjectName}</h1>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                            {project.Location || 'Project Gallery'}
                        </p>
                    </div>
                </div>
            </header>

            {/* Photo Feed */}
            <main style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
                        Progress Updates ({photos.length} Photos)
                    </h2>
                </div>

                {photos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: '#9ca3af' }}>
                        <p>No photos have been shared for this project yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {photos.map(photo => {
                            const date = new Date(photo.Timestamp);
                            const formattedDate = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                            const formattedTime = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

                            return (
                                <div key={photo.PhotoID} style={{
                                    backgroundColor: '#f9fafb',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    border: '1px solid #f3f4f6'
                                }}>
                                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: '500', color: '#374151' }}>{formattedDate}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{formattedTime}</div>
                                    </div>
                                    <div style={{ position: 'relative', backgroundColor: '#e5e7eb', maxHeight: '500px', display: 'flex', justifyContent: 'center' }}>
                                        <img
                                            src={photo.ImageFile}
                                            alt={photo.Notes || "Project Photo"}
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '500px',
                                                objectFit: 'contain',
                                                display: 'block'
                                            }}
                                        />
                                    </div>
                                    {photo.Notes && (
                                        <div style={{ padding: '1.25rem', backgroundColor: '#ffffff' }}>
                                            <p style={{ margin: 0, color: '#4b5563', lineHeight: '1.5' }}>
                                                {photo.Notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <footer style={{ marginTop: '4rem', textAlign: 'center', padding: '2rem 0', borderTop: '1px solid #f3f4f6', color: '#9ca3af', fontSize: '0.875rem' }}>
                    <p>Powered by ContractorPhotos</p>
                </footer>
            </main>
        </div>
    );
};

export default SharedProjectView;
