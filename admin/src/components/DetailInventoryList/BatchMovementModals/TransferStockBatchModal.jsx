import React, { useState, useEffect } from 'react';
import inventoryMovementBatchService from '../../../services/inventoryMovementBatchService';
import employeeService from '../../../services/employeeService';

export const TransferStockBatchModal = ({ isOpen, onClose, onSuccess, detailInventory }) => {
  const [formData, setFormData] = useState({
    quantity: '',
    direction: 'toShelf', // toShelf or toWarehouse
    reason: '',
    date: new Date().toISOString().split('T')[0],
    performedBy: '',
    notes: ''
  });

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      setFormData({
        quantity: '',
        direction: 'toShelf',
        reason: 'Stock Movement',
        date: new Date().toISOString().split('T')[0],
        performedBy: '',
        notes: ''
      });
      setError(null);
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getAllEmployees();
      if (response.success && response.data) {
        setEmployees(response.data.employees || []);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const quantity = parseInt(formData.quantity);

    // Validate based on direction
    if (formData.direction === 'toShelf') {
      if (quantity > (detailInventory?.quantityOnHand || 0)) {
        setError(`Insufficient warehouse stock. Available: ${detailInventory?.quantityOnHand || 0}`);
        return;
      }
    } else {
      if (quantity > (detailInventory?.quantityOnShelf || 0)) {
        setError(`Insufficient shelf stock. Available: ${detailInventory?.quantityOnShelf || 0}`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const movementData = {
        batchId: detailInventory.batchId._id || detailInventory.batchId,
        inventoryDetail: detailInventory._id || detailInventory.id,
        movementType: 'transfer',
        quantity: formData.direction === 'toShelf' ? quantity : -quantity,
        reason: formData.reason,
        date: new Date(formData.date),
        performedBy: formData.performedBy || undefined,
        notes: formData.notes || undefined
      };

      const response = await inventoryMovementBatchService.createMovement(movementData);

      if (onSuccess) {
        onSuccess(response);
      }
      onClose();
    } catch (err) {
      console.error('Error creating transfer movement:', err);
      setError(err.error?.message || err.message || 'Failed to record transfer');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Transfer Batch Stock
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {error}
            </div>
          )}

          {/* Batch Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-[14px] font-semibold text-blue-900 mb-2">Batch Information:</h3>
            <div className="space-y-1 text-[12px] text-blue-800">
              <p><span className="font-semibold">Batch Code:</span> {detailInventory?.batchId?.batchCode}</p>
              <p><span className="font-semibold">Product:</span> {detailInventory?.batchId?.productId?.name}</p>
              <p><span className="font-semibold">On Hand (Warehouse):</span> {detailInventory?.quantityOnHand}</p>
              <p><span className="font-semibold">On Shelf:</span> {detailInventory?.quantityOnShelf}</p>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#212529] mb-2">
              Transfer Direction <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, direction: 'toShelf', quantity: '' })}
                className={`p-4 border-2 rounded-lg text-center transition-all ${formData.direction === 'toShelf'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-300 hover:border-blue-400'
                  }`}
              >
                <div className="text-[14px] font-semibold mb-1">Warehouse → Shelf</div>
                <div className="text-[11px] text-gray-600">Move to sales floor</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, direction: 'toWarehouse', quantity: '' })}
                className={`p-4 border-2 rounded-lg text-center transition-all ${formData.direction === 'toWarehouse'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-gray-300 hover:border-blue-400'
                  }`}
              >
                <div className="text-[14px] font-semibold mb-1">Shelf → Warehouse</div>
                <div className="text-[11px] text-gray-600">Return to storage</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#212529] mb-2">
                Quantity to Transfer <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                min="1"
                max={formData.direction === 'toShelf' ? (detailInventory?.quantityOnHand || 0) : (detailInventory?.quantityOnShelf || 0)}
                required
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-gray-600 mt-1">
                Max: {formData.direction === 'toShelf' ? (detailInventory?.quantityOnHand || 0) : (detailInventory?.quantityOnShelf || 0)} units
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#212529] mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#212529] mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              required
              placeholder="e.g., Restock shelf, Return excess stock"
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#212529] mb-2">
              Performed By <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <select
              value={formData.performedBy}
              onChange={(e) => setFormData({ ...formData, performedBy: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select employee</option>
              {employees.map(emp => (
                <option key={emp._id || emp.id} value={emp._id || emp.id}>
                  {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#212529] mb-2">
              Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Additional notes about this transfer..."
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-[13px] font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-[13px] font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Processing...' : 'Transfer Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
