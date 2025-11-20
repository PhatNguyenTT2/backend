import React, { useState, useEffect } from 'react';
import orderService from '../../services/orderService';
import orderDetailService from '../../services/orderDetailService';

export const EditOrderModal = ({ isOpen, onClose, onSuccess, order }) => {
  const [formData, setFormData] = useState({
    shippingAddress: '',
    shippingFee: 0,
    discount: 0,
    notes: '',
    status: 'pending',
    paymentStatus: 'pending'
  });

  const [orderDetails, setOrderDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Load order data when modal opens
  useEffect(() => {
    if (isOpen && order) {
      setFormData({
        shippingAddress: order.shippingAddress || '',
        shippingFee: order.shippingFee || 0,
        discount: order.discount || 0,
        notes: order.notes || '',
        status: order.status || 'pending',
        paymentStatus: order.paymentStatus || 'pending'
      });
      loadOrderDetails();
    }
  }, [isOpen, order]);

  const loadOrderDetails = async () => {
    if (!order?._id) return;

    setLoadingDetails(true);
    try {
      const details = await orderDetailService.getDetailsByOrder(order._id);
      setOrderDetails(details || []);
    } catch (error) {
      console.error('Failed to load order details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Calculate totals
  const calculateSubtotal = () => {
    return orderDetails.reduce((sum, detail) => {
      return sum + (detail.quantity * detail.unitPrice);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal + Number(formData.shippingFee) - Number(formData.discount);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (order.deliveryType === 'delivery' && !formData.shippingAddress.trim()) {
      newErrors.shippingAddress = 'Shipping address is required for delivery orders';
    }

    if (formData.shippingFee < 0) {
      newErrors.shippingFee = 'Shipping fee cannot be negative';
    }

    if (formData.discount < 0) {
      newErrors.discount = 'Discount cannot be negative';
    }

    // Cannot change status to delivered if payment is not completed
    if (formData.status === 'delivered' && formData.paymentStatus !== 'paid') {
      newErrors.status = 'Cannot mark as delivered without payment being completed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const updateData = {
        shippingAddress: formData.shippingAddress || undefined,
        shippingFee: Number(formData.shippingFee),
        discount: Number(formData.discount),
        notes: formData.notes || undefined,
        status: formData.status,
        paymentStatus: formData.paymentStatus
      };

      await orderService.updateOrder(order._id, updateData);
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('Failed to update order:', error);
      setErrors({ submit: error.response?.data?.message || 'Failed to update order' });
    } finally {
      setLoading(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    setFormData({
      shippingAddress: '',
      shippingFee: 0,
      discount: 0,
      notes: '',
      status: 'pending',
      paymentStatus: 'pending'
    });
    setOrderDetails([]);
    setErrors({});
    onClose();
  };

  if (!isOpen || !order) return null;

  const canEdit = order.status !== 'delivered' && order.status !== 'cancelled';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-gray-900">
              Edit Order
            </h2>
            <p className="text-[13px] text-gray-600 mt-1">
              Order #{order.orderNumber}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 6L18 18" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Order Information - Read Only */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-[13px] font-semibold text-gray-900 mb-3">Order Information</h3>
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <span className="text-gray-600">Customer:</span>
                  <p className="font-medium text-gray-900 mt-1">
                    {order.customer?.fullName || '-'}
                  </p>
                  {order.customer?.phone && (
                    <p className="text-gray-500 text-[12px]">{order.customer.phone}</p>
                  )}
                </div>
                <div>
                  <span className="text-gray-600">Delivery Type:</span>
                  <p className="font-medium text-gray-900 mt-1">
                    {order.deliveryType === 'delivery' ? '🚚 Delivery' : '📦 Pickup'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Order Date:</span>
                  <p className="font-medium text-gray-900 mt-1">{formatDate(order.orderDate)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Created By:</span>
                  <p className="font-medium text-gray-900 mt-1">
                    {order.createdBy?.employee?.fullName || order.createdBy?.userName || '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Details Table */}
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-3">Order Items</h3>
              {loadingDetails ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-[13px]">Loading order items...</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-700 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-700 uppercase">Batch</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-700 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-700 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-700 uppercase">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orderDetails.map((detail, index) => (
                        <tr key={detail._id || index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-[13px] text-gray-900">
                            {detail.product?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-[12px] text-gray-600">
                            {detail.batch?.batchNumber || 'No batch'}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-gray-900 text-right">
                            {detail.quantity}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-gray-900 text-right">
                            {formatCurrency(detail.unitPrice)}
                          </td>
                          <td className="px-4 py-3 text-[13px] font-medium text-gray-900 text-right">
                            {formatCurrency(detail.quantity * detail.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orderDetails.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-[13px]">No items found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Editable Fields */}
            {canEdit && (
              <>
                {/* Shipping Address - Only for delivery */}
                {order.deliveryType === 'delivery' && (
                  <div>
                    <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                      Shipping Address
                    </label>
                    <textarea
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                      rows={3}
                      className={`w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.shippingAddress ? 'border-red-500' : 'border-[#ced4da]'
                        }`}
                      placeholder="Enter shipping address"
                    />
                    {errors.shippingAddress && (
                      <p className="mt-1 text-xs text-red-500">{errors.shippingAddress}</p>
                    )}
                  </div>
                )}

                {/* Fees and Discounts */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                      Shipping Fee
                    </label>
                    <input
                      type="number"
                      value={formData.shippingFee}
                      onChange={(e) => setFormData({ ...formData, shippingFee: e.target.value })}
                      min="0"
                      className={`w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.shippingFee ? 'border-red-500' : 'border-[#ced4da]'
                        }`}
                    />
                    {errors.shippingFee && (
                      <p className="mt-1 text-xs text-red-500">{errors.shippingFee}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                      Discount
                    </label>
                    <input
                      type="number"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                      min="0"
                      className={`w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.discount ? 'border-red-500' : 'border-[#ced4da]'
                        }`}
                    />
                    {errors.discount && (
                      <p className="mt-1 text-xs text-red-500">{errors.discount}</p>
                    )}
                  </div>
                </div>

                {/* Status Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                      Order Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className={`w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.status ? 'border-red-500' : 'border-[#ced4da]'
                        }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipping">Shipping</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    {errors.status && (
                      <p className="mt-1 text-xs text-red-500">{errors.status}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                      Payment Status
                    </label>
                    <select
                      value={formData.paymentStatus}
                      onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                      className="w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Additional notes..."
                    maxLength={500}
                  />
                </div>
              </>
            )}

            {!canEdit && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-[13px] text-yellow-800">
                  ℹ️ This order cannot be edited because it has been {order.status}.
                </p>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-[13px] font-semibold text-gray-900 mb-3">Order Summary</h3>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping Fee:</span>
                  <span className="font-medium">{formatCurrency(formData.shippingFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(formData.discount)}
                  </span>
                </div>
                <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-blue-600 text-[15px]">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-[13px] font-semibold text-gray-900 mb-3">Metadata</h3>
              <div className="grid grid-cols-2 gap-4 text-[12px]">
                <div>
                  <span className="text-gray-600">Created At:</span>
                  <p className="font-medium text-gray-900 mt-1">{formatDate(order.createdAt)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Last Updated:</span>
                  <p className="font-medium text-gray-900 mt-1">{formatDate(order.updatedAt)}</p>
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">{errors.submit}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-[12px] font-medium font-['Poppins',sans-serif] text-gray-700 border border-[#ced4da] rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            Close
          </button>
          {canEdit && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-[12px] font-medium font-['Poppins',sans-serif] rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
