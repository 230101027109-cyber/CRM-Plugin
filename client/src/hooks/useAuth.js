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

  const login = useCallback(async (pin) => {
    const res = await authAPI.login(pin);
    if (res.data.success) {
      localStorage.setItem('crm_token', res.data.token);
      setUser(res.data.user);
      return { success: true };
    }
    return { success: false, message: res.data.message };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('crm_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
