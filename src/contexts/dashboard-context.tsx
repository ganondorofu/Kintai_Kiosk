'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAllUsers, getAllTeams } from '@/lib/data-adapter';
import type { AppUser, Team } from '@/types';

interface DashboardContextType {
  allUsers: AppUser[];
  allTeams: Team[];
  isLoading: boolean;
  refreshData: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [users, teams] = await Promise.all([
        getAllUsers(),
        getAllTeams()
      ]);
      setAllUsers(users);
      setAllTeams(teams);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DashboardContext.Provider value={{ allUsers, allTeams, isLoading, refreshData: fetchData }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
