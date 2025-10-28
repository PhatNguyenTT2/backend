import React, { useState, useEffect, useRef } from 'react';
// import productService from '../../services/productService';
// import purchaseOrderService from '../../services/purchaseOrderService';

export const EditPurchaseOrderModal = ({ isOpen, onClose, onSuccess, purchaseOrder = null }) => {
  const dropdownRefs = useRef({});

  const [formData, setFormData] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    shippingFee: 0,
    notes: ''
  });

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productSearchTerms, setProductSearchTerms] = useState({});
  const [showProductDropdown, setShowProductDropdown] = useState({});

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productService.getProducts({ per_page: 100 });
        if (response.success && response.data) {
          setProducts(response.data.products || []);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };

    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  // Populate form when purchaseOrder changes
  useEffect(() => {
    if (isOpen && purchaseOrder) {
      setFormData({
        orderDate: purchaseOrder.orderDate ? new Date(purchaseOrder.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate ? new Date(purchaseOrder.expectedDeliveryDate).toISOString().split('T')[0] : '',
        shippingFee: purchaseOrder.shippingFee || 0,
        notes: purchaseOrder.notes || ''
      });

      // Populate items
      if (purchaseOrder.items && purchaseOrder.items.length > 0) {
        const formattedItems = purchaseOrder.items.map(item => ({
          product: item.product?.id || item.product?._id || item.product,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0
        }));
        setItems(formattedItems);

        // Set search terms for existing items
        const terms = {};
        formattedItems.forEach((item, index) => {
          const product = products.find(p => (p.id || p._id) === getProductId(item.product));
          if (product) {
            terms[index] = product.sku ? `${product.sku} - ${product.name}` : product.name;
          }
        });
        setProductSearchTerms(terms);
      } else {
        setItems([]);
        setProductSearchTerms({});
      }

      setError(null);
      setShowProductDropdown({});
    }
  }, [isOpen, purchaseOrder]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Helper: Extract ID from object or return as-is
  const getProductId = (product) => {
    if (!product) return null;
    if (product === '') return null;
    if (typeof product === 'string') return product;
    if (typeof product === 'object') {
      return product.id || product._id || null;
    }
    return null;
  };

  // Add new item
  const addItem = () => {
    const newIndex = items.length;
    setItems([...items, { product: null, quantity: 1, unitPrice: 0 }]);
    setProductSearchTerms({ ...productSearchTerms, [newIndex]: '' });
    setShowProductDropdown({ ...showProductDropdown, [newIndex]: false });
  };

  // Remove item
  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);

    const newSearchTerms = {};
    const newShowDropdown = {};
    newItems.forEach((item, newIndex) => {
      const oldIndex = newIndex >= index ? newIndex + 1 : newIndex;
      if (productSearchTerms[oldIndex]) {
        newSearchTerms[newIndex] = productSearchTerms[oldIndex];
      }
      if (showProductDropdown[oldIndex] !== undefined) {
        newShowDropdown[newIndex] = showProductDropdown[oldIndex];
      }
    });
    setProductSearchTerms(newSearchTerms);
    setShowProductDropdown(newShowDropdown);
  };

  // Update item
  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Handle product search
  const handleProductSearch = (index, searchTerm) => {
    setProductSearchTerms({ ...productSearchTerms, [index]: searchTerm });
    setShowProductDropdown({ ...showProductDropdown, [index]: true });
  };

  // Select product
  const selectProduct = (index, productId) => {
    const product = products.find(p => (p.id || p._id) === productId);

    if (product) {
      const extractedId = getProductId(product);
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product: extractedId,
        unitPrice: product.costPrice || 0
      };
      setItems(newItems);

      const displayText = product.sku ? `${product.sku} - ${product.name}` : product.name;
      setProductSearchTerms({ ...productSearchTerms, [index]: displayText });
      setShowProductDropdown({ ...showProductDropdown, [index]: false });
    }
  };

  // Get filtered products
  const getFilteredProducts = (index) => {
    const searchTerm = productSearchTerms[index] || '';
    const selectedProductIds = items
      .map((item, idx) => idx !== index ? getProductId(item.product) : null)
      .filter(id => id !== null);

    let filtered = products.filter(product => {
      const productId = getProductId(product);
      if (selectedProductIds.includes(productId)) return false;
      if (!searchTerm) return true;
      return product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    return searchTerm ? filtered : filtered.slice(0, 20);
  };

  // Calculate totals
  const calculateTotal = () => {
    let subtotal = 0;
    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      if (qty > 0 && price >= 0) {
        subtotal += qty * price;
      }
    });

    const shippingFee = parseFloat(formData.shippingFee) || 0;
    const tax = subtotal * 0.1;
    const total = subtotal + shippingFee + tax;

    return { subtotal, shippingFee, tax, total };
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!purchaseOrder) {
      setError('Purchase order not found');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one product');
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productId = getProductId(item.product);

      if (!productId || productId.trim() === '') {
        setError(`Item ${i + 1}: Please select a product`);
        return;
      }

      const qty = parseFloat(item.quantity);
      if (!item.quantity || isNaN(qty) || qty <= 0) {
        setError(`Item ${i + 1}: Please enter a positive quantity`);
        return;
      }

      const price = parseFloat(item.unitPrice);
      if (item.unitPrice === undefined || item.unitPrice === null || isNaN(price) || price < 0) {
        setError(`Item ${i + 1}: Please enter a valid unit price`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate totals
      let subtotal = 0;
      items.forEach(item => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unitPrice) || 0;
        subtotal += qty * price;
      });

      subtotal = Math.round(subtotal * 100) / 100;
      const tax = Math.round(subtotal * 0.1 * 100) / 100;
      const shippingFee = Math.round((parseFloat(formData.shippingFee) || 0) * 100) / 100;

      const updateData = {
        orderDate: formData.orderDate,
        expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
        items: items.map(item => ({
          product: getProductId(item.product),
          quantity: parseInt(item.quantity),
          unitPrice: Math.round(parseFloat(item.unitPrice) * 100) / 100
        })),
        shippingFee: shippingFee,
        tax: tax,
        discount: 0,
        notes: formData.notes || undefined
      };

      const updated = await purchaseOrderService.updatePurchaseOrder(purchaseOrder.id, updateData);

      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err) {
      console.error('Error updating purchase order:', err);
      let errorMessage = 'Failed to update purchase order. Please try again.';
      if (err.error) {
        errorMessage = err.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !purchaseOrder) return null;

  const totals = calculateTotal();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Edit Purchase Order - {purchaseOrder.poNumber || purchaseOrder.purchaseOrderNumber}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
              {error}
            </div>
          )}

          {/* Supplier Info (Read-only) */}
          <div className="border-b pb-4">
            <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-3">
              Supplier Information (Read-only)
            </h3>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-[13px] font-['Poppins',sans-serif]">
                <div>
                  <span className="font-semibold text-gray-600">Supplier:</span>{' '}
                  <span className="text-gray-900">{purchaseOrder.supplierName || 'N/A'}</span>
                </div>
                {purchaseOrder.supplierCode && (
                  <div>
                    <span className="font-semibold text-gray-600">Code:</span>{' '}
                    <span className="text-gray-900">{purchaseOrder.supplierCode}</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-amber-600 font-['Poppins',sans-serif] mt-2">
                ⚠️ Supplier cannot be changed after purchase order creation
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                Order Date (Read-only)
              </label>
              <input
                type="date"
                value={formData.orderDate}
                readOnly
                disabled
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-amber-600 font-['Poppins',sans-serif] mt-1">
                Order date cannot be changed after creation
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                Expected Delivery Date <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                min={formData.orderDate}
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Products */}
          <div className="border-b pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Products
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[12px] font-['Poppins',sans-serif] font-medium flex items-center gap-1"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Add Product
              </button>
            </div>

            {items.length === 0 && (
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif] text-center py-4">
                No products added. Click "Add Product" to start.
              </p>
            )}

            {items.map((item, index) => {
              const productId = getProductId(item.product);
              const selectedProduct = products.find(p => getProductId(p) === productId);
              const filteredProducts = getFilteredProducts(index);

              return (
                <div key={index} className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                  <div ref={el => dropdownRefs.current[index] = el} className="flex-1 relative">
                    <input
                      type="text"
                      value={productSearchTerms[index] || ''}
                      onChange={(e) => handleProductSearch(index, e.target.value)}
                      onFocus={() => setShowProductDropdown({ ...showProductDropdown, [index]: true })}
                      placeholder="Search product by name or SKU..."
                      required={!item.product}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />

                    {selectedProduct && !showProductDropdown[index] && (
                      <div className="absolute inset-0 px-3 py-2 bg-white border border-emerald-500 rounded-lg text-[13px] font-['Poppins',sans-serif] flex items-center justify-between pointer-events-none">
                        <span className="text-emerald-700 font-medium truncate">
                          {selectedProduct.name}
                        </span>
                        <span className="text-blue-600 font-semibold text-[11px]">
                          Cost: ${selectedProduct.costPrice || 0}
                        </span>
                      </div>
                    )}

                    {showProductDropdown[index] && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                          <div className="px-3 py-2 text-[13px] text-gray-500 font-['Poppins',sans-serif]">
                            No products found
                          </div>
                        ) : (
                          filteredProducts.map(product => (
                            <button
                              key={product.id || product._id}
                              type="button"
                              onClick={() => selectProduct(index, product.id || product._id)}
                              className="w-full px-3 py-2 text-left text-[13px] font-['Poppins',sans-serif] hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{product.name}</span>
                                <div className="flex flex-col items-end">
                                  <span className="text-blue-600 font-semibold">Cost: ${product.costPrice || 0}</span>
                                  <span className="text-gray-500 text-[10px]">Sell: ${product.price}</span>
                                </div>
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
                      required
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                      min="0"
                      step="0.01"
                      required
                      placeholder="Unit Price"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="w-32 text-right">
                    <div className="text-[13px] font-semibold font-['Poppins',sans-serif] text-gray-900">
                      ${((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
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

          {/* Summary */}
          {items.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-[14px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-3">
                Purchase Order Summary
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[13px] font-['Poppins',sans-serif] items-center">
                  <span className="text-gray-600">Shipping Fee:</span>
                  <input
                    type="number"
                    value={formData.shippingFee}
                    onChange={(e) => setFormData({ ...formData, shippingFee: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                  <span className="text-gray-600">Tax (10%):</span>
                  <span className="font-medium">${totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t-2 pt-2 mt-2">
                  <span className="font-semibold text-[14px] font-['Poppins',sans-serif]">Total:</span>
                  <span className="font-semibold text-emerald-600 text-[16px] font-['Poppins',sans-serif]">
                    ${totals.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
              Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Any additional notes about this purchase order..."
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t-2 border-gray-200 mt-6 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-[13px] font-['Poppins',sans-serif] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-[13px] font-['Poppins',sans-serif] font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
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
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Update Purchase Order
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

