import React, { useState, useEffect, useMemo } from 'react';
import orderService from '../../services/orderService';
import customerService from '../../services/customerService';
import productService from '../../services/productService';
import authService from '../../services/authService';
import employeeService from '../../services/employeeService';
import settingsService from '../../services/settingsService';

/**
 * AddOrderModal Component
 * 
 * Order Creation Flow:
 * 1. User selects customer
 * 2. User adds products with quantities (NO batch selection needed)
 * 3. Backend automatically selects batch using FEFO (First Expired First Out)
 * 4. System picks the batch on shelf with nearest expiry date
 * 5. OrderDetail is created with auto-selected batch
 * 
 * Price Logic:
 * - unitPrice comes from Product master data (reference price)
 * - unitPrice is saved in OrderDetail (price at transaction time)
 * - Batch selection is transparent to user
 */
export const AddOrderModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    customerId: '',
    deliveryType: 'delivery',
    shippingAddress: '',
    shippingFee: 0,
    notes: '',
    items: []
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Employee tracking for createdBy field
  const [currentUser, setCurrentUser] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  // Customer discount settings from system configuration
  const [customerDiscounts, setCustomerDiscounts] = useState({
    retail: 10,
    wholesale: 15,
    vip: 20
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        customerId: '',
        deliveryType: 'delivery',
        shippingAddress: '',
        shippingFee: 0,
        notes: '',
        items: []
      });
      setErrors({});
      loadCustomers();
      loadProducts();
      loadCurrentEmployee();
      loadCustomerDiscounts();
    }
  }, [isOpen]);

  // Load customers
  const loadCustomers = async () => {
    try {
      const data = await customerService.getAllCustomers({
        limit: 100,
        isActive: true
      });
      const customersList = data.data?.customers || data.customers || [];
      console.log('📥 Loaded customers:', customersList.length);
      setCustomers(customersList);
    } catch (error) {
      console.error('❌ Failed to load customers:', error);
      setErrors(prev => ({ ...prev, loadCustomers: 'Failed to load customers' }));
    }
  };

  // Load customer discount settings from system configuration
  const loadCustomerDiscounts = async () => {
    try {
      const response = await settingsService.getCustomerDiscounts();
      if (response.success && response.data) {
        setCustomerDiscounts(response.data);
        console.log('💰 Loaded customer discounts:', response.data);
      }
    } catch (error) {
      console.error('⚠️ Failed to load customer discounts, using defaults:', error);
      // Keep default values if fetch fails
    }
  };

  // Load current employee for createdBy field
  const loadCurrentEmployee = async () => {
    try {
      // Get current user from authService
      const user = authService.getUser();
      console.log('📥 Current user from authService:', user);
      setCurrentUser(user);

      // If user has employeeId, fetch full employee details
      if (user?.employeeId) {
        const employeeResponse = await employeeService.getEmployeeById(user.employeeId);
        console.log('👤 Employee response:', employeeResponse);

        if (employeeResponse.success && employeeResponse.data) {
          const employee = employeeResponse.data.employee;
          console.log('✅ Current employee loaded:', employee);
          setCurrentEmployee(employee);
        } else {
          console.warn('⚠️ Employee not found for user:', user);
          setErrors(prev => ({
            ...prev,
            employee: 'No active employee found. Please create an employee first.'
          }));
        }
      } else {
        console.warn('⚠️ User has no employeeId:', user);
        setErrors(prev => ({
          ...prev,
          employee: 'No active employee found. Please create an employee first.'
        }));
      }
    } catch (error) {
      console.error('❌ Failed to load employee:', error);
      setErrors(prev => ({
        ...prev,
        employee: 'Failed to load employee information'
      }));
    }
  };

  // Load products with inventory
  const loadProducts = async () => {
    try {
      const data = await productService.getAllProducts({
        limit: 200,
        isActive: true,
        withInventory: true
      });
      const productsList = data.data?.products || data.products || [];
      console.log('📥 Loaded products with inventory:', productsList.length);

      // Debug: Log first product's unitPrice structure
      if (productsList.length > 0) {
        const firstProduct = productsList[0];
        const price = getProductPrice(firstProduct);
        console.log('🔍 Sample product unitPrice:', {
          product: firstProduct.name,
          unitPrice: firstProduct.unitPrice,
          type: typeof firstProduct.unitPrice,
          parsed: price
        });
        console.log('📋 First product structure:', {
          _id: firstProduct._id,
          id: firstProduct.id,
          name: firstProduct.name,
          hasUnderscore_id: '_id' in firstProduct,
          hasId: 'id' in firstProduct,
          allKeys: Object.keys(firstProduct).slice(0, 10)
        });
        console.log('📋 First few products:', productsList.slice(0, 3).map(p => ({
          _id: p._id,
          id: p.id,
          name: p.name
        })));
      }

      setProducts(productsList);
      console.log('✅ Products set to state');
    } catch (error) {
      console.error('❌ Failed to load products:', error);
      setErrors(prev => ({ ...prev, loadProducts: 'Failed to load products' }));
    }
  };  // Helper: Get product unit price (handle Decimal128)
  const getProductPrice = (product) => {
    if (!product) return 0;

    const price = product.unitPrice;

    // Handle null or undefined
    if (price === null || price === undefined) return 0;

    // Handle Decimal128 object
    if (typeof price === 'object' && price !== null) {
      // Check if it's a Decimal128 object with $numberDecimal property
      if (price.$numberDecimal) {
        return parseFloat(price.$numberDecimal);
      }
      // Try toString() for other object types
      return parseFloat(price.toString());
    }

    // Handle number or string
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper: Get available quantity on shelf
  const getAvailableQuantity = (product) => {
    if (!product || !product.inventory) return 0;
    return product.inventory.quantityOnShelf ??
      product.inventory.quantityAvailable ??
      0;
  };

  // Add new item to order
  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { productId: '', quantity: 1, unitPrice: 0 }
      ]
    });
  };

  // Remove item from order
  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });

    // Clear related errors
    const newErrors = { ...errors };
    delete newErrors[`item_${index}_product`];
    delete newErrors[`item_${index}_quantity`];
    delete newErrors[`item_${index}_price`];
    setErrors(newErrors);
  };

  // Update item (product selection or quantity change)
  const handleItemChange = (index, field, value) => {
    console.log('🔄 handleItemChange called:', { index, field, value });

    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill price when product is selected
    if (field === 'productId' && value) {
      console.log('🔍 Looking for product with ID:', value);
      console.log('📦 Total products available:', products.length);

      // Find product by id or _id
      const product = products.find(p => (p.id || p._id) === value);
      console.log('🔍 Selected product:', {
        searchId: value,
        found: !!product,
        productName: product?.name,
        rawUnitPrice: product?.unitPrice,
        typeOfPrice: typeof product?.unitPrice
      });

      if (product) {
        const price = getProductPrice(product);
        newItems[index].unitPrice = price;
        console.log('💰 Auto-filled price for', product.name, ':', price);
      } else {
        console.warn('⚠️ Product not found in products array!');
        console.warn('Available product IDs:', products.map(p => p.id || p._id).slice(0, 5));
      }
    } setFormData({ ...formData, items: newItems });

    // Clear error for this field
    const errorKey = `item_${index}_${field === 'productId' ? 'product' : field}`;
    if (errors[errorKey]) {
      const newErrors = { ...errors };
      delete newErrors[errorKey];
      setErrors(newErrors);
    }
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

    // Validate customer
    if (!formData.customerId) {
      newErrors.customerId = 'Please select a customer';
    }

    // Validate shipping address for delivery orders
    if (formData.deliveryType === 'delivery' && !formData.shippingAddress.trim()) {
      newErrors.shippingAddress = 'Shipping address is required for delivery orders';
    }

    // Validate items
    if (formData.items.length === 0) {
      newErrors.items = 'Please add at least one item';
    }

    formData.items.forEach((item, index) => {
      // Validate product selection
      if (!item.productId) {
        newErrors[`item_${index}_product`] = 'Please select a product';
      }

      // Validate quantity
      if (item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = 'Quantity must be greater than 0';
      }

      // Validate price
      if (item.unitPrice < 0) {
        newErrors[`item_${index}_price`] = 'Price cannot be negative';
      }

      // Validate stock availability
      if (item.productId) {
        const product = products.find(p => p._id === item.productId);
        const availableQty = getAvailableQuantity(product);

        if (availableQty > 0 && item.quantity > availableQty) {
          newErrors[`item_${index}_quantity`] = `Only ${availableQty} available`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calculate subtotal
  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
  };

  // Get discount percentage based on customer type (memoized to avoid repeated calculations)
  const discountPercentage = useMemo(() => {
    if (!formData.customerId || customers.length === 0) return 0;

    const customer = customers.find(c => {
      const customerId = c.id || c._id;
      return customerId === formData.customerId ||
        (typeof customerId === 'object' ? customerId.toString() === formData.customerId : false);
    });

    if (!customer) return 0;

    // Use dynamic discount rates from system configuration
    const customerType = customer.customerType?.toLowerCase();

    if (customerType === 'guest') return 0;
    if (customerType === 'retail') return customerDiscounts.retail;
    if (customerType === 'wholesale') return customerDiscounts.wholesale;
    if (customerType === 'vip') return customerDiscounts.vip;

    return 0;
  }, [formData.customerId, customers, customerDiscounts]);

  // Get customer info for display (memoized)
  const selectedCustomerInfo = useMemo(() => {
    if (!formData.customerId || customers.length === 0) return null;
    return customers.find(c => {
      const customerId = c.id || c._id;
      return customerId === formData.customerId ||
        (typeof customerId === 'object' ? customerId.toString() === formData.customerId : false);
    });
  }, [formData.customerId, customers]);

  // Calculate discount amount
  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    return subtotal * (discountPercentage / 100);
  };

  // Calculate total
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    return subtotal + Number(formData.shippingFee) - discount;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate employee first
    if (!currentEmployee) {
      setErrors({
        submit: 'Cannot create order without employee information. Please ensure you are logged in as an employee.'
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        customer: formData.customerId,
        deliveryType: formData.deliveryType,
        shippingAddress: formData.deliveryType === 'delivery'
          ? formData.shippingAddress
          : undefined,
        shippingFee: Number(formData.shippingFee),
        notes: formData.notes || undefined,
        status: 'draft', // Default status when creating new order
        createdBy: currentEmployee._id || currentEmployee.id, // Add createdBy field
        items: formData.items.map(item => ({
          product: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
          // Backend will auto-select batch using FEFO and calculate discountPercentage from customer type
        }))
      };

      console.log('📤 Sending order data:', orderData);

      await orderService.createOrder(orderData);

      console.log('✅ Order created successfully');
      onSuccess && onSuccess();
      handleClose();
    } catch (error) {
      console.error('❌ Failed to create order:', error);
      setErrors({
        submit: error.response?.data?.error?.message ||
          error.response?.data?.message ||
          'Failed to create order'
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

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Create New Order
          </h2>
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
          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {errors.submit}
            </div>
          )}

          {/* Employee Error */}
          {errors.employee && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {errors.employee}
            </div>
          )}

          {/* Employee Info Display */}
          {currentEmployee && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-blue-600">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <h3 className="text-[13px] font-semibold text-blue-900">Order Created By</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-blue-700 mb-1">Employee Name</label>
                  <input
                    type="text"
                    value={currentEmployee.fullName || 'N/A'}
                    disabled
                    className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg text-[13px] bg-blue-100 text-blue-900 cursor-not-allowed font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-blue-700 mb-1">User Code</label>
                  <input
                    type="text"
                    value={currentUser?.userCode || 'N/A'}
                    disabled
                    className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg text-[13px] bg-blue-100 text-blue-900 cursor-not-allowed font-semibold"
                  />
                </div>
              </div>
              <p className="text-[10px] text-blue-700 mt-2">
                Current logged in employee
              </p>
            </div>
          )}

          {/* Customer Selection */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.customerId}
              onChange={(e) => {
                const value = e.target.value;
                console.log('👤 Customer selected:', value);
                handleChange('customerId', value);
              }}
              className={`w-full px-3 py-2 border ${errors.customerId ? 'border-red-500' : 'border-gray-300'} rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            >
              <option value="">Select customer</option>
              {customers.map((customer) => {
                const customerId = customer.id || customer._id;
                return (
                  <option key={customerId} value={customerId}>
                    {customer.fullName} {customer.phone ? `- ${customer.phone}` : ''} ({customer.customerType || 'N/A'})
                  </option>
                );
              })}
            </select>
            {errors.customerId && (
              <p className="mt-1 text-[11px] text-red-500 font-['Poppins',sans-serif]">
                {errors.customerId}
              </p>
            )}
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
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
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
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
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
                className={`w-full px-3 py-2 border ${errors.shippingAddress ? 'border-red-500' : 'border-gray-300'} rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none`}
              />
              {errors.shippingAddress && (
                <p className="mt-1 text-[11px] text-red-500 font-['Poppins',sans-serif]">
                  {errors.shippingAddress}
                </p>
              )}
            </div>
          )}

          {/* Order Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529]">
                Order Items <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[12px] font-['Poppins',sans-serif] font-medium flex items-center gap-1"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Add Item
              </button>
            </div>

            {/* FEFO Info Banner */}
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-[11px] text-blue-700 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>System will automatically select batch using FEFO (First Expired First Out)</span>
              </p>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              {formData.items.map((item, index) => {
                const product = products.find(p => (p.id || p._id) === item.productId);
                const availableQty = getAvailableQuantity(product);

                return (
                  <div key={index} className="flex gap-2 items-start p-3 bg-white rounded-lg border-2 border-blue-200">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      {/* Product Selection */}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-700 mb-1">
                          Product <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          className={`w-full px-3 py-2 border ${errors[`item_${index}_product`] ? 'border-red-500' : 'border-gray-300'} rounded-lg text-[12px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        >
                          <option value="">-- Select Product --</option>
                          {products.map((prod) => {
                            const onShelf = getAvailableQuantity(prod);
                            const productId = prod.id || prod._id;
                            return (
                              <option key={productId} value={productId}>
                                {prod.name} ({onShelf} in stock)
                              </option>
                            );
                          })}
                        </select>
                        {errors[`item_${index}_product`] && (
                          <p className="mt-1 text-[10px] text-red-500">{errors[`item_${index}_product`]}</p>
                        )}
                        {product && (
                          <p className="mt-1 text-[10px] text-emerald-600">
                            Available: {availableQty} units
                          </p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-700 mb-1">
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          min="1"
                          className={`w-full px-3 py-2 border ${errors[`item_${index}_quantity`] ? 'border-red-500' : 'border-gray-300'} rounded-lg text-[12px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {errors[`item_${index}_quantity`] && (
                          <p className="mt-1 text-[10px] text-red-500">{errors[`item_${index}_quantity`]}</p>
                        )}
                      </div>

                      {/* Unit Price (Read-only) */}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-700 mb-1">Unit Price</label>
                        <input
                          type="text"
                          value={formatCurrency(item.unitPrice)}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[12px] bg-gray-50 cursor-not-allowed"
                        />
                        <p className="mt-1 text-[10px] text-gray-600">
                          Total: {formatCurrency(item.quantity * item.unitPrice)}
                        </p>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="mt-7 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {errors.items && (
              <p className="text-[11px] text-red-500">{errors.items}</p>
            )}
          </div>

          {/* Fees */}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Discount Info (Auto-calculated) */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Discount (Auto)
              </label>
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif]">
                {discountPercentage}%
                {selectedCustomerInfo && (
                  <span className="text-gray-500 ml-1">
                    ({selectedCustomerInfo.customerType || 'N/A'})
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-gray-500 font-['Poppins',sans-serif]">
                Guest: 0% | Retail: {customerDiscounts.retail}% | Wholesale: {customerDiscounts.wholesale}% | VIP: {customerDiscounts.vip}%
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
              placeholder="Enter any additional notes"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
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
              {discountPercentage > 0 && (
                <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                  <span className="text-gray-600">Discount ({discountPercentage}%):</span>
                  <span className="text-red-600">- {formatCurrency(calculateDiscount())}</span>
                </div>
              )}
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
              disabled={loading}
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
                'Create Order'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
