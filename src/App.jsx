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
import { useApp } from './AppContext';

function MainRoutes() {
    const hash = window.location.hash;
    const isShared = hash.startsWith('#share=');
    const sharedPayload = isShared ? hash.replace('#share=', '') : null;

    const [currentView, setCurrentView] = useState(isShared ? 'SHARED_VIEW' : 'HOME');
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [sharedDataPayload, setSharedDataPayload] = useState(sharedPayload);
    const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
    const [editingPhotoId, setEditingPhotoId] = useState(null);
    const [markupReturnView, setMarkupReturnView] = useState('PROJECT_DETAIL');
    const [projectDetailReturnView, setProjectDetailReturnView] = useState('HOME');
    const [settingsReturnView, setSettingsReturnView] = useState('HOME');
    const [cameraReturnView, setCameraReturnView] = useState('HOME');
    const [activeFolderId, setActiveFolderId] = useState(null);

    const navigateTo = (view, projectId = null, photoData = null, existingPhotoId = null, folderId = undefined) => {
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
        return (
            <div style={{ height: '100dvh', backgroundColor: 'var(--background)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid var(--border)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (!currentUser && currentView !== 'SHARED_VIEW') {
        return <OnboardingView />;
    }

    const isOverlayView = ['MARKUP', 'CAMERA'].includes(currentView);
    const underlyingView = isOverlayView ? markupReturnView : currentView;

    return (
        <div className="app-container">
            {/* The Underlying DOM base layer is natively preserved beneath Overlays */}
            {underlyingView === 'HOME' && <ProjectList navigateTo={navigateTo} />}
            {underlyingView === 'ALL_PROJECTS' && <AllProjectsView navigateTo={navigateTo} />}
            {underlyingView === 'PROJECT_DETAIL' && <ProjectDetail projectId={selectedProjectId} navigateTo={navigateTo} initialPhotoId={editingPhotoId} returnView={projectDetailReturnView} />}
            {underlyingView === 'RECENT_PHOTOS' && <AllPhotosView navigateTo={navigateTo} initialPhotoId={editingPhotoId} />}
            {underlyingView === 'MY_MARKUPS' && <MyMarkupsView navigateTo={navigateTo} initialPhotoId={editingPhotoId} />}
            {underlyingView === 'SETTINGS' && <PlaceholderView title="Settings" type="settings" navigateTo={navigateTo} returnView={settingsReturnView} />}
            {underlyingView === 'PROFILE' && <ProfileView navigateTo={navigateTo} />}

            {/* Overlays mount ON TOP of the underlying view */}
            {currentView === 'CAMERA' && <CameraView projectId={selectedProjectId} currentFolderId={activeFolderId} navigateTo={navigateTo} returnView={cameraReturnView} />}
            {currentView === 'MARKUP' && <MarkupView projectId={selectedProjectId} currentFolderId={activeFolderId} photoUrl={capturedPhotoUrl} editingPhotoId={editingPhotoId} navigateTo={navigateTo} returnView={markupReturnView} />}

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
