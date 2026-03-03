import { get as idbGet, set as idbSet } from 'idb-keyval';

// Simple mock database using memory and local storage to simulate backend latency
let mockProjects = [];
let mockPhotos = [];
let mockTodos = [];
let mockProfile = null;
let photosLoaded = false;
let init = false;

const defaultProfile = {
    Name: 'Tomer Harel',
    Company: 'SpicyT AV',
    Email: 'spicytav@gmail.com',
    Phone: '18184456361',
    JobTitle: 'Owner',
    Trade: 'Low Voltage'
};

const loadPhotos = async () => {
    if (photosLoaded) return;
    try {
        const stored = await idbGet('contractor_photos_idb');
        if (stored) {
            mockPhotos = stored;
        } else {
            // Check legacy localStorage and migrate
            const legacyPhotos = localStorage.getItem('contractor_photos');
            if (legacyPhotos) {
                const parsed = JSON.parse(legacyPhotos);
                parsed.forEach((p, idx) => {
                    if (!p.PhotoID) p.PhotoID = `ph_legacy_${idx}_${Date.now()}`;
                    if (!p.Timestamp) p.Timestamp = new Date().toISOString();
                });
                mockPhotos = parsed;
                await idbSet('contractor_photos_idb', mockPhotos);
                localStorage.removeItem('contractor_photos');
            }
        }
    } catch (e) {
        console.error('Failed to load photos from IndexedDB, falling back to localStorage', e);
        try {
            const fallbackPhotos = localStorage.getItem('contractor_photos_fallback');
            if (fallbackPhotos) {
                mockPhotos = JSON.parse(fallbackPhotos);
            }
        } catch (err) { }
    }
    photosLoaded = true;
};

const savePhotos = async () => {
    try {
        await idbSet('contractor_photos_idb', mockPhotos);
    } catch (e) {
        console.error('Failed to save photos to IndexedDB, falling back to localStorage', e);
        try {
            localStorage.setItem('contractor_photos_fallback', JSON.stringify(mockPhotos));
        } catch (err) {
            console.warn('LocalStorage limit reached on fallback!', err);
        }
    }
};

export const initializeDB = () => {
    if (init) return;

    // Load Projects
    const storedProjects = localStorage.getItem('contractor_projects');
    if (storedProjects) {
        try {
            mockProjects = JSON.parse(storedProjects);
        } catch (e) { }
    }

    // Load Todos
    const storedTodos = localStorage.getItem('contractor_todos');
    if (storedTodos) {
        try {
            mockTodos = JSON.parse(storedTodos);
        } catch (e) { }
    }

    // Load Profile
    const storedProfile = localStorage.getItem('contractor_profile');
    if (storedProfile) {
        try {
            mockProfile = JSON.parse(storedProfile);
        } catch (e) { }
    } else {
        mockProfile = { ...defaultProfile };
    }

    init = true;
};

const saveToLocalStorage = () => {
    try {
        localStorage.setItem('contractor_projects', JSON.stringify(mockProjects));
        localStorage.setItem('contractor_todos', JSON.stringify(mockTodos));
        localStorage.setItem('contractor_profile', JSON.stringify(mockProfile));
    } catch (e) {
        console.warn('Storage limit reached, could not save local storage arrays');
    }
};

const delay = (ms) => Promise.resolve(); // Artificial latency disabled for local performance

// Utility to clean up old archives (runs when fetching projects)
const cleanupArchivedProjects = async () => {
    await loadPhotos();
    let changed = false;
    let photosChanged = false;
    const now = new Date();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    for (let i = mockProjects.length - 1; i >= 0; i--) {
        const p = mockProjects[i];
        if (p.ArchivedAt) {
            const archiveDate = new Date(p.ArchivedAt);
            if (now - archiveDate > thirtyDaysInMs) {
                // Permanently delete the project and its photos
                const projectId = p.ProjectID;
                mockProjects.splice(i, 1);

                const oldLen = mockPhotos.length;
                mockPhotos = mockPhotos.filter(photo => photo.ProjectID !== projectId);
                if (mockPhotos.length !== oldLen) photosChanged = true;

                changed = true;
            }
        }
    }

    if (changed) saveToLocalStorage();
    if (photosChanged) await savePhotos();
};

// --- Mock DB Functions ---

export const getProfile = async () => {
    return { ...mockProfile };
};

export const updateProfile = async (updates) => {
    mockProfile = { ...mockProfile, ...updates };
    saveToLocalStorage();
    return mockProfile;
};

export const getProjects = async () => {
    await cleanupArchivedProjects();
    return [...mockProjects];
};

export const getProject = async (id) => {
    return mockProjects.find(p => p.ProjectID === id);
};

export const getPhotosForProject = async (projectId) => {
    await loadPhotos();
    // Sort oldest first (chronological) consistently with Apple Photos
    return mockPhotos.filter(photo => photo.ProjectID === projectId).sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
};

export const getAllPhotos = async () => {
    await loadPhotos();
    return [...mockPhotos].sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
};

