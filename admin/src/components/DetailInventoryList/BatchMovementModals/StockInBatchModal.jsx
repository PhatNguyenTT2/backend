import React, { useState, useEffect } from 'react';
import inventoryMovementBatchService from '../../../services/inventoryMovementBatchService';
import employeeService from '../../../services/employeeService';

export const StockInBatchModal = ({ isOpen, onClose, onSuccess, detailInventory }) => {
  const [formData, setFormData] = useState({
    quantity: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
    performedBy: '',
    purchaseOrderId: '',
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
        reason: 'Purchase Order Receipt',
        date: new Date().toISOString().split('T')[0],
        performedBy: '',
        purchaseOrderId: '',
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
    setLoading(true);
    setError(null);

    try {
      const movementData = {
        batchId: detailInventory.batchId._id || detailInventory.batchId,
        inventoryDetail: detailInventory._id || detailInventory.id,
        movementType: 'in',
        quantity: parseInt(formData.quantity),
        reason: formData.reason,
        date: new Date(formData.date),
        performedBy: formData.performedBy || undefined,
        purchaseOrderId: formData.purchaseOrderId || undefined,
        notes: formData.notes || undefined
      };

      const response = await inventoryMovementBatchService.createMovement(movementData);

      if (onSuccess) {
        onSuccess(response);
      }
      onClose();
    } catch (err) {
      console.error('Error creating stock in movement:', err);
      setError(err.error?.message || err.message || 'Failed to record stock in');
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
            Stock In - Batch Receipt
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="text-[14px] font-semibold text-emerald-900 mb-2">Batch Information:</h3>
            <div className="space-y-1 text-[12px] text-emerald-800">
              <p><span className="font-semibold">Batch Code:</span> {detailInventory?.batchId?.batchCode}</p>
              <p><span className="font-semibold">Product:</span> {detailInventory?.batchId?.productId?.name}</p>
              <p><span className="font-semibold">Current On Hand:</span> {detailInventory?.quantityOnHand}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#212529] mb-2">
                Quantity to Receive <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                min="1"
                required
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
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
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              placeholder="e.g., Purchase Order Receipt, Returns, etc."
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#212529] mb-2">
                Performed By <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <select
                value={formData.performedBy}
                onChange={(e) => setFormData({ ...formData, performedBy: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                PO Reference <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.purchaseOrderId}
                onChange={(e) => setFormData({ ...formData, purchaseOrderId: e.target.value })}
                placeholder="Purchase Order ID"
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#212529] mb-2">
              Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Additional notes about this receipt..."
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
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
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Processing...' : 'Receive Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
