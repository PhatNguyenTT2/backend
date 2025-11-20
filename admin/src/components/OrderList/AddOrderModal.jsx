import React, { useState, useEffect } from 'react';
import orderService from '../../services/orderService';
import customerService from '../../services/customerService';
import productService from '../../services/productService';

export const AddOrderModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    customerId: '',
    deliveryType: 'delivery',
    shippingAddress: '',
    shippingFee: 0,
    discount: 0,
    notes: '',
    items: []
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchProduct, setSearchProduct] = useState('');

  // Load customers and products
  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      loadProducts();
    }
  }, [isOpen]);

  const loadCustomers = async () => {
    try {
      const data = await customerService.getAllCustomers({ limit: 100, isActive: true });
      const customersList = data.data?.customers || data.customers || [];
      console.log('Loaded customers:', customersList.length);
      setCustomers(customersList);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await productService.getAllProducts({
        limit: 200,
        isActive: true,
        withInventory: true // Include inventory to show available quantity
      });
      const productsList = data.data?.products || data.products || [];
      console.log('Loaded products:', productsList.length);
      console.log('Sample product with inventory:', productsList[0]);
      setProducts(productsList);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Add item to order
  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { productId: '', batchId: '', quantity: 1, unitPrice: 0 }
      ]
    });
  };

  // Remove item
  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  // Update item
  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill price when product is selected
    if (field === 'productId' && value) {
      const product = products.find(p => p._id === value);
      if (product) {
        newItems[index].unitPrice = product.unitPrice || 0;
      }
    }

    setFormData({ ...formData, items: newItems });
  };

  // Calculate totals
  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal + Number(formData.shippingFee) - Number(formData.discount);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.customerId) {
      newErrors.customerId = 'Please select a customer';
    }

    if (formData.deliveryType === 'delivery' && !formData.shippingAddress) {
      newErrors.shippingAddress = 'Shipping address is required for delivery orders';
    }

    if (formData.items.length === 0) {
      newErrors.items = 'Please add at least one item';
    }

    formData.items.forEach((item, index) => {
      if (!item.productId) {
        newErrors[`item_${index}_product`] = 'Please select a product';
      }
      if (item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = 'Quantity must be greater than 0';
      }
      if (item.unitPrice < 0) {
        newErrors[`item_${index}_price`] = 'Price cannot be negative';
      }

      // Validate quantity against available stock
      if (item.productId) {
        const product = products.find(p => p._id === item.productId);
        const availableQty = product?.inventory?.quantityOnShelf || 0;
        if (item.quantity > availableQty) {
          newErrors[`item_${index}_quantity`] = `Only ${availableQty} available`;
        }
      }
    });

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
      const orderData = {
        customer: formData.customerId,
        deliveryType: formData.deliveryType,
        shippingAddress: formData.deliveryType === 'delivery' ? formData.shippingAddress : undefined,
        shippingFee: Number(formData.shippingFee),
        discount: Number(formData.discount),
        notes: formData.notes || undefined,
        items: formData.items.map(item => ({
          product: item.productId,
          batch: item.batchId || undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        }))
      };

      await orderService.createOrder(orderData);
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('Failed to create order:', error);
      setErrors({ submit: error.response?.data?.message || 'Failed to create order' });
    } finally {
      setLoading(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    setFormData({
      customerId: '',
      deliveryType: 'delivery',
      shippingAddress: '',
      shippingFee: 0,
      discount: 0,
      notes: '',
      items: []
    });
    setErrors({});
    setSearchCustomer('');
    setSearchProduct('');
    onClose();
  };

  // Filter customers
  const filteredCustomers = customers.filter(c =>
    c.fullName?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.phone?.includes(searchCustomer)
  );

  // Filter products
  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchProduct.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-gray-900">
            Create New Order
          </h2>
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
            {/* Customer Selection */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className={`w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customerId ? 'border-red-500' : 'border-[#ced4da]'
                  }`}
              >
                <option value="">Select a customer</option>
                {filteredCustomers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.fullName} - {customer.phone}
                  </option>
                ))}
              </select>
              {errors.customerId && (
                <p className="mt-1 text-xs text-red-500">{errors.customerId}</p>
              )}
            </div>

            {/* Delivery Type */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                Delivery Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="delivery"
                    checked={formData.deliveryType === 'delivery'}
                    onChange={(e) => setFormData({ ...formData, deliveryType: e.target.value })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-[13px] font-['Poppins',sans-serif]">🚚 Delivery</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="pickup"
                    checked={formData.deliveryType === 'pickup'}
                    onChange={(e) => setFormData({ ...formData, deliveryType: e.target.value })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-[13px] font-['Poppins',sans-serif]">📦 Pickup</span>
                </label>
              </div>
            </div>

            {/* Shipping Address - Only for delivery */}
            {formData.deliveryType === 'delivery' && (
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                  Shipping Address <span className="text-red-500">*</span>
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

            {/* Order Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700">
                  Order Items <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-blue-600 text-white text-[12px] font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  + Add Item
                </button>
              </div>

              {errors.items && (
                <p className="mb-2 text-xs text-red-500">{errors.items}</p>
              )}

              <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {formData.items.length === 0 ? (
                  <p className="text-center text-gray-500 text-[13px] py-4">No items added yet</p>
                ) : (
                  formData.items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        {/* Product */}
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Product</label>
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                            className={`w-full px-2 py-1.5 text-[12px] border rounded ${errors[`item_${index}_product`] ? 'border-red-500' : 'border-gray-300'
                              }`}
                          >
                            <option value="">Select</option>
                            {filteredProducts.map((product) => {
                              const onShelf = product.inventory?.quantityOnShelf || 0;
                              return (
                                <option key={product._id} value={product._id}>
                                  {product.name} ({onShelf} available)
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            min="1"
                            className={`w-full px-2 py-1.5 text-[12px] border rounded ${errors[`item_${index}_quantity`] ? 'border-red-500' : 'border-gray-300'
                              }`}
                          />
                          {item.productId && (() => {
                            const product = products.find(p => p._id === item.productId);
                            const available = product?.inventory?.quantityOnShelf || 0;
                            return (
                              <p className={`text-[10px] mt-0.5 ${available > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                                {available} available
                              </p>
                            );
                          })()}
                          {errors[`item_${index}_quantity`] && (
                            <p className="text-[10px] text-red-500 mt-0.5">{errors[`item_${index}_quantity`]}</p>
                          )}
                        </div>

                        {/* Price */}
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Unit Price</label>
                          <input
                            type="text"
                            value={item.unitPrice ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.unitPrice) : '0 ₫'}
                            readOnly
                            className="w-full px-2 py-1.5 text-[12px] border rounded bg-gray-50 text-gray-600 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="mt-6 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 4H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M12.6667 4V13.3333C12.6667 14 12 14.6667 11.3333 14.6667H4.66667C4 14.6667 3.33333 14 3.33333 13.3333V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

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
                  className="w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  className="w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 text-[12px] font-['Poppins',sans-serif] border border-[#ced4da] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Additional notes..."
                maxLength={500}
              />
            </div>

            {/* Order Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-[13px] font-semibold text-gray-900 mb-3">Order Summary</h3>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculateSubtotal())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping Fee:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(formData.shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-red-600">
                    -{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(formData.discount)}
                  </span>
                </div>
                <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-blue-600 text-[15px]">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculateTotal())}
                  </span>
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
            Cancel
          </button>
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
            {loading ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
};
