import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  registerUser,
  loginUser as loginUserService,
  getCurrentUser,
  saveCurrentUser,
  logoutUser,
} from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app start
  useEffect(() => {
    const loadSession = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch {
        // No session found
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const register = async (name, email, password) => {
    const result = await registerUser(name, email, password);
    if (result.success) {
      setUser(result.user);
      await saveCurrentUser(result.user);
    }
    return result;
  };

  const login = async (email, password) => {
    const result = await loginUserService(email, password);
    if (result.success) {
      setUser(result.user);
      await saveCurrentUser(result.user);
    }
    return result;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
