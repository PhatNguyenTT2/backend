import React, { useState, useEffect } from 'react';
import settingsService from '../../services/settingsService';

/**
 * FreshProductPromotionSettings Component
 * 
 * Auto-promotion settings for fresh products (category='fresh')
 * - Enable/disable auto promotion for expiring fresh products
 * - Configure promotion start time each day
 * - Set discount percentage for fresh products expiring today
 */
export const FreshProductPromotionSettings = () => {
  const [settings, setSettings] = useState({
    autoPromotionEnabled: false,
    promotionStartTime: '17:00', // Default 5 PM
    discountPercentage: 20, // Default 20% off
    applyToExpiringToday: true, // Apply to batches expiring within 24 hours
    applyToExpiringTomorrow: false // Apply to batches expiring within 48 hours
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsService.getSettings();
      if (response.success && response.data?.freshProductPromotion) {
        setSettings(response.data.freshProductPromotion);
      }
    } catch (error) {
      console.error('Failed to load fresh product promotion settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = () => {
    const newErrors = {};

    if (settings.discountPercentage < 0 || settings.discountPercentage > 100) {
      newErrors.discountPercentage = 'Discount must be between 0% and 100%';
    }

    if (!settings.promotionStartTime) {
      newErrors.promotionStartTime = 'Promotion start time is required';
    }

    if (!settings.applyToExpiringToday && !settings.applyToExpiringTomorrow) {
      newErrors.applyTo = 'Must select at least one option (today or tomorrow)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    setSaving(true);
    setSuccessMessage('');
    setErrors({});

    try {
      const response = await settingsService.updateSettings({
        freshProductPromotion: settings
      });

      if (response.success) {
        setSuccessMessage('✅ Fresh product promotion settings saved successfully!');

        // Restart scheduler with new settings
        try {
          await settingsService.restartPromotionScheduler();
          console.log('✅ Scheduler restarted with new settings');
        } catch (err) {
          console.error('Failed to restart scheduler:', err);
        }

        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setErrors({
        submit: error.response?.data?.error?.message || 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setSaving(true);
    setSuccessMessage('');
    setErrors({});

    try {
      const response = await settingsService.runPromotionNow();

      if (response.success) {
        setSuccessMessage(`✅ Promotion applied! ${response.data.applied} batches updated, ${response.data.removed} expired promotions removed.`);
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (error) {
      console.error('Failed to run promotion:', error);
      setErrors({
        submit: error.response?.data?.error?.message || 'Failed to run promotion'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <svg className="animate-spin h-8 w-8 text-orange-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🌿</span>
          <h2 className="text-[18px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Fresh Product Auto-Promotion Settings
          </h2>
        </div>
        <p className="text-[13px] text-gray-600 font-['Poppins',sans-serif]">
          Configure automatic promotion for fresh products (category='fresh') that are expiring soon.
          System will automatically apply discounts to batches based on expiry date.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-[13px] text-green-700 font-['Poppins',sans-serif]">
            {successMessage}
          </p>
        </div>
      )}

      {/* Error Message */}
      {errors.submit && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-[13px] text-red-700 font-['Poppins',sans-serif]">
            {errors.submit}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Enable Auto Promotion */}
        <div className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
          <input
            type="checkbox"
            id="autoPromotionEnabled"
            checked={settings.autoPromotionEnabled}
            onChange={(e) => handleChange('autoPromotionEnabled', e.target.checked)}
            className="mt-1 w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
          />
          <div className="flex-1">
            <label htmlFor="autoPromotionEnabled" className="block text-[14px] font-semibold text-gray-900 cursor-pointer">
              Enable Auto-Promotion for Fresh Products
            </label>
            <p className="text-[12px] text-gray-600 mt-1">
              When enabled, system will automatically apply discounts to fresh products based on expiry date and configured schedule
            </p>
          </div>
        </div>

        {/* Promotion Start Time */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-2">
            Daily Promotion Start Time <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={settings.promotionStartTime}
              onChange={(e) => handleChange('promotionStartTime', e.target.value)}
              disabled={!settings.autoPromotionEnabled}
              className={`px-4 py-2 border ${errors.promotionStartTime ? 'border-red-500' : 'border-gray-300'} rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
            <span className="text-[13px] text-gray-600">
              (Promotion will be applied automatically at this time each day)
            </span>
          </div>
          {errors.promotionStartTime && (
            <p className="mt-1 text-[11px] text-red-500">{errors.promotionStartTime}</p>
          )}
          <p className="mt-2 text-[11px] text-gray-500">
            ℹ️ Example: Set to 17:00 (5 PM) to start discounting fresh products in the evening
          </p>
        </div>

        {/* Discount Percentage */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-2">
            Discount Percentage <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={settings.discountPercentage}
              onChange={(e) => handleChange('discountPercentage', parseFloat(e.target.value))}
              min="0"
              max="100"
              step="5"
              disabled={!settings.autoPromotionEnabled}
              className={`w-32 px-4 py-2 border ${errors.discountPercentage ? 'border-red-500' : 'border-gray-300'} rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
            <span className="text-[13px] font-semibold text-gray-700">%</span>
            <div className="flex-1">
              <input
                type="range"
                value={settings.discountPercentage}
                onChange={(e) => handleChange('discountPercentage', parseFloat(e.target.value))}
                min="0"
                max="100"
                step="5"
                disabled={!settings.autoPromotionEnabled}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          {errors.discountPercentage && (
            <p className="mt-1 text-[11px] text-red-500">{errors.discountPercentage}</p>
          )}
          <p className="mt-2 text-[11px] text-gray-500">
            ℹ️ This discount will be applied to fresh product batches that meet the expiry criteria
          </p>
        </div>

        {/* Apply To Options */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-3">
            Apply Promotion To <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <input
                type="checkbox"
                id="applyToExpiringToday"
                checked={settings.applyToExpiringToday}
                onChange={(e) => handleChange('applyToExpiringToday', e.target.checked)}
                disabled={!settings.autoPromotionEnabled}
                className="mt-0.5 w-4 h-4 text-orange-600 rounded focus:ring-orange-500 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <label htmlFor="applyToExpiringToday" className="block text-[13px] font-medium text-gray-900 cursor-pointer">
                  Batches Expiring Today (within 24 hours)
                </label>
                <p className="text-[11px] text-gray-600 mt-1">
                  ⚠️ Highest priority - Products that expire within 24 hours
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <input
                type="checkbox"
                id="applyToExpiringTomorrow"
                checked={settings.applyToExpiringTomorrow}
                onChange={(e) => handleChange('applyToExpiringTomorrow', e.target.checked)}
                disabled={!settings.autoPromotionEnabled}
                className="mt-0.5 w-4 h-4 text-orange-600 rounded focus:ring-orange-500 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <label htmlFor="applyToExpiringTomorrow" className="block text-[13px] font-medium text-gray-900 cursor-pointer">
                  Batches Expiring Tomorrow (within 48 hours)
                </label>
                <p className="text-[11px] text-gray-600 mt-1">
                  Products that expire within 48 hours (early promotion)
                </p>
              </div>
            </div>
          </div>
          {errors.applyTo && (
            <p className="mt-2 text-[11px] text-red-500">{errors.applyTo}</p>
          )}
        </div>
        {/* Preview Box */}
        {settings.autoPromotionEnabled && (
          <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
            <h4 className="text-[13px] font-semibold text-orange-900 mb-2">Preview Configuration</h4>
            <div className="space-y-2 text-[12px] text-orange-800">
              <p>
                <strong>Start Time:</strong> {settings.promotionStartTime} (daily)
              </p>
              <p>
                <strong>Discount:</strong> {settings.discountPercentage}% OFF
              </p>
              <p>
                <strong>Applies To:</strong>
              </p>
              <ul className="list-disc list-inside ml-4">
                {settings.applyToExpiringToday && <li>Fresh products expiring within 24 hours</li>}
                {settings.applyToExpiringTomorrow && <li>Fresh products expiring within 48 hours</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            type="button"
            onClick={handleRunNow}
            disabled={saving || !settings.autoPromotionEnabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2"
            title="Run promotion immediately (for testing)"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Run Now
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={loadSettings}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                  </svg>
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
