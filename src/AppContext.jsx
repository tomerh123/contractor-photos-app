import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import * as db from './db';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = async (uid) => {
        const data = await db.getProjects(uid);
        setProjects(data);
    };

    const refreshProfile = async (uid) => {
        const profile = await db.getProfile(uid);
        if (profile) {
            setCurrentUser({ ...profile, uid });
            await fetchProjects(uid);
        } else {
            setCurrentUser(null);
        }
    };

    useEffect(() => {
        // We still call initializeDB to set up basic mock structure if needed for legacy migration
        db.initializeDB();

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            db.clearDBCache();
            if (user) {
                await refreshProfile(user.uid);
            } else {
                setCurrentUser(null);
                setProjects([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateCurrentUser = async (updates) => {
        if (!currentUser?.uid) return;
        await db.updateProfile(currentUser.uid, updates);
        setCurrentUser(prev => ({ ...prev, ...updates }));
    };

    const value = {
        currentUser,
        projects,
        loading,
        refreshProjects: fetchProjects,
        updateCurrentUser,
        refreshProfile
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
