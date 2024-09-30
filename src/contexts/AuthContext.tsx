import React, { createContext, useContext, ReactNode, useState } from 'react';
import useAuth from '../hooks/useAuth';
import { User } from '../types/User';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  authorized: boolean;
  fetchUserData: (userId: number) => void;
  startTasksCount: number;
  setStartTasksCount: React.Dispatch<React.SetStateAction<number>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading, error, authorized, fetchUserData } = useAuth();
  const [startTasksCount, setStartTasksCount] = useState(0);

  return (
    <AuthContext.Provider value={{ user, loading, error, authorized, fetchUserData, startTasksCount, setStartTasksCount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
