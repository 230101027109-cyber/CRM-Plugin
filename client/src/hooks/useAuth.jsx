import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      authAPI.verify().then(res => {
        if (res.data.success) {
          setUser(res.data.user);
        } else {
          localStorage.removeItem('crm_token');
        }
        setLoading(false);
      }).catch(() => {
        localStorage.removeItem('crm_token');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data) => {
    try {
      const res = await authAPI.register(data);
      if (res.data.success) {
        localStorage.setItem('crm_token', res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Registration failed' };
    }
  }, []);

  const login = useCallback(async (data) => {
    try {
      const res = await authAPI.login(data);
      if (res.data.success) {
        localStorage.setItem('crm_token', res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  }, []);

  const updateProfile = useCallback(async (data) => {
    try {
      const res = await authAPI.updateProfile(data);
      if (res.data.success) {
        setUser(prev => ({ ...prev, ...res.data.user }));
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Profile update failed' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('crm_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, updateProfile, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
