import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onLoginSuccess?: (username: string, role: 'admin' | 'manager' | 'user') => void;
  onSwitchToLegacy?: () => void;
}

interface LoginCredentials {
  username: string;
  passcode: string;
}

interface RegisterCredentials {
  username: string;
  passcode: string;
  email: string;
  firstName: string;
  lastName: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const Login: React.FC<LoginProps> = ({ onLoginSuccess: _onLoginSuccess, onSwitchToLegacy: _onSwitchToLegacy }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    passcode: ''
  });
  const [registerData, setRegisterData] = useState<RegisterCredentials>({
    username: '',
    passcode: '',
    email: '',
    firstName: '',
    lastName: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await login(credentials.username, credentials.passcode, rememberMe);
      // AuthContext will handle navigation via App.tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess('Account created successfully! You can now log in.');
      setMode('login');
      setCredentials({
        username: registerData.username,
        passcode: registerData.passcode
      });
      setRegisterData({
        username: '',
        passcode: '',
        email: '',
        firstName: '',
        lastName: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleRegisterInputChange = (field: keyof RegisterCredentials, value: string) => {
    setRegisterData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Header */}
        <div className="text-center">
          <h1 className="text-5xl font-display font-bold text-white mb-2">
            SiteLogix
          </h1>
          <p className="text-gray-400 text-lg font-medium">
            Construction Management Platform
          </p>
        </div>

        {/* Form Container */}
        <div className="glass-gold rounded-2xl p-8 border border-gold/20">
          <div className="mb-6">
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              {mode === 'login' ? 'Admin Login' : 'Create Account'}
            </h2>
            <p className="text-gray-400 text-sm">
              {mode === 'login'
                ? 'Enter your credentials to access the platform'
                : 'Register a new superadmin account'}
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-green-400 text-sm font-medium">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-400 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-300 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => handleLoginInputChange('username', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                />
              </div>

              {/* Passcode Field */}
              <div>
                <label htmlFor="passcode" className="block text-sm font-semibold text-gray-300 mb-2">
                  Passcode
                </label>
                <input
                  id="passcode"
                  type="password"
                  value={credentials.passcode}
                  onChange={(e) => handleLoginInputChange('passcode', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  placeholder="Enter your passcode"
                  required
                  disabled={loading}
                />
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-gold focus:ring-2 focus:ring-gold/50 transition cursor-pointer"
                  disabled={loading}
                />
                <label htmlFor="remember-me" className="ml-2 text-sm text-gray-400 cursor-pointer">
                  Remember me
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !credentials.username || !credentials.passcode}
                className="w-full py-3 px-6 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-gold/20 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-dark-bg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Signing in...</span>
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-semibold text-gray-300 mb-2">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={registerData.firstName}
                  onChange={(e) => handleRegisterInputChange('firstName', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  placeholder="Enter your first name"
                  required
                  disabled={loading}
                />
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-semibold text-gray-300 mb-2">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={registerData.lastName}
                  onChange={(e) => handleRegisterInputChange('lastName', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  placeholder="Enter your last name"
                  required
                  disabled={loading}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={registerData.email}
                  onChange={(e) => handleRegisterInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                />
              </div>

              {/* Username */}
              <div>
                <label htmlFor="reg-username" className="block text-sm font-semibold text-gray-300 mb-2">
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  value={registerData.username}
                  onChange={(e) => handleRegisterInputChange('username', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  placeholder="Choose a username"
                  required
                  disabled={loading}
                />
              </div>

              {/* Passcode */}
              <div>
                <label htmlFor="reg-passcode" className="block text-sm font-semibold text-gray-300 mb-2">
                  Passcode
                </label>
                <input
                  id="reg-passcode"
                  type="password"
                  value={registerData.passcode}
                  onChange={(e) => handleRegisterInputChange('passcode', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  placeholder="Choose a secure passcode"
                  required
                  disabled={loading}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !registerData.username || !registerData.passcode || !registerData.email || !registerData.firstName || !registerData.lastName}
                className="w-full py-3 px-6 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-gold/20 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-dark-bg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Creating account...</span>
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          {/* Toggle Mode Link */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
                setSuccess(null);
              }}
              className="text-sm text-gold hover:text-gold-light transition font-medium"
              disabled={loading}
            >
              {mode === 'login'
                ? 'Need an account? Create one here'
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm">
          Need help? Contact your system administrator
        </p>
      </div>
    </div>
  );
};

export default Login;
