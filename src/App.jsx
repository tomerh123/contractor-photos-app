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

function App() {
    const hash = window.location.hash;
    const isShared = hash.startsWith('#share=');
    const sharedPayload = isShared ? hash.replace('#share=', '') : null;

    const [currentView, setCurrentView] = useState(isShared ? 'SHARED_VIEW' : 'HOME');
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [sharedDataPayload, setSharedDataPayload] = useState(sharedPayload);
    const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
    const [editingPhotoId, setEditingPhotoId] = useState(null);

    const navigateTo = (view, projectId = null, photoData = null, existingPhotoId = null) => {
        if (projectId) setSelectedProjectId(projectId);
        if (photoData) setCapturedPhotoUrl(photoData);
        setEditingPhotoId(existingPhotoId);
        setCurrentView(view);
    };

    return (
        <AppProvider>
            <div className="app-container">
                {currentView === 'HOME' && <ProjectList navigateTo={navigateTo} />}
                {currentView === 'ALL_PROJECTS' && <AllProjectsView navigateTo={navigateTo} />}
                {currentView === 'PROJECT_DETAIL' && <ProjectDetail projectId={selectedProjectId} navigateTo={navigateTo} />}
                {currentView === 'CAMERA' && <CameraView projectId={selectedProjectId} navigateTo={navigateTo} />}
                {currentView === 'MARKUP' && <MarkupView projectId={selectedProjectId} photoUrl={capturedPhotoUrl} editingPhotoId={editingPhotoId} navigateTo={navigateTo} />}
                {currentView === 'RECENT_PHOTOS' && <AllPhotosView navigateTo={navigateTo} />}

                {/* Dummy placeholder screens */}
                {currentView === 'MY_MARKUPS' && <PlaceholderView title="My Markups" type="markups" navigateTo={navigateTo} />}
                {currentView === 'SETTINGS' && <PlaceholderView title="Settings" type="settings" navigateTo={navigateTo} />}
                {currentView === 'PROFILE' && <ProfileView navigateTo={navigateTo} />}

                {/* Public Shared Web Link */}
                {currentView === 'SHARED_VIEW' && <SharedProjectView payload={sharedDataPayload} />}
            </div>
        </AppProvider>
    );
}

export default App;
