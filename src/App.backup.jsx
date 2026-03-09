import React, { useState } from 'react';
import { AppProvider } from './AppContext';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import CameraView from './components/CameraView';
import MarkupView from './components/MarkupView';
import AllProjectsView from './components/AllProjectsView';
import AllPhotosView from './components/AllPhotosView';
import ProfileView from './components/ProfileView';
import PlaceholderView from './components/PlaceholderView';
import SharedProjectView from './components/SharedProjectView';
import MyMarkupsView from './components/MyMarkupsView';
import OnboardingView from './components/OnboardingView';
import LoadingSpinner from './components/LoadingSpinner';
import { useApp } from './AppContext';

function MainRoutes() {
    const hash = window.location.hash;
    const isShared = hash.startsWith('#share=');
    const sharedPayload = isShared ? hash.replace('#share=', '') : null;

    const [currentView, setCurrentView] = useState(isShared ? 'SHARED_VIEW' : 'HOME');
    const [prevView, setPrevView] = useState(null);
    const [navDirection, setNavDirection] = useState('push'); // 'push' or 'pop'
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [sharedDataPayload, setSharedDataPayload] = useState(sharedPayload);
    const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
    const [editingPhotoId, setEditingPhotoId] = useState(null);
    const [markupReturnView, setMarkupReturnView] = useState('PROJECT_DETAIL');
    const [projectDetailReturnView, setProjectDetailReturnView] = useState('HOME');
    const [settingsReturnView, setSettingsReturnView] = useState('HOME');
    const [cameraReturnView, setCameraReturnView] = useState('HOME');
    const [activeFolderId, setActiveFolderId] = useState(null);

    // List of "main" views that should have side transitions
    const mainViews = ['HOME', 'ALL_PROJECTS', 'PROJECT_DETAIL', 'RECENT_PHOTOS', 'MY_MARKUPS', 'SETTINGS', 'PROFILE'];

    const navigateTo = (view, projectId = null, photoData = null, existingPhotoId = null, folderId = undefined) => {
        // Only trigger transitions between "Main" views (not overlays)
        const isCurrentlyOverlay = ['MARKUP', 'CAMERA'].includes(currentView);
        const isNextOverlay = ['MARKUP', 'CAMERA'].includes(view);

        if (!isNextOverlay && !isCurrentlyOverlay && view !== currentView) {
            // Determine direction for main view sliding
            if (view === 'HOME') {
                setNavDirection('pop');
            } else if (mainViews.indexOf(view) > mainViews.indexOf(currentView)) {
                setNavDirection('push');
            } else {
                setNavDirection('pop');
            }
        }
        
        setPrevView(currentView);
        if (projectId) setSelectedProjectId(projectId);
        if (photoData) setCapturedPhotoUrl(photoData);
        setEditingPhotoId(existingPhotoId);

        if (folderId !== undefined) {
            setActiveFolderId(folderId);
        } else if (view === 'HOME') {
            setActiveFolderId(null);
        }

        // Smart return path logic for Markup
        if (view === 'MARKUP') {
            // Always return to the project after saving a markup/new photo
            setMarkupReturnView('PROJECT_DETAIL');
        } else if (view === 'CAMERA') {
            // Track where the user came from so cancel goes back there
            setCameraReturnView(currentView);
        }

        // Smart return path logic for Project Details
        if (view === 'PROJECT_DETAIL' && (currentView === 'HOME' || currentView === 'ALL_PROJECTS')) {
            setProjectDetailReturnView(currentView);
        }

        // Smart return path logic for Settings
        if (view === 'SETTINGS' && currentView !== 'SETTINGS') {
            setSettingsReturnView(currentView);
        }

        setCurrentView(view);
    };

    const { currentUser, loading } = useApp();

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!currentUser && currentView !== 'SHARED_VIEW') {
        return <OnboardingView />;
    }

    const isOverlayView = ['MARKUP', 'CAMERA'].includes(currentView);
    const underlyingView = isOverlayView ? markupReturnView : currentView;

    const renderView = () => {
        switch (underlyingView) {
            case 'HOME':
                return <ProjectList navigateTo={navigateTo} />;
            case 'ALL_PROJECTS':
                return <AllProjectsView navigateTo={navigateTo} />;
            case 'PROJECT_DETAIL':
                return <ProjectDetail projectId={selectedProjectId} navigateTo={navigateTo} initialPhotoId={editingPhotoId} returnView={projectDetailReturnView} />;
            case 'RECENT_PHOTOS':
                return <AllPhotosView navigateTo={navigateTo} initialPhotoId={editingPhotoId} />;
            case 'MY_MARKUPS':
                return <MyMarkupsView navigateTo={navigateTo} initialPhotoId={editingPhotoId} />;
            case 'SETTINGS':
                return <PlaceholderView title="Settings" type="settings" navigateTo={navigateTo} returnView={settingsReturnView} />;
            case 'PROFILE':
                return <ProfileView navigateTo={navigateTo} />;
            default:
                return null;
        }
    };

    return (
        <div className="app-container" style={{ overflow: 'hidden', position: 'relative' }}>
            <div 
                id="current-view"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'var(--background)',
                    overflowY: (currentView === 'HOME') ? 'hidden' : 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {renderView()}
            </div>

            {/* Overlays mount ON TOP of the underlying view */}
            {currentView === 'CAMERA' && <CameraView key="camera" projectId={selectedProjectId} currentFolderId={activeFolderId} navigateTo={navigateTo} returnView={cameraReturnView} />}
            {currentView === 'MARKUP' && <MarkupView key="markup" projectId={selectedProjectId} currentFolderId={activeFolderId} photoUrl={capturedPhotoUrl} editingPhotoId={editingPhotoId} navigateTo={navigateTo} returnView={markupReturnView} />}

            {/* Public Shared Web Link */}
            {currentView === 'SHARED_VIEW' && <SharedProjectView payload={sharedDataPayload} />}
        </div>
    );
}

function App() {
    return (
        <AppProvider>
            <MainRoutes />
        </AppProvider>
    );
}

export default App;
