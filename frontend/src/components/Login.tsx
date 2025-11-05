import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: (username: string, role: 'admin' | 'manager' | 'user') => void;
}

interface LoginCredentials {
  username: string;
  passcode: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    passcode: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Mock authentication - replace with real API call
  const mockUsers = {
    'admin': { passcode: '1234', role: 'admin' as const },
    'manager1': { passcode: '5678', role: 'manager' as const },
    'user1': { passcode: '9999', role: 'user' as const }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock validation
    const user = mockUsers[credentials.username as keyof typeof mockUsers];

    if (!user || user.passcode !== credentials.passcode) {
      setError('Invalid username or passcode');
      setLoading(false);
      return;
    }

    // Save credentials if remember me is checked
    if (rememberMe) {
      localStorage.setItem('sitelogix_remembered_user', credentials.username);
    } else {
      localStorage.removeItem('sitelogix_remembered_user');
    }

    setLoading(false);
    onLoginSuccess(credentials.username, user.role);
  };

  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
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

        {/* Login Form */}
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={credentials.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
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
                onChange={(e) => handleInputChange('passcode', e.target.value)}
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

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center mb-2">Demo Credentials:</p>
            <div className="space-y-1 text-xs text-gray-400 font-mono">
              <p>Admin: admin / 1234</p>
              <p>Manager: manager1 / 5678</p>
              <p>User: user1 / 9999</p>
            </div>
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
