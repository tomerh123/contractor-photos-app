import React, { createContext, useContext, useState, useEffect } from 'react';
import * as db from './db';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = async () => {
        setLoading(true);
        const data = await db.getProjects();
        setProjects(data);
        setLoading(false);
    };

    const fetchProfile = async () => {
        const profile = await db.getProfile();
        setCurrentUser(profile);
    };

    useEffect(() => {
        db.initializeDB();
        fetchProjects();
        fetchProfile();
    }, []);

    const updateCurrentUser = async (updates) => {
        const newProfile = await db.updateProfile(updates);
        setCurrentUser(newProfile);
    };

    const value = {
        currentUser,
        projects,
        loading,
        refreshProjects: fetchProjects,
        updateCurrentUser
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
