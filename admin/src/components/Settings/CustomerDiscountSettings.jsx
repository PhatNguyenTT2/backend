import React, { useState, useEffect } from 'react';
import settingsService from '../../services/settingsService';

export const CustomerDiscountSettings = () => {
  const [discounts, setDiscounts] = useState({
    retail: 10,
    wholesale: 15,
    vip: 20
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load current settings on mount
  useEffect(() => {
    loadDiscounts();
  }, []);

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsService.getCustomerDiscounts();
      setDiscounts(response.data);
    } catch (err) {
      setError(err.error?.message || 'Failed to load discount settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (type, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setDiscounts(prev => ({
        ...prev,
        [type]: numValue
      }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validate before saving
      const validation = settingsService.validateDiscounts(discounts);
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        return;
      }

      await settingsService.updateCustomerDiscounts(discounts);

      setSuccess('✅ Discount settings updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.error?.message || 'Failed to update settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    console.log('🔄 handleReset called - Customer Discounts');
    try {
      setError(null);
      setSuccess(null);

      console.log('📡 Calling resetCustomerDiscounts API...');
      const response = await settingsService.resetCustomerDiscounts();
      console.log('📥 API Response:', response);

      if (response.success && response.data) {
        setDiscounts(response.data);
        setSuccess('✅ Settings reset to default values!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to reset settings');
      }
    } catch (err) {
      console.error('Error resetting discounts:', err);
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
            Customer Discount Configuration
          </h2>
          <p className="text-sm text-gray-600 mt-1 font-['Poppins',sans-serif]">
            Set default discount percentages for different customer types
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
          {/* Retail Discount */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                🛒 Retail Customers
              </label>
              <p className="text-xs text-gray-600 font-['Poppins',sans-serif]">
                Default discount for individual/retail customers
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discounts.retail}
                onChange={(e) => handleChange('retail', e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center font-semibold font-['Poppins',sans-serif]"
              />
              <span className="text-gray-700 font-semibold text-lg">%</span>
            </div>
          </div>

          {/* Wholesale Discount */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                📦 Wholesale Customers
              </label>
              <p className="text-xs text-gray-600 font-['Poppins',sans-serif]">
                Default discount for wholesale/bulk buyers
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discounts.wholesale}
                onChange={(e) => handleChange('wholesale', e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center font-semibold font-['Poppins',sans-serif]"
              />
              <span className="text-gray-700 font-semibold text-lg">%</span>
            </div>
          </div>

          {/* VIP Discount */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                ⭐ VIP Customers
              </label>
              <p className="text-xs text-gray-600 font-['Poppins',sans-serif]">
                Default discount for VIP/premium customers
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discounts.vip}
                onChange={(e) => handleChange('vip', e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-center font-semibold font-['Poppins',sans-serif]"
              />
              <span className="text-gray-700 font-semibold text-lg">%</span>
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

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 font-['Poppins',sans-serif]">
              How it works
            </h4>
            <p className="text-sm text-blue-700 mt-1 font-['Poppins',sans-serif]">
              These discount rates will be automatically applied when creating new orders based on the customer type.
              You can still override the discount for individual orders if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDiscountSettings;
