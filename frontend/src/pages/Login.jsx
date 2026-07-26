import React, { useState } from 'react';
import { Sun } from 'lucide-react';

export default function Login({ setToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
      } else {
        setError(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      console.error('Login request error:', err);
      setError('Connection error. Please check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userEmail, userPass) => {
    setEmail(userEmail);
    setPassword(userPass);
  };

  return (
    <div className="login-wrapper">
      <div className="glass-card login-card">
        <div className="login-logo">
          <Sun size={48} />
          <h2>ROSHNI SOLAR</h2>
          <span style={{ fontSize: '13px', color: '#94a3b8', letterSpacing: '1px' }}>QUOTATION MANAGER</span>
        </div>

        {error && (
          <div className="alert-box alert-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="e.g. admin@roshnisolar.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="login-tips" style={{ marginTop: '25px' }}>
          <strong>Testing Accounts:</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Admin: admin@roshnisolar.in / admin123</span>
              <button 
                type="button"
                onClick={() => fillCredentials('admin@roshnisolar.in', 'admin123')}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Use
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>User: user@roshnisolar.in / user123</span>
              <button 
                type="button"
                onClick={() => fillCredentials('user@roshnisolar.in', 'user123')}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Use
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
