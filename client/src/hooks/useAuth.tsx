import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

interface User {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tenantId?: string;
  tenantName?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: { email: string; pin: string }) => Promise<{ success: boolean; message?: string }>;
  register: (data: Record<string, string>) => Promise<{ success: boolean; message?: string }>;
  updateProfile: (data: Record<string, string>) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
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

  const register = useCallback(async (data: Record<string, string>) => {
    try {
      const res = await authAPI.register(data);
      if (res.data.success) {
        localStorage.setItem('crm_token', res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (error) {
      return { success: false, message: (error as any).response?.data?.message || 'Registration failed' };
    }
  }, []);

  const login = useCallback(async (data: { email: string; pin: string }) => {
    try {
      const res = await authAPI.login(data);
      if (res.data.success) {
        localStorage.setItem('crm_token', res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (error) {
      return { success: false, message: (error as any).response?.data?.message || 'Login failed' };
    }
  }, []);

  const updateProfile = useCallback(async (data: Record<string, string>) => {
    try {
      const res = await authAPI.updateProfile(data);
      if (res.data.success) {
        setUser(prev => prev ? { ...prev, ...res.data.user } : null);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (error) {
      return { success: false, message: (error as any).response?.data?.message || 'Profile update failed' };
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
