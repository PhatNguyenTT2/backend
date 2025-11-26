import React, { useState, useEffect } from 'react';
import settingsService from '../../services/settingsService';

export const POSSecuritySettings = () => {
  const [security, setSecurity] = useState({
    maxFailedAttempts: 5,
    lockDurationMinutes: 15
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load current settings on mount
  useEffect(() => {
    loadSecurity();
  }, []);

  const loadSecurity = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsService.getPOSSecurity();
      setSecurity(response.data);
    } catch (err) {
      setError(err.error?.message || 'Failed to load POS security settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setSecurity(prev => ({
        ...prev,
        [field]: numValue
      }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validate before saving
      const validation = settingsService.validatePOSSecurity(security);
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        return;
      }

      await settingsService.updatePOSSecurity(security);

      setSuccess('POS security settings updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.error?.message || 'Failed to update settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    console.log('handleReset called - POS Security');
    try {
      setError(null);
      setSuccess(null);

      console.log('Calling resetPOSSecurity API...');
      const response = await settingsService.resetPOSSecurity();
      console.log('API Response:', response);

      if (response.success && response.data) {
        setSecurity(response.data);
        setSuccess('Settings reset to default values!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to reset settings');
      }
    } catch (err) {
      console.error('Error resetting POS security:', err);
      const errorMessage = err.response?.data?.error?.message
        || err.error?.message
        || err.message
        || 'Failed to reset settings';
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 text-sm font-['Poppins',sans-serif]">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 font-['Poppins',sans-serif]">
            POS Security Configuration
          </h2>
          <p className="text-sm text-gray-600 mt-1 font-['Poppins',sans-serif]">
            Configure security settings for POS PIN authentication
          </p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-['Poppins',sans-serif]">{error}</span>
            </div>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-['Poppins',sans-serif]">{success}</span>
            </div>
          </div>
        )}

        {/* Settings Form */}
        <div className="p-6 space-y-6">
          {/* Max Failed Attempts */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                🔒 Maximum Failed Attempts
              </label>
              <p className="text-xs text-gray-600 font-['Poppins',sans-serif]">
                Number of failed PIN attempts before account is locked (1-10)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max="10"
                step="1"
                value={security.maxFailedAttempts}
                onChange={(e) => handleChange('maxFailedAttempts', e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center font-semibold font-['Poppins',sans-serif]"
              />
              <span className="text-gray-700 font-semibold text-sm">attempts</span>
            </div>
          </div>

          {/* Lock Duration */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                ⏱️ Lock Duration
              </label>
              <p className="text-xs text-gray-600 font-['Poppins',sans-serif]">
                How long to lock account after max failed attempts (1-1440 minutes)
              </p>
              <p className="text-xs text-emerald-600 mt-1 font-['Poppins',sans-serif]">
                Current: {settingsService.formatLockDuration(security.lockDurationMinutes)}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max="1440"
                step="1"
                value={security.lockDurationMinutes}
                onChange={(e) => handleChange('lockDurationMinutes', e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center font-semibold font-['Poppins',sans-serif]"
              />
              <span className="text-gray-700 font-semibold text-sm">minutes</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors font-['Poppins',sans-serif] text-sm font-medium"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center space-x-2 font-['Poppins',sans-serif] text-sm font-medium"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSSecuritySettings;
