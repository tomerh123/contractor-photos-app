import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import * as db from '../db';
import ProjectCard from './ProjectCard';
import { ArrowLeft, ArrowUp, ArrowDown, Search } from 'lucide-react';

const AllProjectsView = ({ navigateTo }) => {
    const { projects } = useApp();
    const [sortedProjects, setSortedProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');

    useEffect(() => {
        const sortProjects = async () => {
            setIsLoading(true);

            // Map through each project and figure out its last modified date
            const activeProjects = projects.filter(p => !p.ArchivedAt);
            const projectsWithDates = await Promise.all(activeProjects.map(async (project) => {
                const photos = await db.getPhotosForProject(project.ProjectID);
                let lastModified = new Date(project.CreatedAt);

                if (photos && photos.length > 0) {
                    // Find the most recent photo
                    photos.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
                    const latestPhotoDate = new Date(photos[0].Timestamp);

                    // If the photo was added after creation, use that date
                    if (latestPhotoDate > lastModified) {
                        lastModified = latestPhotoDate;
                    }
                }

                return { ...project, lastModifiedTime: lastModified.getTime() };
            }));

            // Sort by most recently modified based on sortOrder
            projectsWithDates.sort((a, b) => {
                return sortOrder === 'newest'
                    ? b.lastModifiedTime - a.lastModifiedTime
                    : a.lastModifiedTime - b.lastModifiedTime;
            });

            setSortedProjects(projectsWithDates);
            setIsLoading(false);
        };

        sortProjects();
    }, [projects, sortOrder]);

    const displayedProjects = sortedProjects.filter(p => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = p.ProjectName?.toLowerCase().includes(query);
            const matchLocation = p.Location?.toLowerCase().includes(query);
            if (!matchName && !matchLocation) return false;
        }
        return true;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: 'var(--background)' }}>
            <header className="header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '64px', borderBottom: '1px solid var(--border)' }}>
                <button
                    onClick={() => navigateTo('HOME')}
                    style={{ position: 'absolute', left: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <div style={{ textAlign: 'center', width: '100%', padding: '0 50px' }}>
                    <h2 style={{ fontSize: '1.3rem', margin: 0 }}>All Projects</h2>
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

            <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            backgroundColor: 'var(--surface-active)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            padding: '1rem 1rem 1rem 2.5rem',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                        Loading projects...
                    </div>
                ) : displayedProjects.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                        {sortedProjects.length === 0 ? "No active projects." : "No projects match your search."}
                    </div>
                ) : (
                    displayedProjects.map(project => (
                        <ProjectCard key={project.ProjectID} project={project} navigateTo={navigateTo} />
                    ))
                )}
            </div>
        </div>
    );
};

export default AllProjectsView;
