import React, { useState, useEffect } from 'react';
import orderService from '../../services/orderService';
import customerService from '../../services/customerService';
import productService from '../../services/productService';

/**
 * EditOrderModal Component
 * 
 * Order Edit Flow:
 * 1. Load existing order data
 * 2. User can modify delivery details, fees, and status
 * 3. Order items are read-only (cannot modify after creation)
 * 4. Cannot edit delivered or cancelled orders
 * 
 * Restrictions:
 * - Cannot edit order items (product, quantity, price) after creation
 * - Cannot edit delivered or cancelled orders
 * - Can only update: delivery type, address, shipping fee, discount, notes, status
 */
export const EditOrderModal = ({ isOpen, onClose, onSuccess, order }) => {
  const [formData, setFormData] = useState({
    deliveryType: 'delivery',
    shippingAddress: '',
    shippingFee: 0,
    discount: 0,
    notes: '',
    status: 'pending',
    paymentStatus: 'pending'
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Check if order can be edited
  const canEdit = order && order.status !== 'delivered' && order.status !== 'cancelled';

  // Load form data when modal opens or order changes
  useEffect(() => {
    if (isOpen && order) {
      setFormData({
        deliveryType: order.deliveryType || 'delivery',
        shippingAddress: order.shippingAddress || order.address || '',
        shippingFee: order.shippingFee || 0,
        discount: order.discount || 0,
        notes: order.notes || '',
        status: order.status || 'pending',
        paymentStatus: order.paymentStatus || 'pending'
      });
      setErrors({});
      loadCustomers();
      loadProducts();
    }
  }, [isOpen, order]);

  // Load customers
  const loadCustomers = async () => {
    try {
      const data = await customerService.getAllCustomers({
        limit: 100,
        isActive: true
      });
      const customersList = data.data?.customers || data.customers || [];
      setCustomers(customersList);
    } catch (error) {
      console.error('❌ Failed to load customers:', error);
    }
  };

  // Load products
  const loadProducts = async () => {
    try {
      const data = await productService.getAllProducts({
        limit: 200,
        isActive: true,
        withInventory: true
      });
      const productsList = data.data?.products || data.products || [];
      setProducts(productsList);
    } catch (error) {
      console.error('❌ Failed to load products:', error);
    }
  };

  // Helper: Get product by ID
  const getProductById = (productId) => {
    return products.find(p => p._id === productId);
  };

  // Helper: Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({
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

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Validate shipping address for delivery orders
    if (formData.deliveryType === 'delivery' && !formData.shippingAddress.trim()) {
      newErrors.shippingAddress = 'Shipping address is required for delivery orders';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calculate subtotal from order details
  const calculateSubtotal = () => {
    if (!order || !order.details) return 0;
    return order.details.reduce((sum, detail) => {
      return sum + (detail.quantity * detail.unitPrice);
    }, 0);
  };

  // Calculate total
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal + Number(formData.shippingFee) - Number(formData.discount);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canEdit) {
      setErrors({ submit: 'Cannot edit delivered or cancelled orders' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const updateData = {
        deliveryType: formData.deliveryType,
        shippingAddress: formData.deliveryType === 'delivery'
          ? formData.shippingAddress
          : undefined,
        shippingFee: Number(formData.shippingFee),
        discount: Number(formData.discount),
        notes: formData.notes || undefined,
        status: formData.status,
        paymentStatus: formData.paymentStatus
      };

      console.log('📤 Updating order:', order._id || order.id, updateData);

      await orderService.updateOrder(order._id || order.id, updateData);

      console.log('✅ Order updated successfully');
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('❌ Failed to update order:', error);
      setErrors({
        submit: error.response?.data?.error?.message ||
          error.response?.data?.message ||
          'Failed to update order'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Edit Order
            </h2>
            <p className="text-[12px] text-gray-500 font-['Poppins',sans-serif] mt-1">
              Order #{order.orderNumber || 'N/A'}
            </p>
          </div>
          <button
            onClick={handleClose}
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
          {/* Cannot Edit Warning */}
          {!canEdit && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-[13px]">
              ⚠️ Cannot edit delivered or cancelled orders
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {errors.submit}
            </div>
          )}

          {/* Customer Info (Read-only) */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Customer
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] bg-gray-50 cursor-not-allowed">
              {order.customer?.fullName || 'N/A'} {order.customer?.phone ? `- ${order.customer.phone}` : ''}
            </div>
            <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
              Customer cannot be changed after order creation
            </p>
          </div>

          {/* Status Selection */}
          <div className="grid grid-cols-2 gap-4">
            {/* Order Status */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Order Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                disabled={!canEdit || loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="shipping">Shipping</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Payment Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => handleChange('paymentStatus', e.target.value)}
                disabled={!canEdit || loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          {/* Delivery Type */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Delivery Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="delivery"
                  checked={formData.deliveryType === 'delivery'}
                  onChange={(e) => handleChange('deliveryType', e.target.value)}
                  disabled={!canEdit || loading}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                />
                <span className="text-[13px] font-['Poppins',sans-serif] text-[#212529]">
                  🚚 Delivery
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="pickup"
                  checked={formData.deliveryType === 'pickup'}
                  onChange={(e) => handleChange('deliveryType', e.target.value)}
                  disabled={!canEdit || loading}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                />
                <span className="text-[13px] font-['Poppins',sans-serif] text-[#212529]">
                  📦 Pickup
                </span>
              </label>
            </div>
          </div>

          {/* Shipping Address (conditional) */}
          {formData.deliveryType === 'delivery' && (
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Shipping Address <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.shippingAddress}
                onChange={(e) => handleChange('shippingAddress', e.target.value)}
                placeholder="Enter delivery address"
                rows={3}
                disabled={!canEdit || loading}
                className={`w-full px-3 py-2 border ${errors.shippingAddress ? 'border-red-500' : 'border-gray-300'} rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed`}
              />
              {errors.shippingAddress && (
                <p className="mt-1 text-[11px] text-red-500 font-['Poppins',sans-serif]">
                  {errors.shippingAddress}
                </p>
              )}
            </div>
          )}

          {/* Order Items (Read-only) */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Order Items
            </label>

            {/* Info Banner */}
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Order items cannot be modified after order creation</span>
              </p>
            </div>

            {/* Items List (Read-only) */}
            <div className="space-y-3">
              {order.details && order.details.length > 0 ? (
                order.details.map((detail, index) => {
                  const product = detail.product;
                  const batch = detail.batch;

                  return (
                    <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        {/* Product Name */}
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Product</label>
                          <div className="text-[12px] font-medium text-gray-900">
                            {product?.name || 'N/A'}
                          </div>
                          {product?.productCode && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              Code: {product.productCode}
                            </div>
                          )}
                        </div>

                        {/* Batch Info */}
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Batch</label>
                          <div className="text-[12px] text-gray-900">
                            {batch?.batchNumber || 'N/A'}
                          </div>
                          {batch?.expiryDate && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              Exp: {new Date(batch.expiryDate).toLocaleDateString('en-US')}
                            </div>
                          )}
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Quantity</label>
                          <div className="text-[12px] font-medium text-gray-900">
                            {detail.quantity}
                          </div>
                        </div>

                        {/* Unit Price */}
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Unit Price</label>
                          <div className="text-[12px] font-medium text-gray-900">
                            {formatCurrency(detail.unitPrice)}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            Total: {formatCurrency(detail.quantity * detail.unitPrice)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-gray-500 text-[12px]">
                  No items found
                </div>
              )}
            </div>
          </div>

          {/* Fees & Discount */}
          <div className="grid grid-cols-2 gap-4">
            {/* Shipping Fee */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Shipping Fee
              </label>
              <input
                type="number"
                value={formData.shippingFee}
                onChange={(e) => handleChange('shippingFee', e.target.value)}
                min="0"
                step="1000"
                disabled={!canEdit || loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Discount */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Discount (Amount)
              </label>
              <input
                type="number"
                value={formData.discount}
                onChange={(e) => handleChange('discount', e.target.value)}
                min="0"
                step="1000"
                disabled={!canEdit || loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
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
              placeholder="Enter any additional notes"
              rows={3}
              maxLength={500}
              disabled={!canEdit || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
              {formData.notes.length}/500
            </p>
          </div>

          {/* Order Summary */}
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-4 rounded-lg border border-emerald-200">
            <h3 className="text-[14px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-3">
              Order Summary
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-900">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                <span className="text-gray-600">Shipping Fee:</span>
                <span className="text-gray-900">{formatCurrency(formData.shippingFee)}</span>
              </div>
              <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                <span className="text-gray-600">Discount:</span>
                <span className="text-red-600">- {formatCurrency(formData.discount)}</span>
              </div>
              <div className="border-t border-emerald-300 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-[16px] font-bold font-['Poppins',sans-serif] text-[#212529]">Total:</span>
                  <span className="text-[18px] font-bold font-['Poppins',sans-serif] text-emerald-600">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canEdit}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </>
              ) : (
                'Update Order'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
