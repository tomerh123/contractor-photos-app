import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import * as db from '../db';
import ProjectCard from './ProjectCard';
import { ArrowLeft, ArrowUp, ArrowDown, Search, ChevronDown, Check } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const AllProjectsView = ({ navigateTo }) => {
    const { projects, refreshProjects, currentUser } = useApp();
    const [sortedProjects, setSortedProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('activity'); // 'newest', 'oldest', or 'activity'
    const [showSortDropdown, setShowSortDropdown] = useState(false);

    const [topLevelTab, setTopLevelTab] = useState('My Projects'); // 'My Projects' or 'Shared With Me'
    const [activeTab, setActiveTab] = useState('Active'); // 'Active', 'Favorites', or 'Archived'
    const [showHeader, setShowHeader] = useState(true);
    const [lastScrollTop, setLastScrollTop] = useState(0);
    const [headerHeight, setHeaderHeight] = useState(0);
    const headerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Refresh projects on mount to ensure we have the latest UpdatedAt timestamps
    useEffect(() => {
        if (currentUser?.uid) {
            refreshProjects(currentUser.uid);
        }
    }, []);

    // Auto-close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSortDropdown(false);
            }
        };
        if (showSortDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSortDropdown]);
    useEffect(() => {
        let tabProjects = projects;
        if (activeTab === 'Active') {
            tabProjects = projects.filter(p => !p.ArchivedAt);
        } else if (activeTab === 'Favorites') {
            tabProjects = projects.filter(p => p.IsFavorite && !p.ArchivedAt);
        } else {
            tabProjects = projects.filter(p => p.ArchivedAt);
        }

        const sorted = [...tabProjects].sort((a, b) => {
            if (sortOrder === 'activity') {
                const tA = new Date(a.UpdatedAt || a.CreatedAt).getTime();
                const tB = new Date(b.UpdatedAt || b.CreatedAt).getTime();
                return tB - tA;
            }
            const tA = new Date(a.CreatedAt).getTime();
            const tB = new Date(b.CreatedAt).getTime();
            return sortOrder === 'newest' ? tB - tA : tA - tB;
        });

        setSortedProjects(sorted);
        setIsLoading(false);
    }, [projects, sortOrder, activeTab]);

    const displayedProjects = sortedProjects.filter(p => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchName = p.ProjectName?.toLowerCase().includes(query);
            const matchLocation = p.Location?.toLowerCase().includes(query);
            if (!matchName && !matchLocation) return false;
        }
        return true;
    });

    useEffect(() => {
        if (headerRef.current) {
            setHeaderHeight(headerRef.current.offsetHeight);
        }
    }, [topLevelTab, activeTab, displayedProjects.length, isLoading]);

    const handleScroll = (e) => {
        const scrollTop = e.currentTarget.scrollTop;
        if (scrollTop < 20) {
            setShowHeader(true);
        } else if (scrollTop > lastScrollTop + 10) {
            // Scrolling down
            setShowHeader(false);
        } else if (scrollTop < lastScrollTop - 10) {
            // Scrolling up
            setShowHeader(true);
        }
        setLastScrollTop(scrollTop);
    };

    return (
        <div className="hide-scrollbar" onScroll={handleScroll} style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--background)' }}>
            <div 
                ref={headerRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    backgroundColor: 'var(--background)',
                    transform: showHeader ? 'translateY(0)' : 'translateY(-100%)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    borderBottom: '1px solid var(--border)',
                    boxShadow: showHeader && lastScrollTop > 10 ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'
                }}
            >
                <header className="header" style={{ position: 'relative', top: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '64px', borderBottom: 'none', backdropFilter: 'none', backgroundColor: 'transparent' }}>
                    <button
                        onClick={() => navigateTo('HOME')}
                        style={{ position: 'absolute', left: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div style={{ textAlign: 'center', width: '100%', padding: '0 50px' }}>
                        <h2 style={{ fontSize: '1.3rem', margin: 0 }}>All Projects</h2>
                    </div>
                    <div style={{ position: 'absolute', right: '1.5rem' }} ref={dropdownRef}>
                        <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: showSortDropdown ? 'var(--surface-active)' : 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '500',
                                transition: 'all 0.2s ease',
                                textAlign: 'right'
                            }}
                        >
                            {sortOrder === 'activity' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.1' }}>
                                    <span>Modified</span>
                                </div>
                            ) : (sortOrder === 'newest' ? 'Newest' : 'Oldest')}
                            <ChevronDown size={14} style={{ transform: showSortDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease', marginLeft: '4px' }} />
                        </button>

                        {showSortDropdown && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '8px',
                                backgroundColor: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                minWidth: '160px',
                                zIndex: 1000,
                                overflow: 'hidden',
                                animation: 'fadeInDown 0.2s ease-out'
                            }}>
                                {[
                                    { id: 'activity', label: 'Last Modified' },
                                    { id: 'newest', label: 'Newest' },
                                    { id: 'oldest', label: 'Oldest' }
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            setSortOrder(option.id);
                                            setShowSortDropdown(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '12px 16px',
                                            border: 'none',
                                            background: sortOrder === option.id ? 'var(--surface-active)' : 'transparent',
                                            color: sortOrder === option.id ? 'var(--primary-color)' : 'var(--text-primary)',
                                            fontSize: '0.9rem',
                                            fontWeight: sortOrder === option.id ? '600' : '400',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.2s ease'
                                        }}
                                    >
                                        {option.label}
                                        {sortOrder === option.id && <Check size={16} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </header>

                <div style={{ padding: '0 1.5rem 1rem 1.5rem' }}>
                    {/* Top Level Segmented Control */}
                    <div style={{ display: 'flex', backgroundColor: 'var(--surface-active)', borderRadius: '12px', padding: '4px', marginBottom: '1rem' }}>
                        <div
                            onClick={() => setTopLevelTab('My Projects')}
                            style={{
                                flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: '8px',
                                backgroundColor: topLevelTab === 'My Projects' ? 'var(--surface)' : 'transparent',
                                color: topLevelTab === 'My Projects' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: topLevelTab === 'My Projects' ? 600 : 400,
                                boxShadow: topLevelTab === 'My Projects' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                                cursor: 'pointer', transition: 'all 0.2s ease'
                            }}
                        >
                            My Projects
                        </div>
                        <div
                            onClick={() => setTopLevelTab('Shared With Me')}
                            style={{
                                flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: '8px',
                                backgroundColor: topLevelTab === 'Shared With Me' ? 'var(--surface)' : 'transparent',
                                color: topLevelTab === 'Shared With Me' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: topLevelTab === 'Shared With Me' ? 600 : 400,
                                boxShadow: topLevelTab === 'Shared With Me' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                                cursor: 'pointer', transition: 'all 0.2s ease'
                            }}
                        >
                            Shared With Me
                        </div>
                    </div>

                    {topLevelTab === 'My Projects' && (
                        <>
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
                                        padding: '0.7rem 1rem 0.7rem 2.5rem',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Sub Tabs */}
                            <div style={{ display: 'flex', gap: '1.5rem', borderBottom: 'none', marginTop: '1rem' }}>
                                <div onClick={() => setActiveTab('Active')} style={{ cursor: 'pointer', paddingBottom: '0.6rem', borderBottom: activeTab === 'Active' ? '2px solid var(--primary-color)' : '2px solid transparent', fontWeight: 600, color: activeTab === 'Active' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Active</div>
                                <div onClick={() => setActiveTab('Favorites')} style={{ cursor: 'pointer', paddingBottom: '0.6rem', borderBottom: activeTab === 'Favorites' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'Favorites' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>Favorites</div>
                                <div onClick={() => setActiveTab('Archived')} style={{ cursor: 'pointer', paddingBottom: '0.6rem', borderBottom: activeTab === 'Archived' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'Archived' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>Archived</div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div style={{ padding: '1.5rem', paddingTop: `${headerHeight + 20}px` }}>
                {topLevelTab === 'Shared With Me' ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🤝</div>
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Shared With Me</h3>
                        <p>Projects that other users share with you will appear here.</p>
                        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>You haven't received any shared projects yet.</p>
                    </div>
                ) : isLoading ? (
                    <LoadingSpinner fullScreen={false} message="Loading projects..." padding="2rem" />
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
