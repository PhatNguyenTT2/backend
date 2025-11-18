import React, { useState, useEffect } from 'react';
import inventoryService from '../../services/inventoryService';

export const UpdateLocationModal = ({ isOpen, onClose, inventory, onSuccess }) => {
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && inventory) {
      setLocation(inventory.warehouseLocation || '');
      setError(null);
    }
  }, [isOpen, inventory]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!location.trim()) {
      setError('Location cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const inventoryId = inventory._id || inventory.id;
      const response = await inventoryService.updateInventory(inventoryId, {
        warehouseLocation: location.trim()
      });

      if (response.success || response.data) {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        setError('Failed to update location');
      }
    } catch (err) {
      console.error('Error updating location:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to update location');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-[18px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Update Warehouse Location
            </h2>
            <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif] mt-1">
              {inventory?.product?.productCode} - {inventory?.product?.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
              Warehouse Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., A1, B2-3, Zone C"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              disabled={loading}
              required
            />
            <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif] mt-1">
              Enter the warehouse location code or identifier
            </p>
          </div>

          {/* Current Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-[11px] font-medium text-gray-700 font-['Poppins',sans-serif] mb-2">
              Current Information
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-[12px] font-['Poppins',sans-serif]">
                <span className="text-gray-600">Current Location:</span>
                <span className="font-medium text-gray-900">
                  {inventory?.warehouseLocation || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-[12px] font-['Poppins',sans-serif]">
                <span className="text-gray-600">Total Stock:</span>
                <span className="font-medium text-gray-900">
                  {(inventory?.quantityOnHand || 0) + (inventory?.quantityOnShelf || 0)} units
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-[13px] font-['Poppins',sans-serif] font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !location.trim()}
              className="px-4 py-2.5 text-[13px] font-['Poppins',sans-serif] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {loading ? 'Updating...' : 'Update Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
