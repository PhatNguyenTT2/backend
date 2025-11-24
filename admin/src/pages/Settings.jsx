import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { Settings as SettingsIcon, Percent, Shield, Leaf } from 'lucide-react';
import settingsService from '../services/settingsService';
import { FreshProductPromotionSettings } from '../components/Settings';

export const Settings = () => {
  // Customer Discounts State
  const [discounts, setDiscounts] = useState({
    retail: 10,
    wholesale: 15,
    vip: 20
  });
  const [discountsLoading, setDiscountsLoading] = useState(true);
  const [discountsSaving, setDiscountsSaving] = useState(false);
  const [discountsError, setDiscountsError] = useState(null);
  const [discountsSuccess, setDiscountsSuccess] = useState(null);

  // POS Security State
  const [security, setSecurity] = useState({
    maxFailedAttempts: 5,
    lockDurationMinutes: 15
  });
  const [securityLoading, setSecurityLoading] = useState(true);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityError, setSecurityError] = useState(null);
  const [securitySuccess, setSecuritySuccess] = useState(null);

  const breadcrumbItems = [
    { label: 'Dashboard', link: '/dashboard' },
    { label: 'System Settings' }
  ];

  // Load settings on mount
  useEffect(() => {
    loadDiscounts();
    loadSecurity();
  }, []);

  // ============ CUSTOMER DISCOUNTS HANDLERS ============
  const loadDiscounts = async () => {
    try {
      setDiscountsLoading(true);
      setDiscountsError(null);
      const response = await settingsService.getCustomerDiscounts();
      setDiscounts(response.data);
    } catch (err) {
      setDiscountsError(err.error?.message || 'Failed to load discount settings');
      console.error(err);
    } finally {
      setDiscountsLoading(false);
    }
  };

  const handleDiscountChange = (type, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setDiscounts(prev => ({ ...prev, [type]: numValue }));
    }
  };

  const handleSaveDiscounts = async () => {
    try {
      setDiscountsSaving(true);
      setDiscountsError(null);
      setDiscountsSuccess(null);

      const validation = settingsService.validateDiscounts(discounts);
      if (!validation.valid) {
        setDiscountsError(validation.errors.join(', '));
        return;
      }

      await settingsService.updateCustomerDiscounts(discounts);
      setDiscountsSuccess('Discount settings updated successfully');
      setTimeout(() => setDiscountsSuccess(null), 3000);
    } catch (err) {
      setDiscountsError(err.error?.message || 'Failed to update settings');
      console.error(err);
    } finally {
      setDiscountsSaving(false);
    }
  };

  const handleResetDiscounts = async () => {
    console.log('🔄 handleResetDiscounts called - Settings Page');
    try {
      setDiscountsError(null);
      setDiscountsSuccess(null);

      console.log('📡 Calling resetCustomerDiscounts API...');
      const response = await settingsService.resetCustomerDiscounts();
      console.log('📥 API Response:', response);

      if (response.success && response.data) {
        setDiscounts(response.data);
        setDiscountsSuccess('Settings reset to default values!');
        setTimeout(() => setDiscountsSuccess(null), 3000);
      } else {
        setDiscountsError('Failed to reset settings');
      }
    } catch (err) {
      console.error('Error resetting discounts:', err);
      const errorMessage = err.response?.data?.error?.message
        || err.error?.message
        || err.message
        || 'Failed to reset settings';
      setDiscountsError(errorMessage);
    }
  };

  // ============ POS SECURITY HANDLERS ============
  const loadSecurity = async () => {
    try {
      setSecurityLoading(true);
      setSecurityError(null);
      const response = await settingsService.getPOSSecurity();
      setSecurity(response.data);
    } catch (err) {
      setSecurityError(err.error?.message || 'Failed to load POS security settings');
      console.error(err);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleSecurityChange = (field, value) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setSecurity(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const handleSaveSecurity = async () => {
    try {
      setSecuritySaving(true);
      setSecurityError(null);
      setSecuritySuccess(null);

      const validation = settingsService.validatePOSSecurity(security);
      if (!validation.valid) {
        setSecurityError(validation.errors.join(', '));
        return;
      }

      await settingsService.updatePOSSecurity(security);
      setSecuritySuccess('POS security settings updated successfully');
      setTimeout(() => setSecuritySuccess(null), 3000);
    } catch (err) {
      setSecurityError(err.error?.message || 'Failed to update settings');
      console.error(err);
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleResetSecurity = async () => {
    console.log('🔄 handleResetSecurity called - Settings Page');
    try {
      setSecurityError(null);
      setSecuritySuccess(null);

      console.log('📡 Calling resetPOSSecurity API...');
      const response = await settingsService.resetPOSSecurity();
      console.log('📥 API Response:', response);

      if (response.success && response.data) {
        setSecurity(response.data);
        setSecuritySuccess('Settings reset to default values!');
        setTimeout(() => setSecuritySuccess(null), 3000);
      } else {
        setSecurityError('Failed to reset settings');
      }
    } catch (err) {
      console.error('Error resetting POS security:', err);
      const errorMessage = err.response?.data?.error?.message
        || err.error?.message
        || err.message
        || 'Failed to reset settings';
      setSecurityError(errorMessage);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Page Header */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529] flex items-center gap-2">
                <SettingsIcon className="w-6 h-6" />
                System Settings
              </h1>
              <p className="text-[13px] text-gray-600 mt-1 font-['Poppins',sans-serif]">
                Configure system-wide settings and preferences
              </p>
            </div>
          </div>
        </div>

        {/* Customer Discounts Section */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Section Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-emerald-600" />
              <h2 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Customer Discount Configuration
              </h2>
            </div>
            <p className="text-[13px] text-gray-600 mt-1 font-['Poppins',sans-serif]">
              Set default discount percentages for different customer types
            </p>
          </div>

          {/* Alert Messages */}
          {discountsError && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
              {discountsError}
            </div>
          )}
          {discountsSuccess && (
            <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
              {discountsSuccess}
            </div>
          )}

          {/* Loading State */}
          {discountsLoading ? (
            <div className="p-12 text-center">
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-600 text-[13px] font-['Poppins',sans-serif]">Loading settings...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Settings Form */}
              <div className="p-6 space-y-4">
                {/* Retail Discount */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-1">
                      🛒 Retail Customers
                    </label>
                    <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif]">
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
                      onChange={(e) => handleDiscountChange('retail', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-semibold font-['Poppins',sans-serif] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-700 font-semibold text-[14px]">%</span>
                  </div>
                </div>

                {/* Wholesale Discount */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-1">
                      📦 Wholesale Customers
                    </label>
                    <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif]">
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
                      onChange={(e) => handleDiscountChange('wholesale', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-semibold font-['Poppins',sans-serif] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-700 font-semibold text-[14px]">%</span>
                  </div>
                </div>

                {/* VIP Discount */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-1">
                      ⭐ VIP Customers
                    </label>
                    <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif]">
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
                      onChange={(e) => handleDiscountChange('vip', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-semibold font-['Poppins',sans-serif] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-700 font-semibold text-[14px]">%</span>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-[13px] font-semibold text-blue-900 font-['Poppins',sans-serif]">
                        How it works
                      </h4>
                      <p className="text-[12px] text-blue-700 mt-1 font-['Poppins',sans-serif]">
                        These discount rates will be automatically applied when creating new orders based on the customer type.
                        You can still override the discount for individual orders if needed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleResetDiscounts}
                  disabled={discountsSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSaveDiscounts}
                  disabled={discountsSaving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {discountsSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* POS Security Section */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Section Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h2 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                POS Security Configuration
              </h2>
            </div>
            <p className="text-[13px] text-gray-600 mt-1 font-['Poppins',sans-serif]">
              Configure security settings for POS PIN authentication
            </p>
          </div>

          {/* Alert Messages */}
          {securityError && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
              {securityError}
            </div>
          )}
          {securitySuccess && (
            <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
              {securitySuccess}
            </div>
          )}

          {/* Loading State */}
          {securityLoading ? (
            <div className="p-12 text-center">
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-600 text-[13px] font-['Poppins',sans-serif]">Loading settings...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Settings Form */}
              <div className="p-6 space-y-4">
                {/* Max Failed Attempts */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-1">
                      🔒 Maximum Failed Attempts
                    </label>
                    <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif]">
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
                      onChange={(e) => handleSecurityChange('maxFailedAttempts', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-semibold font-['Poppins',sans-serif] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-700 font-medium text-[12px]">attempts</span>
                  </div>
                </div>

                {/* Lock Duration */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-1">
                      ⏱️ Lock Duration
                    </label>
                    <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif]">
                      How long to lock account after max failed attempts (1-1440 minutes)
                    </p>
                    <p className="text-[11px] text-emerald-600 mt-1 font-['Poppins',sans-serif]">
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
                      onChange={(e) => handleSecurityChange('lockDurationMinutes', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-semibold font-['Poppins',sans-serif] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-700 font-medium text-[12px]">minutes</span>
                  </div>
                </div>

                {/* Warning Box */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-[13px] font-semibold text-amber-900 font-['Poppins',sans-serif]">
                        Important Security Notice
                      </h4>
                      <p className="text-[12px] text-amber-700 mt-1 font-['Poppins',sans-serif]">
                        These settings affect all POS terminals. Account lockouts help prevent unauthorized access through brute-force attacks.
                        PIN length is fixed at 4-6 digits for optimal security and usability.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleResetSecurity}
                  disabled={securitySaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSaveSecurity}
                  disabled={securitySaving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {securitySaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Fresh Product Auto-Promotion Section */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Section Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-orange-600" />
              <h2 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Fresh Product Auto-Promotion
              </h2>
            </div>
            <p className="text-[13px] text-gray-600 mt-1 font-['Poppins',sans-serif]">
              Automatically apply promotions to fresh products (category='fresh') based on expiry date
            </p>
          </div>

          {/* Component */}
          <div className="p-6">
            <FreshProductPromotionSettings />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
