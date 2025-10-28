import React, { useState, useEffect, useRef } from 'react';
// import productService from '../../services/productService';
// import inventoryService from '../../services/inventoryService';

export const AdjustStockModal = ({ isOpen, onClose, onSuccess, preSelectedProduct = null }) => {
  const dropdownRefs = useRef({});

  const [formData, setFormData] = useState({
    type: 'adjustment',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productSearchTerms, setProductSearchTerms] = useState({});
  const [showProductDropdown, setShowProductDropdown] = useState({});

  // Adjustment types
  const adjustmentTypes = [
    { value: 'adjustment', label: 'Adjustment', description: 'Increase/decrease quantity on hand' },
    { value: 'reserved', label: 'Reserved', description: 'Reserve stock (decrease available)' },
    { value: 'released', label: 'Released', description: 'Release reserved stock (increase available)' }
  ];

  // Fetch products
  useEffect(() => {
    const fetchData = async () => {
      try {
        const productResponse = await productService.getProducts({ per_page: 100 });

        if (productResponse.success && productResponse.data) {
          setProducts(productResponse.data.products || []);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(showProductDropdown).forEach(index => {
        if (showProductDropdown[index] &&
          dropdownRefs.current[index] &&
          !dropdownRefs.current[index].contains(event.target)) {
          setShowProductDropdown({ ...showProductDropdown, [index]: false });
        }
      });
    };

    if (Object.values(showProductDropdown).some(v => v)) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProductDropdown]);

  // Auto-sync product search terms when items change
  useEffect(() => {
    const newSearchTerms = { ...productSearchTerms };
    let updated = false;

    items.forEach((item, index) => {
      const productId = getProductId(item.product);
      if (productId && !productSearchTerms[index]) {
        const product = products.find(p => getProductId(p) === productId);
        if (product) {
          const displayText = product.sku ? `${product.sku} - ${product.name}` : product.name;
          newSearchTerms[index] = displayText;
          updated = true;
        }
      }
    });

    if (updated) {
      console.log('Auto-syncing search terms:', newSearchTerms);
      setProductSearchTerms(newSearchTerms);
    }
  }, [items, products]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        type: 'adjustment',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });

      if (preSelectedProduct) {
        // Handle preSelectedProduct - can be object or string ID
        let productId, productName;

        if (typeof preSelectedProduct === 'object' && preSelectedProduct !== null) {
          productId = preSelectedProduct.id || preSelectedProduct._id;
          productName = preSelectedProduct.name || preSelectedProduct.productName;
        } else {
          productId = preSelectedProduct;
          const product = products.find(p => (p.id || p._id) === productId);
          productName = product?.name || '';
        }

        console.log('Setting preselected product:', { productId, productName });

        if (productId) {
          setItems([{
            product: productId,
            quantity: 0,
            adjustmentType: 'increase'
          }]);

          const displayText = productName;
          setProductSearchTerms({ 0: displayText });
        } else {
          console.warn('Invalid preSelectedProduct:', preSelectedProduct);
          setItems([]);
          setProductSearchTerms({});
        }
      } else {
        setItems([]);
        setProductSearchTerms({});
      }
      setError(null);
      setShowProductDropdown({});
    }
  }, [isOpen, preSelectedProduct, products]);

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
    setItems([...items, {
      product: null,
      quantity: 0,
      adjustmentType: formData.type === 'adjustment' ? 'increase' : null
    }]);
    setProductSearchTerms({ ...productSearchTerms, [newIndex]: '' });
    setShowProductDropdown({ ...showProductDropdown, [newIndex]: false });
  };

  // Remove item
  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);

    // Rebuild search terms and dropdown state with new indices
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
    console.log(`UpdateItem[${index}]: ${field} =`, value, 'Item after update:', newItems[index]);
    setItems(newItems);
  };

  // Handle product search
  const handleProductSearch = (index, searchTerm) => {
    setProductSearchTerms({ ...productSearchTerms, [index]: searchTerm });
    setShowProductDropdown({ ...showProductDropdown, [index]: true });
  };

  // Select product
  const selectProduct = (index, productId) => {
    console.log(`SelectProduct[${index}]: productId =`, productId);
    const product = products.find(p => (p.id || p._id) === productId);
    console.log(`SelectProduct[${index}]: found product =`, product ? product.name : 'NOT FOUND');

    if (product) {
      const extractedId = getProductId(product);
      console.log(`SelectProduct[${index}]: extracted ID =`, extractedId);

      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product: extractedId
      };
      console.log(`SelectProduct[${index}]: updated item =`, newItems[index]);
      setItems(newItems);

      // Use SKU if available, otherwise use name
      const displayText = product.sku ? `${product.sku} - ${product.name}` : product.name;
      setProductSearchTerms({ ...productSearchTerms, [index]: displayText });
      setShowProductDropdown({ ...showProductDropdown, [index]: false });
    }
  };

  // Get filtered products (exclude already selected products)
  const getFilteredProducts = (index) => {
    const searchTerm = productSearchTerms[index] || '';

    // Get list of already selected product IDs (excluding current item)
    const selectedProductIds = items
      .map((item, idx) => idx !== index ? getProductId(item.product) : null)
      .filter(id => id !== null);

    // Filter products
    let filtered = products.filter(product => {
      const productId = getProductId(product);

      // Exclude already selected products
      if (selectedProductIds.includes(productId)) {
        return false;
      }

      // Apply search filter
      if (!searchTerm) return true;

      return product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    // Limit to 20 results if no search term
    return searchTerm ? filtered : filtered.slice(0, 20);
  };

  // Generate reference ID based on type
  const generateReferenceId = (type) => {
    const timestamp = Date.now();
    const prefix = {
      'adjustment': 'ADJ',
      'reserved': 'RSV',
      'released': 'REL'
    }[type] || 'ADJ';
    return `${prefix}-${timestamp}`;
  };

  // Get reference type based on adjustment type
  const getReferenceType = (type) => {
    const typeMap = {
      'adjustment': 'stock_adjustment',
      'reserved': 'reservation',
      'released': 'release'
    };
    return typeMap[type] || 'stock_adjustment';
  };

  // Handle type change
  const handleTypeChange = (newType) => {
    setFormData({ ...formData, type: newType });

    // Update all items' adjustmentType if switching to/from adjustment
    const newItems = items.map(item => ({
      ...item,
      adjustmentType: newType === 'adjustment' ? (item.adjustmentType || 'increase') : null
    }));
    setItems(newItems);
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (items.length === 0) {
      setError('Please add at least one product');
      return;
    }

    console.log('Validating items before submit. Total items:', items.length);

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

      if (formData.type === 'adjustment' && !item.adjustmentType) {
        setError(`Item ${i + 1}: Please select increase or decrease`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const referenceId = generateReferenceId(formData.type);
      const referenceType = getReferenceType(formData.type);

      // Process each item
      const adjustmentPromises = items.map(async (item) => {
        const productId = getProductId(item.product);
        const quantity = parseInt(item.quantity);

        let adjustmentData = {
          type: formData.type,
          quantity: quantity,
          referenceId: referenceId,
          referenceType: referenceType,
          notes: formData.notes || undefined
        };

        // For adjustment type, include whether it's increase or decrease
        if (formData.type === 'adjustment') {
          adjustmentData.adjustmentType = item.adjustmentType; // 'increase' or 'decrease'
        }

        console.log(`Adjusting stock for product ${productId}:`, adjustmentData);

        // Call the inventory service to adjust stock
        return await inventoryService.adjustStock(productId, adjustmentData);
      });

      await Promise.all(adjustmentPromises);
      console.log('All adjustments completed successfully');

      if (onSuccess) {
        onSuccess({
          type: formData.type,
          items: items.length,
          referenceId: referenceId
        });
      }
      onClose();
    } catch (err) {
      console.error('Error in stock adjustment:', err);
      console.error('Error details:', {
        message: err.message,
        error: err.error,
        response: err.response,
        stack: err.stack
      });

      let errorMessage = 'Failed to process stock adjustment. Please try again.';

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

  if (!isOpen) return null;

  const selectedType = adjustmentTypes.find(t => t.value === formData.type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Adjust Inventory Stock
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

          <div className="border-b pb-4">
            <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-3">
              Adjustment Information
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Adjustment Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {adjustmentTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {selectedType && (
                  <p className="text-[11px] text-gray-600 font-['Poppins',sans-serif] mt-1">
                    {selectedType.description}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-[12px] font-semibold font-['Poppins',sans-serif] text-blue-900 mb-1">
                Reference Information (Auto-generated):
              </h5>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-['Poppins',sans-serif] text-blue-800">
                <div>
                  <span className="font-semibold">Reference Type:</span> {getReferenceType(formData.type)}
                </div>
                <div>
                  <span className="font-semibold">Reference ID:</span> Will be generated on submit
                </div>
              </div>
            </div>
          </div>

          <div className="border-b pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Products to Adjust
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-[12px] font-['Poppins',sans-serif] font-medium flex items-center gap-1"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {selectedProduct && !showProductDropdown[index] && (
                      <div className="absolute inset-0 px-3 py-2 bg-white border border-blue-500 rounded-lg text-[13px] font-['Poppins',sans-serif] flex items-center justify-between pointer-events-none">
                        <span className="text-blue-700 font-medium truncate">
                          {selectedProduct.name}
                          {selectedProduct.sku && ` (${selectedProduct.sku})`}
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
                              className="w-full px-3 py-2 text-left text-[13px] font-['Poppins',sans-serif] hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{product.name}</span>
                                <div className="flex flex-col items-end">
                                  <span className="text-blue-600 font-semibold">
                                    Cost: ${product.costPrice || 0}
                                  </span>
                                  <span className="text-gray-500 text-[10px]">
                                    Sell: ${product.price}
                                  </span>
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

                  {formData.type === 'adjustment' && (
                    <div className="w-32">
                      <select
                        value={item.adjustmentType || 'increase'}
                        onChange={(e) => updateItem(index, 'adjustmentType', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="increase">Increase</option>
                        <option value="decrease">Decrease</option>
                      </select>
                    </div>
                  )}

                  <div className="w-28">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      min="1"
                      required
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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

          <div>
            <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
              Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Reason for adjustment, additional notes..."
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

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
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-['Poppins',sans-serif] font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 5L6 12L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Adjust Stock
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