export const addPhoto = async (photoData) => {
    await loadPhotos();
    const newPhoto = {
        PhotoID: `ph_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        Timestamp: new Date().toISOString(),
        ...photoData
    };
    mockPhotos.push(newPhoto);
    await savePhotos();
    return newPhoto;
};

export const updatePhotoNotes = async (photoId, newNotes) => {
    await loadPhotos();
    const photo = mockPhotos.find(p => p.PhotoID === photoId);
    if (photo) {
        photo.Notes = newNotes;
        await savePhotos();
    }
    return photo;
};

export const updatePhoto = async (photoId, newImageFile, newNotes) => {
    await loadPhotos();
    const photoIndex = mockPhotos.findIndex(p => p.PhotoID === photoId);
    if (photoIndex !== -1) {
        mockPhotos[photoIndex] = {
            ...mockPhotos[photoIndex],
            ImageFile: newImageFile,
            Notes: newNotes,
            Timestamp: new Date().toISOString() // Update timestamp to show it was recently modified
        };
        await savePhotos();
        return mockPhotos[photoIndex];
    }
    throw new Error('Photo not found');
};

export const deletePhoto = async (photoId) => {
    await loadPhotos();
    const photoIndex = mockPhotos.findIndex(p => p.PhotoID === photoId);
    if (photoIndex !== -1) {
        mockPhotos.splice(photoIndex, 1);
        await savePhotos();
        return true;
    }
    return false;
};

export const addProject = async (projectData) => {
    const newProject = {
        ProjectID: `p${Date.now()}`,
        CreatedAt: new Date().toISOString(),
        IsFavorite: false,
        Lat: projectData.Lat || null,
        Lon: projectData.Lon || null,
        ...projectData
    };
    mockProjects.push(newProject);
    saveToLocalStorage();
    return newProject;
};

export const deleteProject = async (projectId) => {
    const index = mockProjects.findIndex(p => p.ProjectID === projectId);
    if (index !== -1) {
        // Soft delete: set ArchivedAt timestamp
        mockProjects[index] = {
            ...mockProjects[index],
            ArchivedAt: new Date().toISOString()
        };
        saveToLocalStorage();
        return true;
    }
    return false;
};

export const restoreProject = async (projectId) => {
    const index = mockProjects.findIndex(p => p.ProjectID === projectId);
    if (index !== -1) {
        mockProjects[index] = {
            ...mockProjects[index]
        };
        delete mockProjects[index].ArchivedAt;
        saveToLocalStorage();
        return true;
    }
    return false;
};

export const permanentlyDeleteProject = async (projectId) => {
    const index = mockProjects.findIndex(p => p.ProjectID === projectId);
    if (index !== -1) {
        mockProjects.splice(index, 1);

        // Delete all photos for this project to avoid orphans
        const remainingPhotos = mockPhotos.filter(p => p.ProjectID !== projectId);
        mockPhotos.length = 0;
        mockPhotos.push(...remainingPhotos);
        await savePhotos();

        // Delete all todos for this project
        mockTodos = mockTodos.filter(t => t.ProjectID !== projectId);

        saveToLocalStorage();
        return true;
    }
    return false;
};

export const updateProject = async (projectId, newProjectData) => {
    const index = mockProjects.findIndex(p => p.ProjectID === projectId);
    if (index !== -1) {
        mockProjects[index] = {
            ...mockProjects[index],
            ...newProjectData,
            // Keep original values if not provided
            ProjectName: newProjectData.ProjectName || mockProjects[index].ProjectName,
            Location: newProjectData.Location !== undefined ? newProjectData.Location : mockProjects[index].Location,
            IsFavorite: newProjectData.IsFavorite !== undefined ? newProjectData.IsFavorite : mockProjects[index].IsFavorite,
            Lat: newProjectData.Lat !== undefined ? newProjectData.Lat : mockProjects[index].Lat,
            Lon: newProjectData.Lon !== undefined ? newProjectData.Lon : mockProjects[index].Lon
        };
        saveToLocalStorage();
        return mockProjects[index];
    }
    throw new Error('Project not found');
};

// --- Todo Functions ---

export const getTodosForProject = async (projectId) => {
    return mockTodos.filter(t => t.ProjectID === projectId).sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
};

export const addTodo = async (todoData) => {
    const newTodo = {
        TodoID: `td_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        Timestamp: new Date().toISOString(),
        IsCompleted: false,
        ...todoData
    };
    mockTodos.push(newTodo);
    saveToLocalStorage();
    return newTodo;
};

export const toggleTodo = async (todoId) => {
    const todoIndex = mockTodos.findIndex(t => t.TodoID === todoId);
    if (todoIndex !== -1) {
        mockTodos[todoIndex].IsCompleted = !mockTodos[todoIndex].IsCompleted;
        saveToLocalStorage();
        return mockTodos[todoIndex];
    }
    throw new Error("Todo not found");
};

export const deleteTodo = async (todoId) => {
    const index = mockTodos.findIndex(t => t.TodoID === todoId);
    if (index !== -1) {
        mockTodos.splice(index, 1);
        saveToLocalStorage();
        return true;
    }
    return false;
};
