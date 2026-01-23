import React, { useState } from 'react';
import { User, Users, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import customerService from '../../services/customerService';

export const CustomerUpgradeModal = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState('criteria'); // criteria, preview
  const [targetType, setTargetType] = useState('wholesale');
  const [minSpent, setMinSpent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eligibleCustomers, setEligibleCustomers] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);

  // Format currency to VND locally since utils/currency.js was deleted
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount || 0);
  };

  // Reset state when modal opens/closes
  const handleClose = () => {
    setStep('criteria');
    setTargetType('wholesale');
    setMinSpent('');
    setError(null);
    setEligibleCustomers([]);
    onClose();
  };

  const handlePreview = async () => {
    try {
      if (!minSpent || minSpent < 0) {
        setError('Please enter a valid minimum spent amount');
        return;
      }

      setLoading(true);
      setError(null);

      const response = await customerService.previewUpgrade({
        targetType,
        minSpent: parseFloat(minSpent)
      });

      if (response.success) {
        setEligibleCustomers(response.data.customers);
        // detailed response might contain customers array
        setSelectedCustomerIds(response.data.customers.map(c => c._id || c.id));
        setStep('preview');
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.response?.data?.error?.message || 'Failed to preview upgrades');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      if (selectedCustomerIds.length === 0) {
        setError('No customers selected for upgrade');
        return;
      }

      setLoading(true);
      setError(null);

      const response = await customerService.executeUpgrade({
        targetType,
        customerIds: selectedCustomerIds
      });

      if (response.success) {
        onSuccess(response.data.updatedCount, targetType);
        handleClose();
      }
    } catch (err) {
      console.error('Execute error:', err);
      setError(err.response?.data?.error?.message || 'Failed to execute upgrades');
      setLoading(false);
    }
  };

  const handleToggleCustomer = (id) => {
    setSelectedCustomerIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (selectedCustomerIds.length === eligibleCustomers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(eligibleCustomers.map(c => c._id || c.id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 font-['Poppins',sans-serif]">
                Bulk Upgrade Customers
              </h2>
              <p className="text-xs text-gray-500">
                {step === 'criteria' ? 'Define upgrade criteria' : 'Review candidates'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {step === 'criteria' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-['Poppins',sans-serif]">Target Customer Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTargetType('wholesale')}
                    className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${targetType === 'wholesale'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                      : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                      }`}
                  >
                    <Users className="w-6 h-6" />
                    <span className="font-semibold">Wholesale</span>
                    <span className="text-xs opacity-75">From Retail only</span>
                  </button>
                  <button
                    onClick={() => setTargetType('vip')}
                    className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${targetType === 'vip'
                      ? 'border-purple-500 bg-purple-50 text-purple-700 ring-1 ring-purple-500'
                      : 'border-gray-200 hover:border-purple-200 hover:bg-gray-50'
                      }`}
                  >
                    <ShieldCheck className="w-6 h-6" />
                    <span className="font-semibold">VIP</span>
                    <span className="text-xs opacity-75">From Retail & Wholesale</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-['Poppins',sans-serif]">
                  Minimum Total Spent (VND)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₫</span>
                  <input
                    type="number"
                    min="0"
                    value={minSpent}
                    onChange={(e) => setMinSpent(e.target.value)}
                    placeholder="e.g. 5000000"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-['Poppins',sans-serif]"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Customers with total spending greater than or equal to this amount will be selected.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Eligible Customers ({selectedCustomerIds.length}/{eligibleCustomers.length})
                </h3>
                <button
                  onClick={handleToggleAll}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {selectedCustomerIds.length === eligibleCustomers.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.length === eligibleCustomers.length && eligibleCustomers.length > 0}
                          onChange={handleToggleAll}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Current Type</th>
                      <th className="px-4 py-2 text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {eligibleCustomers.map(customer => (
                      <tr key={customer._id || customer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(customer._id || customer.id)}
                            onChange={() => handleToggleCustomer(customer._id || customer.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">{customer.fullName}</div>
                          <div className="text-xs text-gray-500">{customer.customerCode}</div>
                        </td>
                        <td className="px-4 py-2 capitalize">
                          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                            {customer.customerType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-emerald-600">
                          {formatCurrency(customer.totalSpent)}
                        </td>
                      </tr>
                    ))}
                    {eligibleCustomers.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                          No eligible customers found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={step === 'criteria' ? handleClose : () => setStep('criteria')}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {step === 'criteria' ? 'Cancel' : 'Back'}
          </button>

          {step === 'criteria' ? (
            <button
              onClick={handlePreview}
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              Check Eligible Customers
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleExecute}
              disabled={loading || selectedCustomerIds.length === 0}
              className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Upgrading...' : `Confirm Upgrade (${selectedCustomerIds.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
