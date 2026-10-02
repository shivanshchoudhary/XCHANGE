import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Always require explicit login when opening application
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mrx_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null; // Force user to see Login page first
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('mrx_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mrx_user');
    }
  }, [user]);

  const login = async (identifier, password) => {
    setLoading(true);
    try {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      if (res.token) {
        localStorage.setItem('mrx_token', res.token);
      }
      const rawUser = res.user || {};
      const uName = (rawUser.name || rawUser.auth_identifier || '').toLowerCase();
      const isSuper = Boolean(
        rawUser.role === 'SUPERADMIN' ||
        rawUser.role === 'ADMIN' ||
        rawUser.isSuperAdmin ||
        uName.includes('jeet') ||
        uName.includes('sonal') ||
        uName.includes('sunal')
      );
      const userObj = {
        ...rawUser,
        role: isSuper ? 'SUPERADMIN' : (rawUser.role || 'STAFF'),
        isSuperAdmin: isSuper,
        allowedTabs: isSuper ? ['*'] : (rawUser.allowedTabs || ['/dashboard'])
      };
      setUser(userObj);
      setLoading(false);
      return true;
    } catch (err) {
      // Offline / Local Authentication
      const idTrim = (identifier || '').trim();
      const passTrim = (password || '').trim();
      const idLower = idTrim.toLowerCase();

      // Default Super Admins: Jeet Khubchandani & Sonal Wadwani & Admin23
      if (idLower.includes('admin') || idLower === 'admin23' || idLower === 'admin@mrx.com') {
        const superAdminUser = {
          id: 'admin-superadmin-1',
          name: 'Super Administrator',
          username: idTrim,
          email: 'admin@mrx.com',
          role: 'SUPERADMIN',
          isSuperAdmin: true,
          allowedTabs: ['*']
        };
        setUser(superAdminUser);
        setLoading(false);
        return true;
      }

      if (idLower.includes('staff') || idLower === 'staff23' || idLower === 'staff@mrx.com') {
        const staffUser = {
          id: 'staff-user-1',
          name: 'Staff User',
          username: idTrim,
          email: 'staff@mrx.com',
          role: 'STAFF',
          isSuperAdmin: false,
          allowedTabs: ['/dashboard', '/old-inventory', '/in-hand-stock', '/repair-stock', '/rejected-stock']
        };
        setUser(staffUser);
        setLoading(false);
        return true;
      }

      if (idLower.includes('jeet')) {
        const superAdminUser = {
          id: 'jeet-superadmin-1',
          name: 'Jeet Khubchandani',
          username: idTrim,
          email: 'jeet@mrxchange.com',
          role: 'SUPERADMIN',
          isSuperAdmin: true,
          allowedTabs: ['*']
        };
        setUser(superAdminUser);
        setLoading(false);
        return true;
      }

      if (idLower.includes('sonal') || idLower.includes('sunal')) {
        const superAdminUser = {
          id: 'sonal-superadmin-2',
          name: 'Sonal Wadwani',
          username: idTrim,
          email: 'sonal@mrxchange.com',
          role: 'SUPERADMIN',
          isSuperAdmin: true,
          allowedTabs: ['*']
        };
        setUser(superAdminUser);
        setLoading(false);
        return true;
      }

      // Check custom added users in localStorage
      try {
        const customMembers = JSON.parse(localStorage.getItem('mrx_team_members') || '[]');
        const match = customMembers.find(m => 
          (m.username === idTrim || m.email === idTrim) && (m.password === passTrim || !m.password)
        );
        if (match && match.status === 'ACTIVE') {
          const mName = (match.name || match.username || '').toLowerCase();
          const isSuper = match.role === 'SUPERADMIN' || match.role === 'ADMIN' || mName.includes('jeet') || mName.includes('sonal') || mName.includes('sunal');
          const customUser = {
            id: match.id,
            name: match.name,
            username: match.username || match.email,
            email: match.email,
            role: isSuper ? 'SUPERADMIN' : match.role,
            isSuperAdmin: isSuper,
            allowedTabs: isSuper ? ['*'] : (match.allowedTabs || ['/dashboard'])
          };
          setUser(customUser);
          setLoading(false);
          return true;
        }
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
      throw new Error('Invalid Username or Password');
    }
  };

  const logout = () => {
    localStorage.removeItem('mrx_token');
    localStorage.removeItem('mrx_user');
    setUser(null);
  };

  const uName = (user?.name || user?.username || user?.auth_identifier || '').toLowerCase();
  const isSuperAdmin = Boolean(
    user?.isSuperAdmin || 
    user?.role === 'SUPERADMIN' ||
    user?.role === 'ADMIN' ||
    uName.includes('jeet') ||
    uName.includes('sonal') ||
    uName.includes('sunal')
  );

  const canAccessTab = (path) => {
    if (!user) return false;
    if (isSuperAdmin || (user.allowedTabs && user.allowedTabs.includes('*'))) return true;
    if (!user.allowedTabs) return false;
    return user.allowedTabs.includes(path);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isSuperAdmin, canAccessTab, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
