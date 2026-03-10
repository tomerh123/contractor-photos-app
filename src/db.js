import { auth, db as firestore, storage } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, deleteDoc, deleteField, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

const getUid = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User not authenticated");
    return uid;
};

export const initializeDB = async () => {
    // No-op for Firebase. Handled via onAuthStateChanged.
};

// Global RAM Cache for instant backwards navigation
let memoryCache = {
    projects: {},
    projectPhotos: {},
    allProjects: null,
    allPhotos: null,
    allFolders: null
};

export const clearDBCache = () => {
    memoryCache = { projects: {}, projectPhotos: {}, allProjects: null, allPhotos: null, allFolders: null };
};

export const getCachedProject = (id) => memoryCache.projects[id] || null;
export const getCachedPhotos = (id) => memoryCache.projectPhotos[id] || null;
export const getCachedAllProjects = () => memoryCache.allProjects || null;
export const getCachedAllPhotos = () => memoryCache.allPhotos || null;
export const getCachedAllFolders = () => memoryCache.allFolders || null;

// --- Profile ---
export const getProfile = async (uid) => {
    if (!uid) return null;
    try {
        const docRef = doc(firestore, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (e) {
        console.error("Error fetching profile", e);
    }
    return null;
};

export const updateProfile = async (uid, updates) => {
    if (!uid) return null;
    try {
        const docRef = doc(firestore, 'users', uid);
        await setDoc(docRef, updates, { merge: true });
        clearDBCache();
        return updates; // AppContext re-merges it
    } catch (e) {
        console.error("Error updating profile", e);
        return null;
    }
};

// --- Projects ---
export const getProjects = async () => {
    if (memoryCache.allProjects) return memoryCache.allProjects;
    try {
        const q = query(collection(firestore, 'projects'), where("userId", "==", getUid()));
        const snapshot = await getDocs(q);
        const projects = snapshot.docs.map(doc => doc.data());
        memoryCache.allProjects = projects;
        return memoryCache.allProjects;
    } catch (e) {
        console.error("Error getting projects", e);
        return [];
    }
};

export const getProject = async (id) => {
    if (memoryCache.projects[id]) return memoryCache.projects[id];
    const docRef = doc(firestore, 'projects', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        memoryCache.projects[id] = docSnap.data();
        return memoryCache.projects[id];
    }
    return undefined;
};

export const addProject = async (projectData) => {
    const ProjectID = `p${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newProject = {
        ProjectID,
        userId: getUid(),
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
        IsFavorite: false,
        Lat: projectData.Lat || null,
        Lon: projectData.Lon || null,
        ...projectData
    };
    await setDoc(doc(firestore, 'projects', ProjectID), newProject);
    clearDBCache();
    return newProject;
};

export const updateProject = async (projectId, newProjectData, touch = true) => {
    const docRef = doc(firestore, 'projects', projectId);
    const updates = { ...newProjectData };
    if (touch) {
        updates.UpdatedAt = new Date().toISOString();
    }
    await setDoc(docRef, updates, { merge: true });
    clearDBCache();
    const snap = await getDoc(docRef);
    return snap.data();
};

export const deleteProject = async (projectId) => {
    const docRef = doc(firestore, 'projects', projectId);
    await setDoc(docRef, { ArchivedAt: new Date().toISOString() }, { merge: true });
    clearDBCache();
    return true;
};

export const touchProject = async (projectId) => {
    if (!projectId) return;
    try {
        const docRef = doc(firestore, 'projects', projectId);
        await updateDoc(docRef, { UpdatedAt: new Date().toISOString() });
        clearDBCache();
    } catch (e) {
        console.error("Error touching project", e);
    }
};

export const restoreProject = async (projectId) => {
    const docRef = doc(firestore, 'projects', projectId);
    await updateDoc(docRef, { ArchivedAt: deleteField() });
    clearDBCache();
    return true;
};

export const permanentlyDeleteProject = async (projectId) => {
    // 1. Delete all photos (directly by Document ID to destroy Ghosts)
    const q = query(collection(firestore, 'photos'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
        await deleteDoc(doc(firestore, 'photos', d.id));
    }

    // 2. Delete all punchlist todos
    const tq = query(collection(firestore, 'todos'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
    const ts = await getDocs(tq);
    for (const d of ts.docs) {
        await deleteDoc(doc(firestore, 'todos', d.id));
    }

    // 3. Delete all custom folders
    const fq = query(collection(firestore, 'folders'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
    const fs = await getDocs(fq);
    for (const d of fs.docs) {
        await deleteDoc(doc(firestore, 'folders', d.id));
    }

    // 4. Delete the physical project
    await deleteDoc(doc(firestore, 'projects', projectId));
    clearDBCache();
    return true;
};

// --- Photos ---
export const getPhotosForProject = async (projectId) => {
    if (memoryCache.projectPhotos[projectId]) return memoryCache.projectPhotos[projectId];
    const q = query(collection(firestore, 'photos'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
    const snapshot = await getDocs(q);
    const photos = snapshot.docs.map(doc => ({ ...doc.data(), PhotoID: doc.id }));
    memoryCache.projectPhotos[projectId] = photos.sort((a, b) => {
        const timeA = a.Timestamp ? new Date(a.Timestamp).getTime() : 0;
        const timeB = b.Timestamp ? new Date(b.Timestamp).getTime() : 0;
        return timeB - timeA;
    });
    return memoryCache.projectPhotos[projectId];
};

export const subscribeToPhotosForProject = (projectId, callback) => {
    const q = query(collection(firestore, 'photos'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
    return onSnapshot(q, (snapshot) => {
        const photos = snapshot.docs.map(doc => ({ ...doc.data(), PhotoID: doc.id }));
        
        // Final safety deduplication by ID
        const uniqueMap = new Map();
        photos.forEach(p => uniqueMap.set(p.PhotoID, p));
        const uniquePhotos = Array.from(uniqueMap.values());

        const sortedPhotos = uniquePhotos.sort((a, b) => {
            const timeA = a.Timestamp ? new Date(a.Timestamp).getTime() : 0;
            const timeB = b.Timestamp ? new Date(b.Timestamp).getTime() : 0;
            return timeB - timeA;
        });
        memoryCache.projectPhotos[projectId] = sortedPhotos;
        callback(sortedPhotos);
    });
};

export const getAllPhotos = async () => {
    if (memoryCache.allPhotos) return memoryCache.allPhotos;
    const q = query(collection(firestore, 'photos'), where("userId", "==", getUid()));
    const snapshot = await getDocs(q);
    const photos = snapshot.docs.map(doc => ({ ...doc.data(), PhotoID: doc.id }));
    memoryCache.allPhotos = photos.sort((a, b) => {
        const timeA = a.Timestamp ? new Date(a.Timestamp).getTime() : 0;
        const timeB = b.Timestamp ? new Date(b.Timestamp).getTime() : 0;
        return timeB - timeA;
    });
    return memoryCache.allPhotos;
};

export const addPhoto = async (photoData) => {
    const PhotoID = photoData.PhotoID || `ph_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    let imageUrl = photoData.ImageFile;
    let originalUrl = photoData.OriginalImageFile;
    const uploadTasks = [];

    // Queue base64 to Firebase Storage
    if (photoData.ImageFile && photoData.ImageFile.startsWith('data:image')) {
        const primaryRef = ref(storage, `users/${getUid()}/photos/${PhotoID}.jpg`);
        uploadTasks.push(
            uploadString(primaryRef, photoData.ImageFile, 'data_url')
                .then(() => getDownloadURL(primaryRef))
                .then(url => { imageUrl = url; })
        );
    }

    if (photoData.OriginalImageFile && photoData.OriginalImageFile.startsWith('data:image')) {
        const origRef = ref(storage, `users/${getUid()}/photos/${PhotoID}_orig.jpg`);
        uploadTasks.push(
            uploadString(origRef, photoData.OriginalImageFile, 'data_url')
                .then(() => getDownloadURL(origRef))
                .then(url => { originalUrl = url; })
        );
    }

    // Execute concurrently to half upload times
    await Promise.all(uploadTasks);

    const newPhoto = {
        PhotoID,
        userId: getUid(),
        Timestamp: new Date().toISOString(),
        Tags: [],
        ...photoData,
        ImageFile: imageUrl
    };

    if (originalUrl) {
        newPhoto.OriginalImageFile = originalUrl;
    } else {
        delete newPhoto.OriginalImageFile;
    }

    await setDoc(doc(firestore, 'photos', PhotoID), newPhoto);

    // No manual cache update here; onSnapshot listeners will catch it.
    // Clearing cache for non-listening views (like AllPhotos)
    memoryCache.allPhotos = null;

    if (photoData.ProjectID) {
        await touchProject(photoData.ProjectID);
    }

    return { ...newPhoto, PhotoID };
};

export const updatePhotoDetails = async (photoId, newNotes, newTags) => {
    const docRef = doc(firestore, 'photos', photoId);
    const updates = {};
    if (newNotes !== undefined) updates.Notes = newNotes;
    if (newTags !== undefined) updates.Tags = newTags;
    await setDoc(docRef, updates, { merge: true });

    Object.values(memoryCache.projectPhotos).forEach(photos => {
        const p = photos.find(x => x.PhotoID === photoId);
        if (p) {
            if (newNotes !== undefined) p.Notes = newNotes;
            if (newTags !== undefined) p.Tags = newTags;
        }
    });

    if (memoryCache.allPhotos) {
        const ap = memoryCache.allPhotos.find(x => x.PhotoID === photoId);
        if (ap) {
            if (newNotes !== undefined) ap.Notes = newNotes;
            if (newTags !== undefined) ap.Tags = newTags;
        }
    }

    const snap = await getDoc(docRef);
    const data = snap.data();
    if (data && data.ProjectID) {
        await touchProject(data.ProjectID);
    }
    return data;
};

export const updatePhoto = async (photoId, newImageFile, newNotes, isMarkedUp = undefined, originalImageFile = undefined, newTags = undefined) => {
    let imageUrl = newImageFile;
    let origUrl = originalImageFile;
    const uploadTasks = [];

    if (newImageFile && newImageFile.startsWith('data:image')) {
        const storageRef = ref(storage, `users/${getUid()}/photos/${photoId}_markup_${Date.now()}.jpg`);
        uploadTasks.push(
            uploadString(storageRef, newImageFile, 'data_url')
                .then(() => getDownloadURL(storageRef))
                .then(url => { imageUrl = url; })
        );
    }

    if (originalImageFile && originalImageFile.startsWith('data:image')) {
        const oRef = ref(storage, `users/${getUid()}/photos/${photoId}_orig.jpg`);
        uploadTasks.push(
            uploadString(oRef, originalImageFile, 'data_url')
                .then(() => getDownloadURL(oRef))
                .then(url => { origUrl = url; })
        );
    }

    await Promise.all(uploadTasks);

    const docRef = doc(firestore, 'photos', photoId);
    const updates = {
        ImageFile: imageUrl,
        EditedAt: new Date().toISOString()
    };
    if (newNotes !== undefined) updates.Notes = newNotes;
    if (isMarkedUp !== undefined) updates.IsMarkedUp = isMarkedUp;
    if (origUrl !== undefined) updates.OriginalImageFile = origUrl;
    if (newTags !== undefined) updates.Tags = newTags;

    await setDoc(docRef, updates, { merge: true });

    Object.values(memoryCache.projectPhotos).forEach(photos => {
        const p = photos.find(x => x.PhotoID === photoId);
        if (p) {
            p.ImageFile = imageUrl;
            p.EditedAt = updates.EditedAt;
            if (newNotes !== undefined) p.Notes = newNotes;
            if (isMarkedUp !== undefined) p.IsMarkedUp = isMarkedUp;
            if (origUrl !== undefined) p.OriginalImageFile = origUrl;
            if (newTags !== undefined) p.Tags = newTags;
        }
    });

    if (memoryCache.allPhotos) {
        const ap = memoryCache.allPhotos.find(x => x.PhotoID === photoId);
        if (ap) {
            ap.ImageFile = imageUrl;
            ap.EditedAt = updates.EditedAt;
            if (newNotes !== undefined) ap.Notes = newNotes;
            if (isMarkedUp !== undefined) ap.IsMarkedUp = isMarkedUp;
            if (origUrl !== undefined) ap.OriginalImageFile = origUrl;
            if (newTags !== undefined) ap.Tags = newTags;
        }
    }

    const snap = await getDoc(docRef);
    const data = snap.data();
    if (data && data.ProjectID) {
        await touchProject(data.ProjectID);
    }
    return data;
};

export const deletePhoto = async (photoId) => {
    try {
        const docRef = doc(firestore, 'photos', photoId);
        const snap = await getDoc(docRef);
        let projectID = null;
        if (snap.exists()) {
            projectID = snap.data().ProjectID;
        }

        await deleteDoc(docRef);

        Object.keys(memoryCache.projectPhotos).forEach(pid => {
            memoryCache.projectPhotos[pid] = memoryCache.projectPhotos[pid].filter(p => p.PhotoID !== photoId);
        });
        if (memoryCache.allPhotos) {
            memoryCache.allPhotos = memoryCache.allPhotos.filter(p => p.PhotoID !== photoId);
        }
        
        memoryCache.allPhotos = null;
        memoryCache.projectPhotos = {};
        
        if (projectID) {
            await touchProject(projectID);
        }
    } catch (e) { console.error("Error deleting photo doc", e); }
    return true;
};

export const deleteTagGlobally = async (projectId, tagName) => {
    if (!projectId || !tagName) return;
    try {
        const q = query(collection(firestore, 'photos'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
        const snap = await getDocs(q);
        
        const updatePromises = [];
        for (const d of snap.docs) {
            const photo = d.data();
            if (photo.Tags && photo.Tags.includes(tagName)) {
                const newTags = photo.Tags.filter(t => t !== tagName);
                updatePromises.push(updateDoc(doc(firestore, 'photos', d.id), { Tags: newTags }));
            }
        }
        
        await Promise.all(updatePromises);
        await touchProject(projectId);
        clearDBCache();
        return true;
    } catch (e) {
        console.error("Error deleting tag globally", e);
        return false;
    }
};

export const renameTagGlobally = async (projectId, oldTagName, newTagName) => {
    if (!projectId || !oldTagName || !newTagName || oldTagName === newTagName) return;
    try {
        const q = query(collection(firestore, 'photos'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
        const snap = await getDocs(q);
        
        const updatePromises = [];
        for (const d of snap.docs) {
            const photo = d.data();
            if (photo.Tags && photo.Tags.includes(oldTagName)) {
                const newTags = Array.from(new Set(photo.Tags.map(t => t === oldTagName ? newTagName : t)));
                updatePromises.push(updateDoc(doc(firestore, 'photos', d.id), { Tags: newTags }));
            }
        }
        
        await Promise.all(updatePromises);
        await touchProject(projectId);
        clearDBCache();
        return true;
    } catch (e) {
        console.error("Error renaming tag globally", e);
        return false;
    }
};

// --- Project Folders (Rooms) ---
export const getProjectFolders = async (projectId) => {
    const q = query(collection(firestore, 'folders'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
    const snapshot = await getDocs(q);
    const folders = snapshot.docs.map(doc => ({ ...doc.data(), FolderID: doc.id }));
    return folders.sort((a, b) => {
        const timeA = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
        const timeB = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
        return timeA - timeB;
    });
};

export const subscribeToFoldersForProject = (projectId, callback) => {
    const q = query(collection(firestore, 'folders'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
    return onSnapshot(q, (snapshot) => {
        const folders = snapshot.docs.map(doc => ({ ...doc.data(), FolderID: doc.id }));
        const sortedFolders = folders.sort((a, b) => {
            const timeA = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
            const timeB = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
            return timeA - timeB;
        });
        callback(sortedFolders);
    });
};

export const getAllFolders = async () => {
    if (memoryCache.allFolders) return memoryCache.allFolders;
    const q = query(collection(firestore, 'folders'), where("userId", "==", getUid()));
    const snapshot = await getDocs(q);
    const folders = snapshot.docs.map(doc => ({ ...doc.data(), FolderID: doc.id }));
    memoryCache.allFolders = folders;
    return memoryCache.allFolders;
};

export const addProjectFolder = async (projectId, name, parentFolderId = null) => {
    const FolderID = `fld_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newFolder = {
        FolderID,
        ProjectID: projectId,
        userId: getUid(),
        Name: name,
        CreatedAt: new Date().toISOString(),
        ParentFolderID: parentFolderId
    };
    await setDoc(doc(firestore, 'folders', FolderID), newFolder);
    await touchProject(projectId);
    return { ...newFolder, FolderID };
};

export const updateProjectFolder = async (folderId, newName) => {
    const docRef = doc(firestore, 'folders', folderId);
    await updateDoc(docRef, { Name: newName });
    const snap = await getDoc(docRef);
    const data = snap.data();
    if (data && data.ProjectID) {
        await touchProject(data.ProjectID);
    }
    clearDBCache();
    return data;
};

export const deleteProjectFolder = async (folderId) => {
    // Phase 1: Identify all sub-folders recursively
    memoryCache.allFolders = null; 
    const allFolders = await getAllFolders();
    const folderIdsToDelete = [folderId];
    
    const findChildren = (parentId) => {
        const children = allFolders.filter(f => (f.ParentFolderID || null) === parentId);
        for (const child of children) {
            if (!folderIdsToDelete.includes(child.FolderID)) {
                folderIdsToDelete.push(child.FolderID);
                findChildren(child.FolderID);
            }
        }
    };
    findChildren(folderId);

    // Phase 2: Orphan all photos that were sitting inside any of these folders
    for (const fid of folderIdsToDelete) {
        const q = query(collection(firestore, 'photos'), where("userId", "==", getUid()), where("FolderID", "==", fid));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            await updateDoc(doc(firestore, 'photos', d.ref.id), { FolderID: deleteField() });
        }
    }

    // Phase 3: Safely destroy the folder metadata objects
    const firstFolderRef = doc(firestore, 'folders', folderId);
    const firstFolderSnap = await getDoc(firstFolderRef);
    let projectID = null;
    if (firstFolderSnap.exists()) {
        projectID = firstFolderSnap.data().ProjectID;
    }

    for (const fid of folderIdsToDelete) {
        await deleteDoc(doc(firestore, 'folders', fid));
    }
    
    clearDBCache();

    if (projectID) {
        await touchProject(projectID);
    }
    return true;
};

export const movePhotosToFolder = async (photoIds, folderId) => {
    // If folderId is null, it removes them from any folders (back to general root gallery)
    let lastPID = null;
    for (const pid of photoIds) {
        const docRef = doc(firestore, 'photos', pid);
        const snap = await getDoc(docRef);
        if (snap.exists()) lastPID = snap.data().ProjectID;

        if (folderId) {
            await updateDoc(docRef, { FolderID: folderId });
        } else {
            await updateDoc(docRef, { FolderID: deleteField() });
        }
    }
    clearDBCache();
    if (lastPID) await touchProject(lastPID);
    return true;
};

// --- Todos ---
export const getTodosForProject = async (projectId) => {
    const q = query(collection(firestore, 'todos'), where("userId", "==", getUid()), where("ProjectID", "==", projectId));
    const snapshot = await getDocs(q);
    const todos = snapshot.docs.map(doc => doc.data());
    return todos.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
};

export const addTodo = async (todoData) => {
    const TodoID = `td_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newTodo = {
        TodoID,
        userId: getUid(),
        Timestamp: new Date().toISOString(),
        IsCompleted: false,
        ...todoData
    };
    await setDoc(doc(firestore, 'todos', TodoID), newTodo);
    if (todoData.ProjectID) {
        await touchProject(todoData.ProjectID);
    }
    return newTodo;
};

export const toggleTodo = async (todoId) => {
    const docRef = doc(firestore, 'todos', todoId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const t = snap.data();
        await updateDoc(docRef, { IsCompleted: !t.IsCompleted });
        if (t.ProjectID) {
            await touchProject(t.ProjectID);
        }
        return { ...t, IsCompleted: !t.IsCompleted };
    }
    throw new Error("Todo not found");
};

export const deleteTodo = async (todoId) => {
    const docRef = doc(firestore, 'todos', todoId);
    const snap = await getDoc(docRef);
    let projectID = null;
    if (snap.exists()) {
        projectID = snap.data().ProjectID;
    }
    await deleteDoc(docRef);
    if (projectID) await touchProject(projectID);
    return true;
};

// --- Nuclear Account Deletion ---
export const scrubOrphanedPhotosByDocId = async () => {
    const photosSnap = await getDocs(query(collection(firestore, 'photos'), where("userId", "==", getUid())));
    const projectsSnap = await getDocs(query(collection(firestore, 'projects'), where("userId", "==", getUid())));

    const validProjectIds = new Set();
    projectsSnap.docs.forEach(doc => {
        validProjectIds.add(doc.id);
        if (doc.data().ProjectID) validProjectIds.add(doc.data().ProjectID);
    });

    let swept = false;
    for (const pDoc of photosSnap.docs) {
        if (!validProjectIds.has(pDoc.data().ProjectID)) {
            console.log("Physically destroying orphaned photograph document:", pDoc.id);
            await deleteDoc(doc(firestore, 'photos', pDoc.id));
            swept = true;
        }
    }

    if (swept) {
        clearDBCache();
    }
    return swept;
};

export const completelyDeleteUserAccount = async () => {
    const uid = getUid();

    // 1. Delete all photos (Firestore & Storage)
    const pq = query(collection(firestore, 'photos'), where("userId", "==", uid));
    const psnap = await getDocs(pq);
    for (const d of psnap.docs) {
        const pData = d.data();
        if (pData.ImageFile && pData.ImageFile.includes('firebasestorage.googleapis.com')) {
            try {
                const photoRef = ref(storage, pData.ImageFile);
                await deleteObject(photoRef);
            } catch (e) { console.warn("Could not delete photo from storage", e); }
        }
        await deleteDoc(doc(firestore, 'photos', d.ref.id));
    }

    // 2. Delete all todos
    const tq = query(collection(firestore, 'todos'), where("userId", "==", uid));
    const ts = await getDocs(tq);
    for (const d of ts.docs) {
        await deleteDoc(doc(firestore, 'todos', d.ref.id));
    }

    // 3. Delete all projects
    const prq = query(collection(firestore, 'projects'), where("userId", "==", uid));
    const prs = await getDocs(prq);
    for (const d of prs.docs) {
        await deleteDoc(doc(firestore, 'projects', d.ref.id));
    }

    // 4. Delete profile
    await deleteDoc(doc(firestore, 'users', uid));
    clearDBCache();

    return true;
};
