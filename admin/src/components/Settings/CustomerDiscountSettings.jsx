import React, { useState, useEffect } from 'react';
import customerDiscountSettingsService from '../../services/customerDiscountSettingsService';
import employeeService from '../../services/employeeService';
import authService from '../../services/authService';
import { Clock, User, RotateCcw, History, X, Info } from 'lucide-react';

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
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [reason, setReason] = useState('');

  // Employee tracking for changedBy field
  const [currentUser, setCurrentUser] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  // Load current settings on mount
  useEffect(() => {
    loadDiscounts();
    loadCurrentEmployee();
  }, []);

  const loadDiscounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await customerDiscountSettingsService.getActiveDiscounts();
      setDiscounts(response.data);
    } catch (err) {
      setError(err.error?.message || 'Failed to load discount settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load current employee for changedBy field
  const loadCurrentEmployee = async () => {
    try {
      // Get user from authService (same as BulkModal)
      const user = authService.getUser();
      if (!user) {
        console.warn('No user found in localStorage');
        setError('Please log in to manage discount settings');
        return;
      }

      setCurrentUser(user);

      // Get employeeId from user object
      const employeeId = user.employeeId || user._id;

      if (!employeeId) {
        console.warn('No employeeId found in user object');
        setError('Employee ID not found. Please log in again.');
        return;
      }

      // Fetch employee details from API using employeeService (same as BulkModal)
      const employeeResponse = await employeeService.getEmployeeById(employeeId);
      console.log('Employee Response:', employeeResponse); // Debug log

      if (employeeResponse.success && employeeResponse.data) {
        // AddOrderModal uses employeeResponse.data.employee (nested structure)
        const employee = employeeResponse.data.employee;
        setCurrentEmployee(employee);
        console.log('Current employee loaded:', employee?.fullName);
      } else {
        console.warn('Employee not found for user:', user);
        setError('No active employee found. Please create an employee first.');
      }
    } catch (error) {
      console.error('Error loading current employee:', error);
      setError('Failed to load employee information');
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await customerDiscountSettingsService.getHistory(20);
      setHistory(response.data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) {
      loadHistory();
    }
    setShowHistory(!showHistory);
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

      // Validate employee first
      if (!currentEmployee) {
        setError('Employee information not loaded. Please refresh and try again.');
        return;
      }

      // Validate discount values
      for (const [type, value] of Object.entries(discounts)) {
        if (value < 0 || value > 100) {
          setError(`${type} discount must be between 0 and 100`);
          return;
        }
      }

      // Use current employee ID
      const employeeId = currentEmployee._id || currentEmployee.id;

      await customerDiscountSettingsService.updateDiscounts({
        retail: discounts.retail,
        wholesale: discounts.wholesale,
        vip: discounts.vip,
        reason: reason || 'Manual update',
        employeeId
      });

      setSuccess('Discount settings updated successfully! Changes apply to new orders only.');
      setReason('');

      // Reload history if visible
      if (showHistory) {
        loadHistory();
      }

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.message || err.error?.message || 'Failed to update settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset to default values (Retail: 10%, Wholesale: 15%, VIP: 20%)?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Validate employee first
      if (!currentEmployee) {
        setError('Employee information not loaded. Please refresh and try again.');
        return;
      }

      // Use current employee ID
      const employeeId = currentEmployee._id || currentEmployee.id;

      const response = await customerDiscountSettingsService.resetToDefaults({
        reason: 'Reset to default values',
        employeeId
      });

      if (response.success && response.data) {
        setDiscounts({
          retail: response.data.discounts.retail,
          wholesale: response.data.discounts.wholesale,
          vip: response.data.discounts.vip
        });
        setSuccess('Settings reset to default values!');

        // Reload history if visible
        if (showHistory) {
          loadHistory();
        }

        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to reset settings');
      }
    } catch (err) {
      console.error('Error resetting discounts:', err);
      const errorMessage = err.response?.data?.message
        || err.error?.message
        || err.message
        || 'Failed to reset settings';
      setError(errorMessage);
    }
  };

  const handleRollback = async (versionNumber) => {
    if (!window.confirm(`Are you sure you want to rollback to version ${versionNumber}?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Validate employee first
      if (!currentEmployee) {
        setError('Employee information not loaded. Please refresh and try again.');
        return;
      }

      // Use current employee ID
      const employeeId = currentEmployee._id || currentEmployee.id;

      const response = await customerDiscountSettingsService.rollbackToVersion({
        versionNumber,
        reason: `Rollback to version ${versionNumber}`,
        employeeId
      });

      if (response.success && response.data) {
        setDiscounts({
          retail: response.data.discounts.retail,
          wholesale: response.data.discounts.wholesale,
          vip: response.data.discounts.vip
        });
        setSuccess(`Successfully rolled back to version ${versionNumber}!`);
        loadHistory();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Error rolling back:', err);
      setError(err.response?.data?.message || 'Failed to rollback');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChangeSummary = (changes) => {
    if (!changes) return [];
    const summary = [];
    if (changes.retail) {
      summary.push(`Retail: ${changes.retail.from}% → ${changes.retail.to}%`);
    }
    if (changes.wholesale) {
      summary.push(`Wholesale: ${changes.wholesale.from}% → ${changes.wholesale.to}%`);
    }
    if (changes.vip) {
      summary.push(`VIP: ${changes.vip.from}% → ${changes.vip.to}%`);
    }
    return summary;
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
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 font-['Poppins',sans-serif]">
              Customer Discount Configuration
            </h2>
            <p className="text-sm text-gray-600 mt-1 font-['Poppins',sans-serif]">
              Set default discount percentages for different customer types
            </p>
          </div>
          <button
            onClick={toggleHistory}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <History className="w-4 h-4" />
            {showHistory ? 'Hide History' : 'View History'}
          </button>
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
        {/* History Panel */}
        {showHistory && (
          <div className="border-t border-gray-200 bg-gray-50">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 font-['Poppins',sans-serif] flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Change History
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center space-y-3">
                    <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-gray-500 text-sm font-['Poppins',sans-serif]">Loading history...</p>
                  </div>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-gray-500 font-['Poppins',sans-serif]">
                  No history available
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {history.map((version) => (
                    <div
                      key={version.version}
                      className={`bg-white rounded-lg p-4 border-2 ${version.isActive ? 'border-emerald-500 shadow-md' : 'border-gray-200'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Version Header */}
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${version.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                              }`}>
                              Version {version.version}
                            </span>
                            {version.isActive && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                                ACTIVE
                              </span>
                            )}
                          </div>

                          {/* Discount Values */}
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-xs text-gray-600 font-['Poppins',sans-serif]">Retail</div>
                              <div className="text-lg font-semibold text-gray-800 font-['Poppins',sans-serif]">
                                {version.discounts.retail}%
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-xs text-gray-600 font-['Poppins',sans-serif]">Wholesale</div>
                              <div className="text-lg font-semibold text-gray-800 font-['Poppins',sans-serif]">
                                {version.discounts.wholesale}%
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-xs text-gray-600 font-['Poppins',sans-serif]">VIP</div>
                              <div className="text-lg font-semibold text-gray-800 font-['Poppins',sans-serif]">
                                {version.discounts.vip}%
                              </div>
                            </div>
                          </div>

                          {/* Changes */}
                          {version.changes && getChangeSummary(version.changes).length > 0 && (
                            <div className="mb-2">
                              <div className="text-xs font-semibold text-gray-700 mb-1 font-['Poppins',sans-serif]">
                                Changes:
                              </div>
                              <div className="space-y-1">
                                {getChangeSummary(version.changes).map((change, idx) => (
                                  <div key={idx} className="text-xs text-gray-600 font-['Poppins',sans-serif] flex items-center gap-1">
                                    <span className="text-orange-500">•</span>
                                    {change}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="space-y-1 text-xs text-gray-600 font-['Poppins',sans-serif]">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(version.effectiveFrom)}</span>
                            </div>
                            {version.changedBy && (
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3" />
                                <span>{version.changedBy.fullName || version.changedBy.username || 'Unknown'}</span>
                              </div>
                            )}
                            {version.changeReason && (
                              <div className="flex items-start gap-2">
                                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span className="italic">{version.changeReason}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {!version.isActive && (
                          <button
                            onClick={() => handleRollback(version.version)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Rollback
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Settings Form */}
        <div className="p-6 space-y-6">
          {/* Reason Input */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2 font-['Poppins',sans-serif]">
              Reason for Change (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Seasonal promotion, Market adjustment, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-['Poppins',sans-serif] text-sm"
            />
            <p className="text-xs text-gray-600 mt-1 font-['Poppins',sans-serif]">
              This will be recorded in the audit trail for future reference
            </p>
          </div>
          {/* Retail Discount */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-800 mb-1 font-['Poppins',sans-serif]">
                Retail Customers
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
                Wholesale Customers
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
                VIP Customers
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
    </div>
  );
};

export default CustomerDiscountSettings;
