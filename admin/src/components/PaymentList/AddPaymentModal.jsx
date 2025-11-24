import React, { useState, useEffect } from 'react';
import paymentService from '../../services/paymentService';
import orderService from '../../services/orderService';
import purchaseOrderService from '../../services/purchaseOrderService';

export const AddPaymentModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    referenceType: 'Order',
    referenceId: '',
    amount: '',
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString().split('T')[0],
    status: 'pending', // Default and read-only
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [references, setReferences] = useState([]);
  const [selectedReference, setSelectedReference] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        referenceType: 'Order',
        referenceId: '',
        amount: '',
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: ''
      });
      setError(null);
      setSelectedReference(null);
      fetchReferences('Order');
    }
  }, [isOpen]);

  // Fetch references when referenceType changes
  useEffect(() => {
    if (isOpen && formData.referenceType) {
      fetchReferences(formData.referenceType);
    }
  }, [formData.referenceType, isOpen]);

  // Fetch reference details when referenceId changes
  useEffect(() => {
    if (formData.referenceId) {
      fetchReferenceDetails(formData.referenceType, formData.referenceId);
    } else {
      setSelectedReference(null);
    }
  }, [formData.referenceId, formData.referenceType]);

  const fetchReferences = async (type) => {
    setLoadingReferences(true);
    try {
      let response;
      if (type === 'Order') {
        // Fetch orders that can create payment (exclude draft and cancelled)
        // Include: pending, shipping, delivered
        response = await orderService.getAllOrders({
          status: 'pending,shipping,delivered',
          limit: 100,
          sortBy: 'orderDate',
          sortOrder: 'desc'
        });
        console.log('📥 Fetched orders:', response);
      } else if (type === 'PurchaseOrder') {
        // Fetch purchase orders that can create payment (exclude draft and cancelled)
        // Include: pending, approved, received
        response = await purchaseOrderService.getAllPurchaseOrders({
          status: 'pending,approved,received',
          limit: 100,
          sortBy: 'orderDate',
          sortOrder: 'desc'
        });
        console.log('📥 Fetched purchase orders:', response);
      }

      if (response && response.success && response.data) {
        const items = type === 'Order' ? response.data.orders : response.data.purchaseOrders;
        console.log('✅ Parsed items:', items?.length || 0);
        setReferences(items || []);
      } else if (response && Array.isArray(response)) {
        // Handle direct array response
        console.log('✅ Direct array response:', response.length);
        setReferences(response);
      } else {
        console.warn('⚠️ Unexpected response structure:', response);
        setReferences([]);
      }
    } catch (err) {
      console.error('❌ Error fetching references:', err);
      console.error('Error details:', err.response?.data || err.message);
      setReferences([]);
    } finally {
      setLoadingReferences(false);
    }
  };

  const fetchReferenceDetails = async (type, id) => {
    try {
      let response;
      if (type === 'Order') {
        response = await orderService.getOrderById(id);
      } else if (type === 'PurchaseOrder') {
        response = await purchaseOrderService.getPurchaseOrderById(id);
      }

      if (response.success && response.data) {
        const item = type === 'Order' ? response.data.order : response.data.purchaseOrder;
        setSelectedReference(item);

        // Auto-fill amount from order/purchase order total (read-only)
        const totalAmount = item.total || item.totalPrice || 0;
        setFormData(prev => ({
          ...prev,
          amount: totalAmount.toString()
        }));
      }
    } catch (err) {
      console.error('Error fetching reference details:', err);
      setSelectedReference(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.referenceType) {
      setError('Please select a reference type');
      return;
    }

    if (!formData.referenceId) {
      setError('Please select an order or purchase order');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!formData.paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    if (!formData.paymentDate) {
      setError('Please select a payment date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const paymentData = {
        referenceType: formData.referenceType,
        referenceId: formData.referenceId,
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        paymentDate: formData.paymentDate,
        status: formData.status
      };

      if (formData.notes.trim()) {
        paymentData.notes = formData.notes.trim();
      }

      const response = await paymentService.createPayment(paymentData);

      if (onSuccess) {
        onSuccess(response);
      }
      onClose();
    } catch (err) {
      console.error('Error creating payment:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to create payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Reset referenceId when referenceType changes
    if (field === 'referenceType') {
      setFormData(prev => ({
        ...prev,
        referenceId: '',
        amount: ''
      }));
      setSelectedReference(null);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      shipping: 'Shipping',
      delivered: 'Delivered',
      approved: 'Approved',
      received: 'Received',
      draft: 'Draft'
    };
    return labels[status] || status;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Create New Payment
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {error}
            </div>
          )}

          {/* Reference Type */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Payment For <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="referenceType"
                  value="Order"
                  checked={formData.referenceType === 'Order'}
                  onChange={(e) => handleChange('referenceType', e.target.value)}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[13px] font-['Poppins',sans-serif] text-[#212529]">Order (Sales)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="referenceType"
                  value="PurchaseOrder"
                  checked={formData.referenceType === 'PurchaseOrder'}
                  onChange={(e) => handleChange('referenceType', e.target.value)}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[13px] font-['Poppins',sans-serif] text-[#212529]">Purchase Order</span>
              </label>
            </div>
          </div>

          {/* Reference Selection */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Select {formData.referenceType === 'Order' ? 'Order' : 'Purchase Order'} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.referenceId}
              onChange={(e) => handleChange('referenceId', e.target.value)}
              required
              disabled={loadingReferences}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
            >
              <option value="">
                {loadingReferences ? 'Loading...' : `Select ${formData.referenceType === 'Order' ? 'an order' : 'a purchase order'}`}
              </option>
              {references.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {formData.referenceType === 'Order' ? ref.orderNumber : ref.poNumber} - {formatCurrency(ref.total || ref.totalPrice)} - {getStatusLabel(ref.status)}
                </option>
              ))}
            </select>
            {!loadingReferences && references.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-600 font-['Poppins',sans-serif]">
                No available {formData.referenceType === 'Order' ? 'orders' : 'purchase orders'} found
              </p>
            )}
          </div>

          {/* Selected Reference Details */}
          {selectedReference && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-[12px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                {formData.referenceType === 'Order' ? 'Order' : 'Purchase Order'} Details
              </p>
              <div className="grid grid-cols-2 gap-3 text-[12px] font-['Poppins',sans-serif]">
                <div>
                  <span className="text-gray-600">Number:</span>
                  <span className="ml-2 font-medium text-[#212529]">
                    {formData.referenceType === 'Order' ? selectedReference.orderNumber : selectedReference.poNumber}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className="ml-2 font-medium text-[#212529]">{getStatusLabel(selectedReference.status)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total:</span>
                  <span className="ml-2 font-semibold text-emerald-600">
                    {formatCurrency(selectedReference.total || selectedReference.totalPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Payment Status:</span>
                  <span className="ml-2 font-medium text-[#212529]">
                    {selectedReference.paymentStatus || 'unpaid'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            {/* Amount - Read Only */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Amount (VND) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                readOnly
                placeholder="Auto-filled from order total"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] bg-gray-50 cursor-not-allowed"
              />
              {formData.amount && (
                <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                  {formatCurrency(parseFloat(formData.amount))}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => handleChange('paymentMethod', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Payment Date */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
                required
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Status - Read Only */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value="Pending"
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] bg-gray-50 cursor-not-allowed"
              />
              <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                Payment status will be set to pending by default
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Enter payment notes"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                Maximum 500 characters
              </p>
              <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                {formData.notes.length}/500
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.referenceId}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
