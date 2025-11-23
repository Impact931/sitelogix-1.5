import React, { useState } from 'react';
import { confirmSignIn } from 'aws-amplify/auth';

interface NewPasswordRequiredProps {
  username: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const NewPasswordRequired: React.FC<NewPasswordRequiredProps> = ({ username, onSuccess, onCancel }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      await confirmSignIn({
        challengeResponse: newPassword,
      });

      // Password changed successfully, proceed with login
      onSuccess();
    } catch (err: any) {
      console.error('Change password error:', err);
      setLoading(false);

      if (err.name === 'InvalidPasswordException') {
        setError('Password does not meet requirements (must include uppercase, lowercase, number, and special character)');
      } else if (err.name === 'NotAuthorizedException') {
        setError('Session expired. Please try logging in again.');
      } else {
        setError(err.message || 'Failed to change password');
      }
    }
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
              Set New Password
            </h2>
            <p className="text-gray-400 text-sm">
              Welcome, {username}! Please set a new password for your account.
            </p>
          </div>

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-gray-300 mb-2">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                placeholder="Enter new password"
                required
                disabled={loading}
              />
              <p className="text-gray-400 text-xs mt-1">
                Must be at least 8 characters with uppercase, lowercase, number, and special character
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                placeholder="Confirm new password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full py-3 px-6 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-gold/20 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-dark-bg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Setting password...</span>
                </span>
              ) : (
                'Set Password'
              )}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full text-sm text-gray-400 hover:text-white transition font-medium mt-4"
              disabled={loading}
            >
              Cancel and return to login
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm">
          Need help? Contact your system administrator
        </p>
      </div>
    </div>
  );
};

export default NewPasswordRequired;
