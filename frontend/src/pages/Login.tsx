import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import './Auth.css';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [ssoProvider, setSsoProvider] = useState('default');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Support both email and username login
      const isEmail = loginId.includes('@');
      const payload = isEmail 
        ? { email: loginId, password }
        : { username: loginId, password };
        
      const response = await api.post('/auth/login', payload);
      
      // Store auth token
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Redirect based on role
      if (response.data.user.role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (response.data.user.role === 'ORG_ADMIN' || response.data.user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/elections');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const getApiBase = () => {
    const envBase = (import.meta as any)?.env?.VITE_API_URL;
    const base = (envBase || 'http://localhost:3000/api') as string;
    return base.replace(/\/$/, '');
  };

  const startSSO = (providerOverride?: string) => {
    const slug = orgSlug.trim();
    const provider = (providerOverride || ssoProvider).trim();
    if (!slug || !provider) {
      setError('Enter your organization slug and provider name to use SSO.');
      return;
    }

    const base = getApiBase();
    const url = `${base}/governance/sso/oidc/${encodeURIComponent(slug)}/${encodeURIComponent(provider)}/login`;
    window.location.href = url;
  };

  return (
    <div className={`auth-container ${darkMode ? 'dark-mode' : ''}`}>
      <div className="auth-card">
        <div className="auth-header">
          <h1>🔐 Login</h1>
          <p>Access your trustless voting account</p>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="loginId">Username or Email</label>
            <input
              id="loginId"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="username or email@example.com"
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? '⏳ Logging in...' : '🔓 Login'}
          </button>
        </form>

        <div className="oauth-divider">
          <span>or sign in with your organization</span>
        </div>

        <div className="oauth-buttons">
          <div className="form-group oauth-full">
            <label htmlFor="orgSlug">Organization slug</label>
            <input
              id="orgSlug"
              type="text"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              placeholder="e.g. baristas-local-12"
              disabled={loading}
            />
          </div>

          <div className="form-group oauth-full">
            <label htmlFor="ssoProvider">SSO provider</label>
            <input
              id="ssoProvider"
              type="text"
              value={ssoProvider}
              onChange={(e) => setSsoProvider(e.target.value)}
              placeholder="default (or google / microsoft / idme)"
              disabled={loading}
            />
          </div>

          <button
            type="button"
            className="btn btn-oauth btn-block"
            onClick={() => startSSO()}
            disabled={loading}
          >
            Continue with SSO
          </button>

          <button 
            type="button" 
            className="btn btn-oauth btn-google"
            onClick={() => startSSO('google')}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          
          <button 
            type="button" 
            className="btn btn-oauth btn-microsoft"
            onClick={() => startSSO('microsoft')}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#F25022" d="M1 1h10v10H1z"/>
              <path fill="#00A4EF" d="M1 13h10v10H1z"/>
              <path fill="#7FBA00" d="M13 1h10v10H13z"/>
              <path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
            Microsoft
          </button>
          
          <button 
            type="button" 
            className="btn btn-oauth btn-idme"
            onClick={() => startSSO('idme')}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <circle cx="12" cy="12" r="10" fill="#2B9540"/>
              <path fill="white" d="M12 6a2 2 0 100 4 2 2 0 000-4zm0 5c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            ID.me
          </button>
        </div>

        <div className="auth-footer">
          <p>
            Don't have an account? <a href="/register">Register here</a>
          </p>
        </div>
      </div>
    </div>
  );
}
