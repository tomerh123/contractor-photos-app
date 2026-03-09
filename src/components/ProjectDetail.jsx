import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import * as db from '../db';
import exifr from 'exifr';
import PhotoViewer from './PhotoViewer';
import { 
    ArrowLeft, Camera, Upload, Sparkles, MapPin, Image as ImageIcon, CheckSquare, 
    Folder, Plus, CheckCircle2, Circle, FolderOpen, X, MoreVertical, Trash2, 
    ChevronDown, Check, Tag as TagIcon, Edit2
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

import PunchListView from './PunchListView';
import { useApp } from '../AppContext';

const ProjectDetail = ({ projectId, navigateTo, initialPhotoId, initialFolderId, returnView = 'HOME' }) => {
    const { currentUser, updateCurrentUser } = useApp();
    const [activeTab, setActiveTab] = useState('GALLERY');
    const [project, setProject] = useState(() => db.getCachedProject(projectId));
    const [photos, setPhotos] = useState(() => db.getCachedPhotos(projectId) || []);
    const [loading, setLoading] = useState(() => {
        return !(db.getCachedProject(projectId) && db.getCachedPhotos(projectId));
    });
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTagFilter, setActiveTagFilter] = useState('All');
    const [activeSubTagFilter, setActiveSubTagFilter] = useState('All');

    // Feature V2: Room Folders
    const [folders, setFolders] = useState([]);
    const [activeFolderId, setActiveFolderId] = useState(initialFolderId || null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set());
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [editingFolder, setEditingFolder] = useState(null);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [deleteModalConfig, setDeleteModalConfig] = useState({ isOpen: false, type: null, folderId: null });
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [showManageTagsModal, setShowManageTagsModal] = useState(false);
    const [tagToRename, setTagToRename] = useState(null);
    const [newTagNameInput, setNewTagNameInput] = useState('');
    const [tagToDelete, setTagToDelete] = useState(null);

    const fileInputRef = useRef(null);
    const longPressTimer = useRef(null);
    const filterTriggerRef = useRef(null);
    const subFilterTriggerRef = useRef(null);

    const [dropdownRect, setDropdownRect] = useState(null);

    const formatLocation = (location) => {
        if (!location) return null;
        const parts = location.split(',');
        if (parts.length > 1) {
            const street = parts[0];
            const cityState = parts.slice(1).join(',').trim();
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{street},</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{cityState}</span>
                </div>
            );
        }
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <MapPin size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{location}</span>
            </div>
        );
    };

    const openPhotoViewer = (photo) => {
        setSelectedPhoto(photo);
    };

    const handleImportPhoto = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsUploading(true);

        const readAndSavePhoto = (file) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1600; // Scaled down to ensure storage fallback limits aren't hit too quickly
                    const MAX_HEIGHT = 1600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = Math.round((height *= MAX_WIDTH / width));
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = Math.round((width *= MAX_HEIGHT / height));
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Output at quality 0.8 to balance zoom clarity with localStorage fallback limits
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

                    // Try to extract original capture date from EXIF metadata
                    let captureTimestamp = new Date().toISOString();
                    try {
                        const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
                        const exifDate = exif?.DateTimeOriginal || exif?.CreateDate;
                        if (exifDate) {
                            captureTimestamp = new Date(exifDate).toISOString();
                        }
                    } catch (exifErr) {
                        console.log('No EXIF date found, using import time:', exifErr);
                    }

                    await db.addPhoto({
                        ProjectID: projectId,
                        ImageFile: compressedDataUrl,
                        Notes: '',
                        FolderID: activeFolderId || null,
                        Source: 'gallery',
                        Timestamp: captureTimestamp
                    });

                    URL.revokeObjectURL(img.src);
                    resolve();
                };
                img.src = URL.createObjectURL(file);
            });
        };

        await Promise.all(files.map(file => readAndSavePhoto(file)));

        // Refresh gallery
        const projPhotos = await db.getPhotosForProject(projectId);
        setPhotos(projPhotos);
        setIsUploading(false);

        // Reset input so the same files can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        setIsUploading(true);
        const newFolder = await db.addProjectFolder(projectId, newFolderName.trim());
        setFolders([...folders, newFolder]);
        setNewFolderName('');
        setShowNewFolderModal(false);
        setIsUploading(false);
        setActiveFolderId(newFolder.FolderID);
    };

    const handleRenameFolder = async () => {
        if (!editingFolder || !newFolderName.trim()) return;
        setIsUploading(true);
        const updated = await db.updateProjectFolder(editingFolder.FolderID, newFolderName.trim());
        setFolders(prev => prev.map(f => f.FolderID === updated.FolderID ? updated : f));
        setEditingFolder(null);
        setNewFolderName('');
        setIsUploading(false);
    };

    const triggerDeleteFolder = (folderId) => {
        setDeleteModalConfig({ isOpen: true, type: 'folder', folderId });
    };

    const togglePhotoSelection = (photoId) => {
        const newSet = new Set(selectedPhotoIds);
        if (newSet.has(photoId)) {
            newSet.delete(photoId);
        } else {
            newSet.add(photoId);
        }
        setSelectedPhotoIds(newSet);
    };

    const handleMovePhotos = async (targetFolderId) => {
        setIsUploading(true);
        const photoIds = Array.from(selectedPhotoIds);

        await db.movePhotosToFolder(photoIds, targetFolderId);

        const projPhotos = await db.getPhotosForProject(projectId);
        setPhotos(projPhotos);

        setIsUploading(false);
        setShowMoveModal(false);
        setIsSelectionMode(false);
        setSelectedPhotoIds(new Set());
        if (targetFolderId) setActiveFolderId(targetFolderId);
    };

    const triggerDeleteSelected = () => {
        setDeleteModalConfig({ isOpen: true, type: 'photos', folderId: null });
    };

    const confirmDelete = async () => {
        setIsUploading(true);
        if (deleteModalConfig.type === 'folder') {
            await db.deleteProjectFolder(deleteModalConfig.folderId);
            setFolders(folders.filter(f => f.FolderID !== deleteModalConfig.folderId));
            const projPhotos = await db.getPhotosForProject(projectId);
            setPhotos(projPhotos);
            setActiveFolderId(null);
        } else if (deleteModalConfig.type === 'photos') {
            for (const pid of selectedPhotoIds) {
                await db.deletePhoto(pid);
            }
            const projPhotos = await db.getPhotosForProject(projectId);
            setPhotos(projPhotos);
            setSelectedPhotoIds(new Set());
            setIsSelectionMode(false);
        }
        setIsUploading(false);
        setDeleteModalConfig({ isOpen: false, type: null, folderId: null });
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!db.getCachedProject(projectId) || !db.getCachedPhotos(projectId)) {
                setLoading(true);
            }
            const proj = await db.getProject(projectId);
            const projPhotos = await db.getPhotosForProject(projectId);
            const projFolders = await db.getProjectFolders(projectId);

            setProject(proj);
            setPhotos(projPhotos);
            setFolders(projFolders);

            if (initialPhotoId) {
                const targetPhoto = projPhotos.find(p => p.PhotoID === initialPhotoId);
                if (targetPhoto) {
                    if (targetPhoto.FolderID) {
                        setActiveFolderId(targetPhoto.FolderID);
                    } else {
                        setActiveFolderId(null);
                    }
                    setSelectedPhoto(targetPhoto);
                }
            }
            setLoading(false);
        };
        if (projectId) {
            fetchData();
        }
    }, [projectId, initialPhotoId]);

    // Listen for the router clearing the initialPhotoId (e.g. returning to library after a 'Save')
    useEffect(() => {
        if (!initialPhotoId) {
            setSelectedPhoto(null);
        }
    }, [initialPhotoId]);

    if (loading) return <LoadingSpinner message="Loading project details..." padding="2rem" />;
    if (!project) return <div className="content-pad">Project not found.</div>;

    const activeFolderPhotos = activeFolderId
        ? photos.filter(p => p.FolderID === activeFolderId)
        : photos.filter(p => !p.FolderID);

    // Filter by tag logic
    const uniqueTags = Array.from(new Set(activeFolderPhotos.flatMap(p => p.Tags || []))).sort();
    
    // Project-wide unique tags for management (Photos + Custom Suggestions)
    const projectWideUniqueTags = Array.from(new Set([
        ...photos.flatMap(p => p.Tags || []),
        ...(Array.isArray(currentUser?.CustomTags) ? currentUser.CustomTags : [])
    ])).sort();

    const isRoot = !activeFolderId;
    const hasFolders = folders.length > 0;
    const hasPhotos = activeFolderPhotos.length > 0;

    let filterOptions = [];
    if (isRoot) {
        filterOptions.push({ value: 'AllPhotos', label: 'All Photos' });
        filterOptions.push({ value: 'All', label: 'Rooms & Photos' });
        if (hasFolders) filterOptions.push({ value: 'Rooms', label: 'Rooms' });
        if (hasPhotos || uniqueTags.length > 0) filterOptions.push({ value: 'Photos', label: 'Unassigned' });
    } else {
        filterOptions.push({ value: 'All', label: 'All Photos' });
    }
    uniqueTags.forEach(tag => {
        filterOptions.push({ value: tag, label: `#${tag}` });
    });

    const currentFilterValid = filterOptions.find(o => o.value === activeTagFilter);
    const effectiveFilter = currentFilterValid ? activeTagFilter : 'All';

    const getFilterLabel = (val, isSub = false) => {
        if (isSub) {
            return val === 'All' ? 'All Tags' : `#${val}`;
        }
        const opt = filterOptions.find(o => o.value === val);
        return opt ? opt.label : `#${val}`;
    };

    const displayedPhotos = effectiveFilter === 'AllPhotos'
        ? (activeSubTagFilter === 'All' 
            ? [...photos].sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
            : photos.filter(p => p.Tags && p.Tags.includes(activeSubTagFilter)).sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
          )
        : effectiveFilter === 'All' || effectiveFilter === 'Photos'
            ? activeFolderPhotos
            : effectiveFilter === 'Rooms' ? [] : activeFolderPhotos.filter(p => p.Tags && p.Tags.includes(effectiveFilter));

    return (
        <div className="project-detail-view">
            {/* Hidden File Input for Camera Roll Import */}
            <input
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImportPhoto}
            />

            <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <button 
                    className="btn" 
                    onClick={() => activeFolderId ? setActiveFolderId(null) : navigateTo(returnView)} 
                    style={{ 
                        background: 'var(--surface-active)', 
                        border: '1px solid var(--border)', 
                        padding: '0.5rem', 
                        borderRadius: '50%', 
                        width: '40px', 
                        height: '40px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0 
                    }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {project.ProjectName}
                    </h2>
                </div>
                <div style={{ width: '40px' }} /> {/* Spacer to keep title centered */}
            </header>


            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
                <button
                    onClick={() => setActiveTab('GALLERY')}
                    style={{
                        flex: 1,
                        padding: '1rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'GALLERY' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        color: activeTab === 'GALLERY' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    <ImageIcon size={18} /> Gallery
                </button>
                <button
                    onClick={() => setActiveTab('PUNCHLIST')}
                    style={{
                        flex: 1,
                        padding: '1rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'PUNCHLIST' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        color: activeTab === 'PUNCHLIST' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    <CheckSquare size={18} /> Punch List
                </button>
            </div>

            <div className="content-pad hide-scrollbar" style={{ 
                flex: 1, 
                overflowY: 'auto', 
                paddingBottom: 'var(--dock-clearance)', 
                WebkitOverflowScrolling: 'touch' 
            }}>
                {/* Project Location Header Context */}
                {project.Location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                        <MapPin size={16} />
                        <span>{project.Location}</span>
                    </div>
                )}

                {activeTab === 'GALLERY' && (
                    <>
                        {/* Row 1: Title */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '2.5rem', marginTop: '0.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.7rem', fontWeight: 700, overflow: 'hidden' }}>
                                {activeFolderId ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                        <FolderOpen size={26} color="var(--primary-color)" style={{ flexShrink: 0 }} />
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {folders.find(f => f.FolderID === activeFolderId)?.Name || 'Folder'}
                                        </span>
                                        <button 
                                            onClick={() => {
                                                const f = folders.find(x => x.FolderID === activeFolderId);
                                                if (f) {
                                                    setEditingFolder(f);
                                                    setNewFolderName(f.Name);
                                                }
                                            }}
                                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '5px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px', cursor: 'pointer' }}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    </span>
                                ) : 'Photo Gallery'}
                            </h3>
                        </div>

                        {/* Row 2: Actions */}
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', gap: '0.75rem' }}>
                            {/* Left: New Room / Manage Tags / Delete Room */}
                            {!isSelectionMode ? (
                                <>
                                    {activeFolderId ? (
                                        <button
                                            onClick={() => triggerDeleteFolder(activeFolderId)}
                                            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--danger)', padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        >
                                            <Trash2 size={18} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Delete Room</span>
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setShowNewFolderModal(true)}
                                                style={{ flex: 1, minHeight: '74px', background: '#38bdf8', border: '1px solid #38bdf8', color: '#0f1115', padding: '10px 8px', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                            >
                                                <Plus size={18} color="#0f1115" strokeWidth={3} />
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.2 }}>New<br/>Room</span>
                                            </button>
                                            <button
                                                onClick={() => setShowManageTagsModal(true)}
                                                style={{ flex: 1, minHeight: '74px', background: 'var(--primary-color)', border: '1px solid var(--primary-color)', color: '#0f1115', padding: '10px 8px', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                            >
                                                <TagIcon size={18} color="#0f1115" strokeWidth={3} />
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.2 }}>Manage<br/>Tags</span>
                                            </button>
                                        </>
                                    )}

                                    {/* Select Button */}
                                    {photos.length > 0 && (
                                        <button
                                            onClick={() => setIsSelectionMode(true)}
                                            style={{ 
                                                flex: activeFolderId ? 1 : 1, 
                                                minHeight: activeFolderId ? 'auto' : '74px',
                                                background: 'white', 
                                                border: '1px solid white', 
                                                color: '#0f1115', 
                                                padding: activeFolderId ? '12px 14px' : '10px 8px', 
                                                borderRadius: '12px', 
                                                cursor: 'pointer', 
                                                display: 'flex', 
                                                flexDirection: activeFolderId ? 'row' : 'column', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                gap: '6px' 
                                            }}
                                        >
                                            <CheckSquare size={18} color="#0f1115" strokeWidth={3} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1 }}>
                                                {activeFolderId ? 'Select Photos' : <>Select<br/>Photos</>}
                                            </span>
                                        </button>
                                    )}
                                </>
                            ) : null}
                        </div>

                        {/* Dropdown Filter */}
                        {(filterOptions.length > 1) && (
                            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                <div
                                    ref={filterTriggerRef}
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDropdownRect(rect);
                                        setShowTagDropdown(v => v === 'main' ? null : 'main');
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, width: '100%', justifyContent: 'space-between' }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Filter:</span>
                                        <span style={{ color: effectiveFilter === 'All' ? 'var(--text-primary)' : 'var(--primary-color)' }}>
                                            {getFilterLabel(effectiveFilter)}
                                        </span>
                                    </span>
                                    <ChevronDown size={16} color="var(--text-secondary)" style={{ transform: showTagDropdown === 'main' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                </div>
                            </div>
                        )}

                        {/* Sub-Filter Dropdown (Always and only for AllPhotos) */}
                        {effectiveFilter === 'AllPhotos' && projectWideUniqueTags.length > 0 && (
                            <div style={{ position: 'relative', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
                                <div 
                                    ref={subFilterTriggerRef}
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDropdownRect(rect);
                                        setShowTagDropdown(v => v === 'sub' ? null : 'sub');
                                    }} 
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, width: '100%', justifyContent: 'space-between' }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>Filter by Tag:</span>
                                        <span style={{ color: activeSubTagFilter === 'All' ? 'var(--text-primary)' : 'var(--primary-color)' }}>
                                            {getFilterLabel(activeSubTagFilter, true)}
                                        </span>
                                    </span>
                                    <ChevronDown size={16} color="var(--text-secondary)" style={{ transform: showTagDropdown === 'sub' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                </div>
                            </div>
                        )}

                        {/* Rooms Grid (Only visible at Root) */}
                        {isRoot && !isSelectionMode && effectiveFilter !== 'AllPhotos' && (effectiveFilter === 'All' || effectiveFilter === 'Rooms') && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                {folders.map(folder => {
                                    const folderPhotos = photos.filter(p => p.FolderID === folder.FolderID);
                                    const coverPhoto = folderPhotos.length > 0 ? folderPhotos[folderPhotos.length - 1].ImageFile : null;

                                    return (
                                        <div
                                            key={folder.FolderID}
                                            onClick={() => {
                                                setActiveFolderId(folder.FolderID);
                                                navigateTo('PROJECT_DETAIL', projectId, null, null, folder.FolderID);
                                            }}
                                            style={{ height: '110px', backgroundColor: 'var(--surface)', borderRadius: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                        >
                                            {coverPhoto ? (
                                                <>
                                                    <img src={coverPhoto} alt={folder.Name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)' }}></div>
                                                </>
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Folder size={32} color="var(--primary-color)" opacity={0.3} />
                                                </div>
                                            )}
                                            <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', textAlign: 'center' }}>
                                                <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>{folder.Name}</div>
                                            </div>
                                            
                                            {/* Edit Button (Top Right) */}
                                            <div 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingFolder(folder);
                                                    setNewFolderName(folder.Name);
                                                }}
                                                style={{ 
                                                    position: 'absolute', 
                                                    top: '8px', 
                                                    right: '8px', 
                                                    zIndex: 10, 
                                                    background: 'rgba(0,0,0,0.4)', 
                                                    backdropFilter: 'blur(4px)',
                                                    borderRadius: '50%', 
                                                    width: '26px', 
                                                    height: '26px', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    border: '1px solid rgba(255,255,255,0.2)'
                                                }}
                                            >
                                                <Edit2 size={12} color="white" />
                                            </div>

                                            <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px' }}>
                                                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem', fontWeight: 500 }}>{folderPhotos.length} {folderPhotos.length === 1 ? 'photo' : 'photos'}</div>
                                            </div>
                                        </div>
                                    )
                                })}

                            </div>
                        )}




                        {isUploading && (
                        <LoadingSpinner fullScreen={false} message="Uploading photos..." size="24px" padding="1rem" />
                    )}

                        {effectiveFilter !== 'Rooms' && (
                            displayedPhotos.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                    <p>No photos yet.</p>
                                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Tap the camera icon to take the first photo, or the upload icon to import.</p>
                                </div>
                            ) : (
                                <div className="photo-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '4px'
                                }}>
                                    {displayedPhotos.map(photo => (
                                        <div
                                            key={photo.PhotoID}
                                            className="photo-card"
                                            style={{
                                                overflow: 'hidden',
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--surface)',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                aspectRatio: '1/1',
                                                opacity: (isSelectionMode && !selectedPhotoIds.has(photo.PhotoID)) ? 0.6 : 1,
                                                transform: (isSelectionMode && selectedPhotoIds.has(photo.PhotoID)) ? 'scale(0.92)' : 'scale(1)',
                                                border: (isSelectionMode && selectedPhotoIds.has(photo.PhotoID)) ? '3px solid var(--primary-color)' : 'none',
                                                transition: 'all 0.2s',
                                                boxSizing: 'border-box',
                                                touchAction: 'pan-y'
                                            }}
                                            onClick={() => {
                                                if (isSelectionMode) {
                                                    togglePhotoSelection(photo.PhotoID);
                                                } else {
                                                    openPhotoViewer(photo);
                                                }
                                            }}
                                            onContextMenu={(e) => e.preventDefault()}
                                            onPointerDown={(e) => {
                                                if (isSelectionMode) return;
                                                longPressTimer.current = setTimeout(() => {
                                                    setIsSelectionMode(true);
                                                    togglePhotoSelection(photo.PhotoID);
                                                    if (window.navigator.vibrate) window.navigator.vibrate(50);
                                                }, 500);
                                            }}
                                            onPointerUp={() => {
                                                if (longPressTimer.current) {
                                                    clearTimeout(longPressTimer.current);
                                                    longPressTimer.current = null;
                                                }
                                            }}
                                            onPointerLeave={() => {
                                                if (longPressTimer.current) {
                                                    clearTimeout(longPressTimer.current);
                                                    longPressTimer.current = null;
                                                }
                                            }}
                                        >
                                            {isSelectionMode && (
                                                <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, backgroundColor: selectedPhotoIds.has(photo.PhotoID) ? 'var(--primary-color)' : 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {selectedPhotoIds.has(photo.PhotoID) ? <Check size={16} color="white" /> : <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid white' }} />}
                                                </div>
                                            )}
                                            <img
                                                src={photo.ImageFile}
                                                alt="Project thumbnail"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                loading="lazy"
                                            />
                                            {photo.Tags && photo.Tags.length > 0 && (
                                                <div style={{ position: 'absolute', top: 4, left: 4, right: 4, display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                                    {photo.Tags.slice(0, 3).map(tag => (
                                                        <span key={tag} style={{ backgroundColor: 'rgba(56,189,248,0.85)', color: '#0f1115', fontSize: '0.55rem', fontWeight: 700, padding: '2px 5px', borderRadius: '6px', lineHeight: 1.2 }}>#{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {(effectiveFilter === 'AllPhotos' && photo.FolderID) ? (
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    🏠 {folders.find(f => f.FolderID === photo.FolderID)?.Name || 'Room'}
                                                </div>
                                            ) : (photo.Notes && (
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    📝 {photo.Notes}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </>
                )}

                {activeTab === 'PUNCHLIST' && (
                    <PunchListView projectId={projectId} />
                )}
            </div>

            {/* Contextual Multi-Select Bottom Bar */}
            {isSelectionMode && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(28, 28, 30, 0.95)',
                    backdropFilter: 'blur(10px)',
                    padding: '16px 20px calc(16px + env(safe-area-inset-bottom))',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 2000,
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 -4px 12px rgba(0,0,0,0.2)'
                }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem', color: 'white' }}>{selectedPhotoIds.size} Selected</span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            className="btn btn-primary"
                            disabled={selectedPhotoIds.size === 0}
                            onClick={() => setShowMoveModal(true)}
                            style={{ 
                                padding: '10px 20px', 
                                fontSize: '0.9rem', 
                                borderRadius: '10px',
                                background: selectedPhotoIds.size > 0 ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                                color: selectedPhotoIds.size > 0 ? 'white' : 'rgba(255,255,255,0.2)',
                                border: 'none',
                                fontWeight: 600
                            }}
                        >
                            Move
                        </button>
                        <button
                            className="btn"
                            onClick={() => {
                                setSelectedPhotoIds(new Set());
                                setIsSelectionMode(false);
                            }}
                            style={{ 
                                padding: '10px 20px', 
                                fontSize: '0.9rem', 
                                color: 'white', 
                                border: '1px solid var(--border)',
                                borderRadius: '10px',
                                background: 'transparent',
                                fontWeight: 600
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn"
                            disabled={selectedPhotoIds.size === 0}
                            onClick={triggerDeleteSelected}
                            style={{ 
                                padding: '10px 20px', 
                                fontSize: '0.9rem', 
                                color: selectedPhotoIds.size > 0 ? '#ff453a' : 'rgba(255,255,255,0.2)', 
                                border: '1px solid ' + (selectedPhotoIds.size > 0 ? '#ff453a' : 'rgba(255,255,255,0.1)'),
                                borderRadius: '10px',
                                background: 'transparent',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>
            )}

            {!isSelectionMode && (
                <div className="floating-dock">
                    <button className="dock-btn main" onClick={() => navigateTo('CAMERA', projectId, null, null, activeFolderId)}><Camera size={26} /></button>
                    <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border)' }}></div>
                    <button className="dock-btn" onClick={() => fileInputRef.current?.click()}><Upload size={22} /></button>
                </div>
            )}

            {/* Advanced Photo Viewer */}
            <AnimatePresence>
                {selectedPhoto && (
                    <PhotoViewer
                        photos={displayedPhotos}
                        initialIndex={displayedPhotos.findIndex(p => p.PhotoID === selectedPhoto.PhotoID)}
                        disableAnimation={selectedPhoto.PhotoID === initialPhotoId}
                        onClose={() => setSelectedPhoto(null)}
                        onAnnotate={(photo) => {
                            // DO NOT close viewer! Keep it mounted behind the Markup overlay!
                            navigateTo('MARKUP', projectId, photo.ImageFile, photo.PhotoID);
                        }}
                        onUpdateNotes={async (photoId, newNotes, newTags) => {
                            await db.updatePhotoDetails(photoId, newNotes, newTags);
                            // Refresh the photo list so the gallery and viewer update
                            const projPhotos = await db.getPhotosForProject(projectId);
                            setPhotos(projPhotos);
                            if (selectedPhoto.PhotoID === photoId) {
                                setSelectedPhoto(projPhotos.find(p => p.PhotoID === photoId));
                            }
                        }}
                        onDelete={async (photoId) => {
                            await db.deletePhoto(photoId);
                            const newPhotos = await db.getPhotosForProject(projectId);
                            setPhotos(newPhotos);
                            if (newPhotos.length === 0) {
                                setSelectedPhoto(null);
                            }
                        }}
                        getFolderName={(folderId) => {
                            if (!folderId) return null;
                            const f = folders.find(folder => folder.FolderID === folderId);
                            return f ? f.Name : null;
                        }}
                        getProjectName={() => project?.ProjectName}
                    />
                )}
            </AnimatePresence>
            {/* New Folder Modal */}
            {showNewFolderModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowNewFolderModal(false)}>
                    <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 16px 0' }}>Create New Room</h3>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            placeholder="e.g. Master Bathroom"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '20px' }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setShowNewFolderModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Folder Modal */}
            {editingFolder && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setEditingFolder(null)}>
                    <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 16px 0' }}>Rename Room</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Updating name for <strong>{editingFolder.Name}</strong></p>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            placeholder="e.g. Master Suite"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '20px' }}
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleRenameFolder()}
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setEditingFolder(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleRenameFolder} disabled={!newFolderName.trim()}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move Photos Modal */}
            {showMoveModal && (() => {
                const selectedPhotosObjects = photos.filter(p => selectedPhotoIds.has(p.PhotoID));
                const selectedFolderIds = new Set(selectedPhotosObjects.map(p => p.FolderID));
                const isMultiFolder = selectedFolderIds.size > 1;
                const singleSourceFolder = selectedFolderIds.size === 1 ? Array.from(selectedFolderIds)[0] : undefined;

                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 4000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowMoveModal(false)}>
                        <div style={{ backgroundColor: 'var(--surface)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', width: '100%', maxWidth: '500px', maxHeight: '80dvh', overflowY: 'auto', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0 }}>Move {selectedPhotoIds.size} Photos</h3>
                                <button onClick={() => setShowMoveModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}><X size={24} /></button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* Show Uncategorized Gallery option if: 
                                    1. Photos are from multiple folders 
                                    2. Photos are from a single room (that is not Root) 
                                */}
                                {(isMultiFolder || (selectedFolderIds.size === 1 && singleSourceFolder !== null)) && (
                                    <button
                                        onClick={() => handleMovePhotos(null)}
                                        style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                        <FolderOpen size={20} color="var(--text-secondary)" />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Uncategorized Gallery</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Remove from current room</div>
                                        </div>
                                    </button>
                                )}

                                {/* Only show other rooms if photos are all from ONE source */}
                                {!isMultiFolder && folders
                                    .filter(f => f.FolderID !== singleSourceFolder)
                                    .map(f => (
                                        <button
                                            key={f.FolderID}
                                            onClick={() => handleMovePhotos(f.FolderID)}
                                            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}
                                        >
                                            <Folder size={20} color="var(--primary-color)" />
                                            <span style={{ fontWeight: 600 }}>{f.Name}</span>
                                        </button>
                                    ))
                                }

                                {isMultiFolder && (
                                    <p style={{ margin: '10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                        Photos from multiple rooms can only be moved to the main gallery.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Custom Delete Confirmation Modal */}
            {deleteModalConfig.isOpen && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '320px', border: '1px solid var(--border)' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                            {deleteModalConfig.type === 'folder' ? 'Delete Room?' : 'Delete Photos?'}
                        </h3>
                        <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                            {deleteModalConfig.type === 'folder'
                                ? 'Are you sure you want to delete this room? The photos inside will NOT be deleted, they will just be moved back to the main unassigned gallery.'
                                : `Are you sure you want to permanently delete ${selectedPhotoIds.size} photo${selectedPhotoIds.size === 1 ? '' : 's'}? This action cannot be undone.`}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className="btn"
                                onClick={() => setDeleteModalConfig({ isOpen: false, type: null, folderId: null })}
                                style={{ flex: 1, padding: '0.8rem', fontSize: '0.9rem' }}
                                disabled={isUploading}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmDelete}
                                style={{ flex: 1, padding: '0.8rem', backgroundColor: 'var(--danger)', fontSize: '0.9rem' }}
                                disabled={isUploading}
                            >
                                {isUploading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Manage Tags Modal */}
            {showManageTagsModal && (
                <div className="modal-overlay" onClick={() => setShowManageTagsModal(false)} style={{ zIndex: 3000 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <TagIcon size={20} color="var(--primary-color)" /> Manage Project Tags
                            </h3>
                            <button onClick={() => setShowManageTagsModal(false)} className="btn" style={{ padding: '4px' }}><X size={20} /></button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                            {projectWideUniqueTags.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                    No tags used in this project yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {projectWideUniqueTags.map(tag => (
                                        <div key={tag} style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'space-between', 
                                            gap: '8px',
                                            padding: '10px 14px', 
                                            backgroundColor: 'var(--surface)', 
                                            borderRadius: '10px',
                                            border: '1px solid var(--border)'
                                        }}>
                                            {tagToRename === tag ? (
                                                <>
                                                    <input 
                                                        autoFocus
                                                        value={newTagNameInput}
                                                        onChange={(e) => setNewTagNameInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const handleRename = async () => {
                                                                    if (!newTagNameInput.trim()) return;
                                                                    setIsUploading(true);
                                                                    await db.renameTagGlobally(projectId, tag, newTagNameInput.trim());
                                                                    const updatedPhotos = await db.getPhotosForProject(projectId);
                                                                    setPhotos(updatedPhotos);
                                                                    setTagToRename(null);
                                                                    setIsUploading(false);
                                                                };
                                                                handleRename();
                                                            } else if (e.key === 'Escape') {
                                                                setTagToRename(null);
                                                            }
                                                        }}
                                                        style={{ 
                                                            flex: 1,
                                                            background: 'var(--background)',
                                                            border: '1px solid var(--primary-color)',
                                                            color: 'white',
                                                            borderRadius: '6px',
                                                            padding: '4px 8px',
                                                            fontSize: '0.9rem',
                                                            minWidth: 0
                                                        }}
                                                    />
                                                    <button 
                                                        onClick={async () => {
                                                            if (!newTagNameInput.trim()) return;
                                                            setIsUploading(true);
                                                            await db.renameTagGlobally(projectId, tag, newTagNameInput.trim());
                                                            const updatedPhotos = await db.getPhotosForProject(projectId);
                                                            setPhotos(updatedPhotos);
                                                            setTagToRename(null);
                                                            setIsUploading(false);
                                                        }}
                                                        className="btn btn-primary" 
                                                        style={{ padding: '8px 12px', fontSize: '0.8rem', flexShrink: 0 }}
                                                    >
                                                        Save
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>#{tag}</span>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button 
                                                            onClick={() => {
                                                                setTagToRename(tag);
                                                                setNewTagNameInput(tag);
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={async () => {
                                                                setTagToDelete(tag);
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Custom Tag Delete Confirmation Sub-Modal */}
                        {tagToDelete && (
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', borderRadius: '12px', animation: 'fadeIn 0.2s ease' }}>
                                <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', padding: '1.5rem', width: '100%', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                                    <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Remove Tag Globally?</h3>
                                    <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                        Are you sure you want to remove <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>#{tagToDelete}</span> from ALL photos in this project and your suggestions?
                                    </p>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button
                                            className="btn"
                                            onClick={() => setTagToDelete(null)}
                                            style={{ flex: 1, padding: '0.8rem', fontSize: '0.9rem' }}
                                            disabled={isUploading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                setIsUploading(true);
                                                await db.deleteTagGlobally(projectId, tagToDelete);
                                                // Also remove from user profile custom tags
                                                const currentCustomTags = Array.isArray(currentUser?.CustomTags) ? currentUser.CustomTags : [];
                                                if (currentCustomTags.includes(tagToDelete)) {
                                                    await updateCurrentUser({
                                                        CustomTags: currentCustomTags.filter(t => t !== tagToDelete),
                                                        DeletedTags: Array.from(new Set([...(currentUser?.DeletedTags || []), tagToDelete]))
                                                    });
                                                }
                                                const updatedPhotos = await db.getPhotosForProject(projectId);
                                                setPhotos(updatedPhotos);
                                                setTagToDelete(null);
                                                setIsUploading(false);
                                            }}
                                            style={{ flex: 1, padding: '0.8rem', backgroundColor: 'var(--danger)', fontSize: '0.9rem' }}
                                            disabled={isUploading}
                                        >
                                            {isUploading ? 'Removing...' : 'Remove'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>Add Project Tag</h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                    type="text"
                                    placeholder="Enter new tag..."
                                    value={tagToRename === '_new_' ? newTagNameInput : ''}
                                    onChange={(e) => {
                                        setTagToRename('_new_');
                                        setNewTagNameInput(e.target.value);
                                    }}
                                    onFocus={() => {
                                        setTagToRename('_new_');
                                        setNewTagNameInput('');
                                    }}
                                    style={{ 
                                        flex: 1,
                                        background: 'var(--background)',
                                        border: '1px solid var(--border)',
                                        color: 'white',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        fontSize: '0.9rem',
                                        minWidth: 0
                                    }}
                                />
                                <button 
                                    onClick={async () => {
                                        if (!newTagNameInput.trim()) return;
                                        setIsUploading(true);
                                        const cleanTag = newTagNameInput.trim().replace(/^#+/, '');
                                        
                                        // Update profile to add to suggestions
                                        const currentCustomTags = Array.isArray(currentUser?.CustomTags) ? currentUser.CustomTags : [];
                                        if (!currentCustomTags.includes(cleanTag)) {
                                            await updateCurrentUser({
                                                CustomTags: [...currentCustomTags, cleanTag],
                                                DeletedTags: (currentUser?.DeletedTags || []).filter(t => t !== cleanTag)
                                            });
                                        }
                                        
                                        setNewTagNameInput('');
                                        setTagToRename(null);
                                        setIsUploading(false);
                                    }}
                                    className="btn btn-primary" 
                                    style={{ padding: '8px 16px', flexShrink: 0 }}
                                >
                                    Add
                                </button>
                            </div>
                            <p style={{ margin: '12px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                This adds the tag to your suggestions for this project.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Fixed Dropdown Panels (Moved Outside for Stacking Context) */}
            {showTagDropdown === 'main' && dropdownRect && (
                <>
                    <div onClick={() => setShowTagDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                    <div style={{ 
                        position: 'fixed', 
                        top: dropdownRect.bottom + 6, 
                        left: dropdownRect.left, 
                        width: dropdownRect.width, 
                        background: 'var(--surface)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '12px', 
                        overflowY: 'auto', 
                        maxHeight: 'max(300px, 45vh)',
                        zIndex: 200, 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)' 
                    }}>
                        {filterOptions.map(opt => (
                            <div
                                key={opt.value}
                                onClick={() => { 
                                    setActiveTagFilter(opt.value); 
                                    setShowTagDropdown(null);
                                    if (opt.value !== 'AllPhotos') setActiveSubTagFilter('All');
                                }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', backgroundColor: effectiveFilter === opt.value ? 'rgba(249,115,22,0.1)' : 'transparent' }}
                            >
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: effectiveFilter === opt.value ? 'var(--primary-color)' : 'var(--text-primary)' }}>
                                    {opt.label}
                                </span>
                                {effectiveFilter === opt.value && <Check size={16} color="var(--primary-color)" />}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {showTagDropdown === 'sub' && dropdownRect && (
                <>
                    <div onClick={() => setShowTagDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                    <div style={{ 
                        position: 'fixed', 
                        top: dropdownRect.bottom + 6, 
                        left: dropdownRect.left, 
                        width: dropdownRect.width, 
                        background: 'var(--surface)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '12px', 
                        overflowY: 'auto', 
                        maxHeight: 'max(300px, 45vh)',
                        zIndex: 200, 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)' 
                    }}>
                        <div onClick={() => { setActiveSubTagFilter('All'); setShowTagDropdown(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', backgroundColor: activeSubTagFilter === 'All' ? 'rgba(249,115,22,0.1)' : 'transparent' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: activeSubTagFilter === 'All' ? 'var(--primary-color)' : 'var(--text-primary)' }}>All Tags</span>
                            {activeSubTagFilter === 'All' && <Check size={16} color="var(--primary-color)" />}
                        </div>
                        {projectWideUniqueTags.map(tag => (
                            <div key={tag} onClick={() => { setActiveSubTagFilter(tag); setShowTagDropdown(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', backgroundColor: activeSubTagFilter === tag ? 'rgba(249,115,22,0.1)' : 'transparent' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: activeSubTagFilter === tag ? 'var(--primary-color)' : 'var(--text-primary)' }}>#{tag}</span>
                                {activeSubTagFilter === tag && <Check size={16} color="var(--primary-color)" />}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProjectDetail;
