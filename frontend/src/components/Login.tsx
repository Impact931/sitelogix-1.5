import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ForgotPasswordModal from './ForgotPasswordModal';
import NewPasswordRequired from './NewPasswordRequired';

interface LoginProps {
  onLoginSuccess?: (username: string, role: 'admin' | 'manager' | 'user') => void;
  onSwitchToLegacy?: () => void;
}

interface LoginCredentials {
  username: string;
  passcode: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess: _onLoginSuccess, onSwitchToLegacy: _onSwitchToLegacy }) => {
  const { login, refreshAuth, requirePasswordChange, tempUsername } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    passcode: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(credentials.username, credentials.passcode);
      // AuthContext will handle navigation via App.tsx
    } catch (err: any) {
      // Don't show error for NEW_PASSWORD_REQUIRED - component will handle it
      if (err.message !== 'NEW_PASSWORD_REQUIRED') {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
      setLoading(false);
    }
  };

  const handlePasswordChangeSuccess = async () => {
    // Refresh auth to get user data and complete login
    setLoading(true);
    try {
      await refreshAuth();
    } catch (err) {
      setError('Failed to complete login. Please try again.');
      setLoading(false);
    }
  };

  const handlePasswordChangeCancel = () => {
    setCredentials({ username: '', passcode: '' });
    setError(null);
    setLoading(false);
  };

  const handleLoginInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Show new password required screen if user needs to change password
  if (requirePasswordChange && tempUsername) {
    return (
      <NewPasswordRequired
        username={tempUsername}
        onSuccess={handlePasswordChangeSuccess}
        onCancel={handlePasswordChangeCancel}
      />
    );
  }

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
              Admin Login
            </h2>
            <p className="text-gray-400 text-sm">
              Enter your credentials to access the platform
            </p>
          </div>

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
                Password
              </label>
              <input
                id="passcode"
                type="password"
                value={credentials.passcode}
                onChange={(e) => handleLoginInputChange('passcode', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-gold hover:text-gold-light transition font-medium"
                disabled={loading}
              >
                Forgot password?
              </button>
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
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm">
          Need help? Contact your system administrator
        </p>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
};

export default Login;
