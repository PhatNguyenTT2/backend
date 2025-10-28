import React, { useState } from 'react';
import userService from '../../services/userService';

export const ResetPasswordModal = ({ isOpen, onClose, user, onPasswordReset }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLoading(false);
      setError('');
      setFormData({
        newPassword: '',
        confirmPassword: ''
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen]);

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    setError('');
  };

  // Validate form
  const validateForm = () => {
    if (!formData.newPassword) {
      setError('Please enter a new password');
      return false;
    }

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (!formData.confirmPassword) {
      setError('Please confirm the password');
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  // Handle reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await userService.resetPassword(user.id, formData.newPassword);

      if (response.success) {
        // Show success and close
        alert(`Password reset successfully for user ${user.username}`);
        if (onPasswordReset) {
          onPasswordReset(user.id);
        }
        handleClose();
      }
    } catch (err) {
      setError(err.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setFormData({
      newPassword: '',
      confirmPassword: ''
    });
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-[18px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Reset Password
            </h2>
            <p className="text-[12px] font-normal font-['Poppins',sans-serif] text-gray-500 mt-1">
              Reset password for user: <span className="font-medium text-emerald-600">{user.username}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleResetPassword}>
          <div className="p-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
                  <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 6V10M10 14H10.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-[12px] font-['Poppins',sans-serif] text-red-600">{error}</p>
              </div>
            )}

            {/* User Information */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium font-['Poppins',sans-serif] text-gray-600">
                    User Code:
                  </span>
                  <span className="text-[12px] font-semibold font-['Poppins',sans-serif] text-emerald-600">
                    {user.userCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium font-['Poppins',sans-serif] text-gray-600">
                    Full Name:
                  </span>
                  <span className="text-[12px] font-medium font-['Poppins',sans-serif] text-[#212529]">
                    {user.fullName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium font-['Poppins',sans-serif] text-gray-600">
                    Email:
                  </span>
                  <span className="text-[12px] font-medium font-['Poppins',sans-serif] text-[#212529]">
                    {user.email}
                  </span>
                </div>
              </div>
            </div>

            {/* New Password Input */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  placeholder="Enter new password (min 6 characters)"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] text-[#212529] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.96 11.96C10.8204 12.8286 9.43313 13.3019 8 13.3C3.33333 13.3 1 8 1 8C1.87973 6.35697 3.13494 4.93755 4.66667 3.84667M6.6 2.82667C7.05963 2.71926 7.52906 2.66532 8 2.66667C12.6667 2.66667 15 8 15 8C14.5454 8.8571 13.9835 9.65742 13.3267 10.38L6.6 2.82667Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M1 1L15 15M6.36331 6.36331C6.13845 6.59229 5.96262 6.86561 5.84656 7.16632C5.7305 7.46702 5.67654 7.78895 5.67794 8.11363C5.67933 8.43831 5.73605 8.75969 5.85477 9.05933C5.97348 9.35897 6.15176 9.63069 6.37878 9.85771C6.6058 10.0847 6.87752 10.263 7.17716 10.3817C7.4768 10.5004 7.79818 10.5572 8.12286 10.5586C8.44754 10.56 8.76947 10.506 9.07017 10.39C9.37088 10.2739 9.6442 10.0981 9.87318 9.87325" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 8C1 8 3.54545 2.66667 8 2.66667C12.4545 2.66667 15 8 15 8C15 8 12.4545 13.3333 8 13.3333C3.54545 13.3333 1 8 1 8Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] text-[#212529] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.96 11.96C10.8204 12.8286 9.43313 13.3019 8 13.3C3.33333 13.3 1 8 1 8C1.87973 6.35697 3.13494 4.93755 4.66667 3.84667M6.6 2.82667C7.05963 2.71926 7.52906 2.66532 8 2.66667C12.6667 2.66667 15 8 15 8C14.5454 8.8571 13.9835 9.65742 13.3267 10.38L6.6 2.82667Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M1 1L15 15M6.36331 6.36331C6.13845 6.59229 5.96262 6.86561 5.84656 7.16632C5.7305 7.46702 5.67654 7.78895 5.67794 8.11363C5.67933 8.43831 5.73605 8.75969 5.85477 9.05933C5.97348 9.35897 6.15176 9.63069 6.37878 9.85771C6.6058 10.0847 6.87752 10.263 7.17716 10.3817C7.4768 10.5004 7.79818 10.5572 8.12286 10.5586C8.44754 10.56 8.76947 10.506 9.07017 10.39C9.37088 10.2739 9.6442 10.0981 9.87318 9.87325" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 8C1 8 3.54545 2.66667 8 2.66667C12.4545 2.66667 15 8 15 8C15 8 12.4545 13.3333 8 13.3333C3.54545 13.3333 1 8 1 8Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Warning Message */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-[12px] font-medium font-['Poppins',sans-serif] text-yellow-700">
                ⚠️ This will clear all active sessions. The user will need to log in again with the new password.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-[13px] font-medium font-['Poppins',sans-serif] text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.3337 7.33329H4.66699C3.92661 7.33329 3.33366 7.92625 3.33366 8.66663V13.3333C3.33366 14.0737 3.92661 14.6666 4.66699 14.6666H11.3337C12.074 14.6666 12.667 14.0737 12.667 13.3333V8.66663C12.667 7.92625 12.074 7.33329 11.3337 7.33329Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.33301 7.33329V4.66663C5.33301 3.78253 5.68419 2.93472 6.30931 2.3096C6.93444 1.68448 7.78225 1.33329 8.66634 1.33329C9.55044 1.33329 10.3982 1.68448 11.0234 2.3096C11.6485 2.93472 11.9997 3.78253 11.9997 4.66663V7.33329" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Reset Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
