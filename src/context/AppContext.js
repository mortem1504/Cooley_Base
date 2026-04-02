import React, { createContext, useContext, useMemo, useState } from 'react';
import { categories, starterJobs, starterUser } from '../data/mockData';

const AppContext = createContext(null);

function matchesSearch(job, query) {
  if (!query) {
    return true;
  }

  const target = `${job.title} ${job.description} ${job.category} ${job.location}`.toLowerCase();
  return target.includes(query.trim().toLowerCase());
}

export function AppProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [currentUser, setCurrentUser] = useState(starterUser);
  const [jobs, setJobs] = useState(starterJobs);
  const [filters, setFilters] = useState({
    search: '',
    category: categories[0],
    maxPrice: 50,
    maxDistance: 3,
  });

  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          matchesSearch(job, filters.search) &&
          (filters.category === 'All' || job.category === filters.category) &&
          job.price <= filters.maxPrice &&
          job.distance <= filters.maxDistance
      ),
    [filters, jobs]
  );

  const login = ({ name }) => {
    if (name) {
      setCurrentUser((prev) => ({ ...prev, name }));
    }
    setIsAuthenticated(true);
    setAuthMode('login');
  };

  const signup = ({ name, bio }) => {
    setCurrentUser((prev) => ({
      ...prev,
      name: name || prev.name,
      shortBio: bio || prev.shortBio,
      isVerified: true,
    }));
    setIsAuthenticated(true);
    setAuthMode('signup');
  };

  const logout = () => setIsAuthenticated(false);

  const postJob = (jobInput) => {
    const newJob = {
      id: `job-${Date.now()}`,
      title: jobInput.title,
      description: jobInput.description,
      price: Number(jobInput.price) || 0,
      location: jobInput.location,
      distance: 0.3,
      category: jobInput.category,
      date: jobInput.date,
      time: jobInput.time,
      urgent: jobInput.instantAccept,
      instantAccept: jobInput.instantAccept,
      status: 'posted',
      requester: {
        name: currentUser.name,
        rating: currentUser.rating,
        school: 'Seoul Global University',
      },
      coordinates: { top: '48%', left: '51%' },
    };

    setJobs((prev) => [newJob, ...prev]);
    return newJob;
  };

  const updateJobStatus = (jobId, status) => {
    setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, status } : job)));
  };

  const applyForJob = (jobId) => {
    setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, status: 'accepted' } : job)));
  };

  const instantAcceptJob = (jobId) => {
    setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, status: 'in progress' } : job)));
  };

  const cancelJob = (jobId) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, status: 'cancelled' } : job))
    );
  };

  const getJobById = (jobId) => jobs.find((job) => job.id === jobId);

  return (
    <AppContext.Provider
      value={{
        authMode,
        setAuthMode,
        isAuthenticated,
        currentUser,
        jobs,
        filters,
        filteredJobs,
        setFilters,
        login,
        signup,
        logout,
        postJob,
        updateJobStatus,
        applyForJob,
        instantAcceptJob,
        cancelJob,
        getJobById,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}
