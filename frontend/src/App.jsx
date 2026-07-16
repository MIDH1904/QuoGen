import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Sun, LogOut, Settings, FileText, User as UserIcon } from 'lucide-react';
import Login from './pages/Login';
import Index from './pages/Index';
import Admin from './pages/Admin';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUserProfile();
    } else {
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token is invalid/expired
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifycontent: 'center',
        minHeight: '100vh',
        background: '#0b0f19',
        color: '#94a3b8',
        fontSize: '18px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <Sun size={48} color="#f59e0b" style={{ animation: 'spinSlow 2s linear infinite' }} />
          <span>Loading Roshni Solar...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {user && (
        <nav className="navbar">
          <Link to="/" className="nav-brand">
            <Sun size={26} />
            <span>ROSHNI SOLAR</span>
          </Link>
          <div className="nav-links">
            <Link to="/" className="nav-link">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} /> Quotation Creator
              </span>
            </Link>
            {user.role === 'admin' && (
              <Link to="/admin" className="nav-link">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Settings size={16} /> Admin Panel
                </span>
              </Link>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
              <span style={{ fontSize: '13.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserIcon size={14} /> {user.name} ({user.role})
              </span>
              <button onClick={handleLogout} className="btn-logout">
                <LogOut size={14} /> Logout
              </button>
            </div>
          </div>
        </nav>
      )}

      <Routes>
        <Route 
          path="/login" 
          element={!user ? <Login setToken={setToken} /> : (user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/" />)} 
        />
        <Route 
          path="/" 
          element={user ? <Index token={token} user={user} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/admin" 
          element={(user && user.role === 'admin') ? <Admin token={token} /> : <Navigate to="/login" />} 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
