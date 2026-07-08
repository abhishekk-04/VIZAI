import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate or retrieve a unique tab-session token
    let storedToken = sessionStorage.getItem('token');
    if (!storedToken) {
      storedToken = 'session_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('token', storedToken);
    }
    
    setToken(storedToken);
    setUser({ username: storedToken, email: `${storedToken}@vizai.local` });
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
