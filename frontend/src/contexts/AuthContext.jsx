import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '../utils/constants';

const AuthContext = createContext(null);

export function useAuth() { 
  return useContext(AuthContext); 
}

const TOKEN_KEY = STORAGE_KEYS.TOKEN;
const TOKEN_EXPIRY_KEY = STORAGE_KEYS.TOKEN_EXPIRY;

const isTokenExpired = () => {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return new Date().getTime() > parseInt(expiry);
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const verifyToken = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      
      if (!token || isTokenExpired()) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        setUser(null);
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: { "Authorization": "Bearer " + token }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        setUser(null);
      }
    } catch (e) {
      console.error("Auth verification failed:", e);
      setUser(null);
    }
    setLoading(false);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    verifyToken();
    
    const interval = setInterval(() => {
      if (isTokenExpired()) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        setUser(null);
        window.location.href = "/login";
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [verifyToken]);

  const login = async (username, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        const expiryTime = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: "Erreur de connexion au serveur" };
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        await fetch("/api/auth/logout", { 
          method: "POST",
          headers: { "Authorization": "Bearer " + token }
        });
      }
    } catch (e) {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setUser(null);
    window.location.href = "/";
  };

  const hasPerm = (perm) => {
    if (!user) return false;
    if (user.grade_level === 99) return true;
    if (user.is_admin === true) return true;
    return user.grade_permissions && user.grade_permissions[perm] === true;
  };

  const refreshUser = async () => {
    await verifyToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, authChecked, login, logout, hasPerm, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
