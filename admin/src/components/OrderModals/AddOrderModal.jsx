import React, { useState, useEffect, useRef } from 'react';
import productService from '../../services/productService';
import customerService from '../../services/customerService';
import orderService from '../../services/orderService';

export const AddOrderModal = ({ isOpen, onClose, onSuccess }) => {
  const dropdownRefs = useRef({});
  const [formData, setFormData] = useState({
    customer: {
      name: '',
      email: '',
      phone: ''
    },
    deliveryType: 'delivery', // 'delivery' or 'pickup'
    shippingAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Vietnam'
    },
    paymentMethod: 'cash',
    customerNote: ''
  });

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productSearchTerms, setProductSearchTerms] = useState({}); // For searchable dropdown
  const [showProductDropdown, setShowProductDropdown] = useState({}); // Track which dropdown is open

  // Fetch products and customers
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productResponse, customerResponse] = await Promise.all([
          productService.getProducts({ per_page: 100 }),
          customerService.getCustomers({ per_page: 100 })
        ]);

        if (productResponse.success && productResponse.data) {
          setProducts(productResponse.data.products || []);
        }

        if (customerResponse.success && customerResponse.data) {
          setCustomers(customerResponse.data.customers || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Auto-fill customer info when selecting existing customer
  useEffect(() => {
    if (selectedCustomer) {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (customer) {
        setFormData(prev => ({
          ...prev,
          customer: {
            name: customer.fullName,
            email: customer.email,
            phone: customer.phone
          },
          shippingAddress: {
            street: customer.address?.street || '',
            city: customer.address?.city || '',
            state: customer.address?.state || '',
            zipCode: customer.address?.zipCode || '',
            country: customer.address?.country || 'Vietnam'
          }
        }));
      }
    }
  }, [selectedCustomer, customers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(showProductDropdown).forEach(index => {
        if (showProductDropdown[index] &&
          dropdownRefs.current[index] &&
          !dropdownRefs.current[index].contains(event.target)) {
          setShowProductDropdown(prev => ({ ...prev, [index]: false }));
        }
      });
    };

    if (Object.values(showProductDropdown).some(v => v)) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProductDropdown]);

  // Reset form
  useEffect(() => {
    if (isOpen) {
      setFormData({
        customer: { name: '', email: '', phone: '' },
        deliveryType: 'delivery',
        shippingAddress: { street: '', city: '', state: '', zipCode: '', country: 'Vietnam' },
        paymentMethod: 'cash',
        customerNote: ''
      });
      setItems([]);
      setSelectedCustomer('');
      setError(null);
      setProductSearchTerms({});
      setShowProductDropdown({});
    }
  }, [isOpen]);

  const addItem = () => {
    const newIndex = items.length;
    setItems([...items, { product: '', quantity: 1 }]);
    setProductSearchTerms({ ...productSearchTerms, [newIndex]: '' });
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
    // Clean up search terms
    const newSearchTerms = { ...productSearchTerms };
    delete newSearchTerms[index];
    setProductSearchTerms(newSearchTerms);
    const newShowDropdown = { ...showProductDropdown };
    delete newShowDropdown[index];
    setShowProductDropdown(newShowDropdown);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleProductSearch = (index, searchTerm) => {
    setProductSearchTerms({ ...productSearchTerms, [index]: searchTerm });
    setShowProductDropdown({ ...showProductDropdown, [index]: true });
  };

  const selectProduct = (index, productId) => {
    updateItem(index, 'product', productId);
    const product = products.find(p => p.id === productId);
    setProductSearchTerms({ ...productSearchTerms, [index]: product ? product.name : '' });
    setShowProductDropdown({ ...showProductDropdown, [index]: false });
  };

  const getFilteredProducts = (index) => {
    const searchTerm = productSearchTerms[index] || '';

    // Get list of already selected product IDs (excluding current item)
    const selectedProductIds = items
      .map((item, idx) => idx !== index ? item.product : null)
      .filter(id => id !== null);

    // Filter products
    let filtered = products.filter(product => {
      // Exclude already selected products
      if (selectedProductIds.includes(product.id)) {
        return false;
      }

      // If search term exists, filter by name or SKU
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return product.name.toLowerCase().includes(searchLower) ||
          (product.sku && product.sku.toLowerCase().includes(searchLower));
      }

      return true;
    });

    // Limit to 20 results if no search term
    return searchTerm ? filtered : filtered.slice(0, 20);
  };

  const calculateTotal = () => {
    let subtotal = 0;
    items.forEach(item => {
      const product = products.find(p => p.id === item.product);
      if (product && item.quantity) {
        subtotal += product.price * item.quantity;
      }
    });

    // Determine customer type and discount
    let customerType = 'retail';
    let discountPercentage = 0;
    let discount = 0;
    let isWalkIn = false;

    if (selectedCustomer) {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (customer) {
        customerType = customer.customerType || 'retail';
      }
    } else {
      // No customer selected = walk-in customer
      isWalkIn = true;
    }

    // Calculate discount based on customer type
    if (customerType === 'wholesale') {
      discountPercentage = 10;
      discount = subtotal * 0.10;
    } else if (customerType === 'vip') {
      discountPercentage = 15;
      discount = subtotal * 0.15;
    }

    // Calculate shipping fee
    // Walk-in customers: pay $10 shipping if delivery
    // Existing customers: free shipping
    // Pickup: always free
    let shippingFee = 0;
    if (formData.deliveryType === 'delivery' && isWalkIn) {
      shippingFee = 10;
    }

    const tax = subtotal * 0.1;
    const total = subtotal - discount + shippingFee + tax;

    return { subtotal, shippingFee, tax, discount, discountPercentage, customerType, total, isWalkIn };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customer.name || !formData.customer.email || !formData.customer.phone) {
      setError('Customer name, email, and phone are required');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one product');
      return;
    }

    // Validate all items have product and quantity
    for (let item of items) {
      if (!item.product || !item.quantity || item.quantity <= 0) {
        setError('All items must have a product and positive quantity');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const orderData = {
        customer: formData.customer,
        deliveryType: formData.deliveryType,
        shippingAddress: formData.deliveryType === 'delivery' ? formData.shippingAddress : undefined,
        items: items.map(item => {
          const product = products.find(p => p.id === item.product);
          const quantity = parseInt(item.quantity);
          return {
            product: item.product,
            productName: product?.name,
            productImage: product?.imageUrl,
            price: product?.price,
            quantity: quantity,
            subtotal: product ? product.price * quantity : 0
          };
        }),
        paymentMethod: formData.paymentMethod,
        customerNote: formData.customerNote || undefined
      };

      const response = await orderService.createOrder(orderData);

      if (onSuccess) {
        onSuccess(response);
      }
      onClose();
    } catch (err) {
      setError(err.error || err.message || 'Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totals = calculateTotal();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Create New Order
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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

          {/* Customer Selection */}
          <div className="border-b pb-4">
            <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-3">
              Customer Information
            </h3>

            <div className="mb-3">
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Select Existing Customer (Optional)
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">New Customer / Walk-in</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName} - {customer.email} - {customer.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer.name}
                  onChange={(e) => setFormData({ ...formData, customer: { ...formData.customer, name: e.target.value } })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.customer.email}
                  onChange={(e) => setFormData({ ...formData, customer: { ...formData.customer, email: e.target.value } })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.customer.phone}
                  onChange={(e) => setFormData({ ...formData, customer: { ...formData.customer, phone: e.target.value } })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="border-b pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Order Items
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[12px] font-['Poppins',sans-serif] font-medium"
              >
                + Add Item
              </button>
            </div>

            {items.length === 0 && (
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif] text-center py-4">
                No items added. Click "Add Item" to start.
              </p>
            )}

            {items.map((item, index) => {
              const selectedProduct = products.find(p => p.id === item.product);
              const filteredProducts = getFilteredProducts(index);

              return (
                <div key={index} className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                  <div
                    ref={el => dropdownRefs.current[index] = el}
                    className="flex-1 relative"
                  >
                    <input
                      type="text"
                      value={productSearchTerms[index] || ''}
                      onChange={(e) => handleProductSearch(index, e.target.value)}
                      onFocus={() => setShowProductDropdown({ ...showProductDropdown, [index]: true })}
                      placeholder="Search product by name or SKU..."
                      required={!item.product}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />

                    {/* Selected product display */}
                    {selectedProduct && !showProductDropdown[index] && (
                      <div className="absolute inset-0 px-3 py-2 bg-white border border-emerald-500 rounded-lg text-[13px] font-['Poppins',sans-serif] flex items-center justify-between pointer-events-none">
                        <span className="text-emerald-700 font-medium">
                          {selectedProduct.name} - ${selectedProduct.price} (Stock: {selectedProduct.stock})
                        </span>
                      </div>
                    )}

                    {/* Dropdown list */}
                    {showProductDropdown[index] && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                          <div className="px-3 py-2 text-[13px] text-gray-500 font-['Poppins',sans-serif]">
                            No products found
                          </div>
                        ) : (
                          filteredProducts.map(product => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => selectProduct(index, product.id)}
                              className="w-full px-3 py-2 text-left text-[13px] font-['Poppins',sans-serif] hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{product.name}</span>
                                <span className="text-emerald-600 font-semibold">${product.price}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-gray-500 text-[11px]">
                                {product.sku && <span>SKU: {product.sku}</span>}
                                <span>•</span>
                                <span className={product.stock > 0 ? 'text-green-600' : 'text-red-600'}>
                                  Stock: {product.stock}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      min="1"
                      max={selectedProduct?.stock || 999}
                      required
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="w-32 text-right">
                    <div className="text-[13px] font-semibold font-['Poppins',sans-serif] text-gray-900">
                      ${((parseFloat(item.quantity) || 0) * (parseFloat(selectedProduct?.price) || 0)).toFixed(2)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4H14M6 4V3C6 2.5 6.5 2 7 2H9C9.5 2 10 2.5 10 3V4M12 4V13C12 13.5 11.5 14 11 14H5C4.5 14 4 13.5 4 13V4H12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          {items.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[14px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                  Order Summary
                </h4>
                {totals.isWalkIn ? (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-[11px] font-bold uppercase">
                    WALK-IN
                  </span>
                ) : (
                  <span className={`px-2 py-1 rounded text-[11px] font-bold uppercase ${totals.customerType === 'vip' ? 'bg-purple-100 text-purple-700' :
                    totals.customerType === 'wholesale' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                    {totals.customerType}
                  </span>
                )}
              </div>
              <div className="space-y-1 text-[13px] font-['Poppins',sans-serif]">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({totals.discountPercentage}%):</span>
                    <span className="font-medium">-${totals.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping:</span>
                  {totals.shippingFee > 0 ? (
                    <span className="font-medium">${totals.shippingFee.toFixed(2)}</span>
                  ) : (
                    <span className="font-medium text-green-600">FREE</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (10%):</span>
                  <span className="font-medium">${totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-semibold">Total:</span>
                  <span className="font-semibold text-emerald-600">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Type & Shipping Address */}
          <div className="border-b pb-4">
            <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-3">
              Delivery Information
            </h3>

            {/* Delivery Type Selection */}
            <div className="mb-4">
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Delivery Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="delivery"
                    checked={formData.deliveryType === 'delivery'}
                    onChange={(e) => setFormData({ ...formData, deliveryType: e.target.value })}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="ml-2 text-[13px] font-['Poppins',sans-serif] text-[#212529]">
                    Delivery (Ship)
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="deliveryType"
                    value="pickup"
                    checked={formData.deliveryType === 'pickup'}
                    onChange={(e) => setFormData({ ...formData, deliveryType: e.target.value })}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="ml-2 text-[13px] font-['Poppins',sans-serif] text-[#212529]">
                    Pickup (In-store)
                  </span>
                </label>
              </div>
            </div>

            {/* Shipping Address - Only show for delivery */}
            {formData.deliveryType === 'delivery' && (
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Shipping Address
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formData.shippingAddress.street}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: { ...formData.shippingAddress, street: e.target.value } })}
                      placeholder="Street Address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={formData.shippingAddress.city}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: { ...formData.shippingAddress, city: e.target.value } })}
                      placeholder="City"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pickup Notice */}
            {formData.deliveryType === 'pickup' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-[13px] font-medium font-['Poppins',sans-serif] text-blue-900">
                      In-store Pickup
                    </p>
                    <p className="text-[12px] font-['Poppins',sans-serif] text-blue-700 mt-0.5">
                      Customer will pick up the order at the store. No shipping address required.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="e_wallet">E-Wallet</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Customer Note
              </label>
              <input
                type="text"
                value={formData.customerNote}
                onChange={(e) => setFormData({ ...formData, customerNote: e.target.value })}
                placeholder="Optional note from customer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
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
              disabled={loading || items.length === 0}
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

