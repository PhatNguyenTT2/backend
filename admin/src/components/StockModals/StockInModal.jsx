import React, { useState, useEffect, useRef } from 'react';
// import productService from '../../services/productService';
// import supplierService from '../../services/supplierService';
// import inventoryService from '../../services/inventoryService';
// import purchaseOrderService from '../../services/purchaseOrderService';

export const StockInModal = ({ isOpen, onClose, onSuccess, preSelectedProduct = null }) => {
  const dropdownRefs = useRef({});

  const [formData, setFormData] = useState({
    supplier: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    warehouseLocation: '',
    shippingFee: 0,
    notes: ''
  });

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productSearchTerms, setProductSearchTerms] = useState({});
  const [showProductDropdown, setShowProductDropdown] = useState({});

  // Fetch products and suppliers
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productResponse, supplierResponse] = await Promise.all([
          productService.getProducts({ per_page: 100 }),
          supplierService.getSuppliers({ per_page: 100 })
        ]);

        if (productResponse.success && productResponse.data) {
          setProducts(productResponse.data.products || []);
        }

        if (supplierResponse.success && supplierResponse.data) {
          setSuppliers(supplierResponse.data.suppliers || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
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
          setShowProductDropdown(prev => ({ ...prev, [index]: false }));
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
          // Use SKU if available, otherwise use name
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
        supplier: '',
        orderDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: '',
        warehouseLocation: '',
        shippingFee: 0,
        notes: ''
      });
      if (preSelectedProduct) {
        // Handle preSelectedProduct - can be object or string ID
        let productId, productName, productPrice;

        if (typeof preSelectedProduct === 'object' && preSelectedProduct !== null) {
          // It's a product object
          productId = preSelectedProduct.id || preSelectedProduct._id;
          productName = preSelectedProduct.name || '';
          productPrice = preSelectedProduct.purchasePrice || preSelectedProduct.price || 0;
        } else if (typeof preSelectedProduct === 'string') {
          // It's just an ID - find the product in the products array
          productId = preSelectedProduct;
          const foundProduct = products.find(p => getProductId(p) === productId);
          productName = foundProduct?.name || '';
          productPrice = foundProduct?.purchasePrice || foundProduct?.price || 0;
        }

        console.log('Setting preselected product:', { productId, productName, productPrice });

        if (productId) {
          setItems([{
            product: productId,
            quantity: 1,
            unitPrice: productPrice
          }]);

          // Set display text with SKU if available
          let displayText = productName;
          if (typeof preSelectedProduct === 'object' && preSelectedProduct.sku) {
            displayText = `${preSelectedProduct.sku} - ${productName}`;
          } else {
            const foundProduct = products.find(p => getProductId(p) === productId);
            if (foundProduct?.sku) {
              displayText = `${foundProduct.sku} - ${productName}`;
            }
          }

          if (displayText) {
            setProductSearchTerms({ 0: displayText });
          }
        } else {
          setItems([]);
        }
      } else {
        setItems([]);
        setProductSearchTerms({});
      }
      setSelectedSupplier(null);
      setError(null);
      setShowProductDropdown({});
    }
  }, [isOpen, preSelectedProduct]);

  // Helper: Extract ID from object or return as-is
  const getProductId = (product) => {
    if (!product) return null;
    if (product === '') return null; // Empty string is also invalid
    if (typeof product === 'string') return product;
    if (typeof product === 'object') {
      return product.id || product._id || null;
    }
    return null;
  };

  // Handle supplier selection
  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find(s => (s.id || s._id) === supplierId);
    setSelectedSupplier(supplier);
    setFormData(prev => ({ ...prev, supplier: supplierId }));
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

      // Update both product and unitPrice in one go to avoid state race condition
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product: extractedId,
        // Use costPrice for purchase orders (not selling price)
        unitPrice: product.costPrice || 0
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

    if (!formData.supplier) {
      setError('Please select a supplier');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one product');
      return;
    }

    console.log('Validating items before submit. Total items:', items.length);
    console.log('Raw items:', JSON.stringify(items.map(item => ({
      product: item.product,
      productType: typeof item.product,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    })), null, 2));

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productId = getProductId(item.product);

      console.log(`Item ${i + 1} validation:`, {
        rawProduct: item.product,
        extractedProductId: productId,
        productType: typeof item.product,
        hasProductId: !!productId,
        productIdLength: productId?.length,
        quantity: item.quantity,
        quantityType: typeof item.quantity,
        unitPrice: item.unitPrice,
        unitPriceType: typeof item.unitPrice
      });

      if (!productId || productId.trim() === '') {
        setError(`Item ${i + 1}: Please select a product`);
        console.error(`Item ${i + 1} validation failed: no valid product ID`, {
          rawProduct: item.product,
          extractedId: productId
        });
        return;
      }

      const qty = parseFloat(item.quantity);
      if (!item.quantity || isNaN(qty) || qty <= 0) {
        setError(`Item ${i + 1}: Please enter a positive quantity`);
        console.error(`Item ${i + 1} validation failed: invalid quantity`, item.quantity);
        return;
      }

      const price = parseFloat(item.unitPrice);
      if (item.unitPrice === undefined || item.unitPrice === null || isNaN(price) || price < 0) {
        setError(`Item ${i + 1}: Please enter a valid unit price`);
        console.error(`Item ${i + 1} validation failed: invalid price`, item.unitPrice);
        return;
      }
    } setLoading(true);
    setError(null);

    try {
      // Calculate subtotal
      let subtotal = 0;
      items.forEach(item => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unitPrice) || 0;
        subtotal += qty * price;
      });

      // Round to 2 decimal places to avoid floating point precision issues
      subtotal = Math.round(subtotal * 100) / 100;
      const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10% tax
      const shippingFee = Math.round((parseFloat(formData.shippingFee) || 0) * 100) / 100;

      const poData = {
        supplier: formData.supplier,
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
      }; console.log('Creating purchase order with data:', JSON.stringify(poData, null, 2));
      const purchaseOrder = await purchaseOrderService.createPurchaseOrder(poData);
      console.log('Purchase order created:', purchaseOrder);

      // Backend transforms _id to id in toJSON
      const purchaseOrderId = purchaseOrder.id || purchaseOrder._id;

      if (!purchaseOrder || !purchaseOrderId) {
        console.error('Purchase order creation failed: Invalid response', purchaseOrder);
        throw new Error('Failed to create purchase order: Invalid response from server');
      }
      console.log('Purchase Order created successfully:', purchaseOrderId);

      // ⚠️ DO NOT stock in immediately
      // Stock will be updated when PO status changes to 'approved' or 'received'
      // This ensures proper workflow: Create PO → Approve → Receive Goods → Update Inventory

      if (onSuccess) {
        onSuccess({
          purchaseOrder,
          message: `Purchase Order ${purchaseOrder.poNumber} created successfully. Awaiting approval.`
        });
      }
      onClose();
    } catch (err) {
      console.error('Error in stock in:', err);
      console.error('Error details:', {
        message: err.message,
        error: err.error,
        response: err.response,
        stack: err.stack
      });

      let errorMessage = 'Failed to process stock in. Please try again.';

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

  const totals = calculateTotal();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Receive Stock from Supplier
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
              Supplier Information
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.supplier}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                      {supplier.supplierCode ? `${supplier.supplierCode} - ` : ''}{supplier.companyName}
                    </option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-['Poppins',sans-serif] mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    No suppliers available
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {selectedSupplier && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <h5 className="text-[12px] font-semibold font-['Poppins',sans-serif] text-emerald-900 mb-2">
                  Supplier Details:
                </h5>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-['Poppins',sans-serif] text-emerald-800">
                  <div>
                    <span className="font-semibold">Company:</span> {selectedSupplier.companyName}
                  </div>
                  {selectedSupplier.contactPerson?.name && (
                    <div>
                      <span className="font-semibold">Contact:</span> {selectedSupplier.contactPerson.name}
                      {selectedSupplier.contactPerson.position && ` (${selectedSupplier.contactPerson.position})`}
                    </div>
                  )}
                  {selectedSupplier.email && (
                    <div>
                      <span className="font-semibold">Email:</span> {selectedSupplier.email}
                    </div>
                  )}
                  {selectedSupplier.phone && (
                    <div>
                      <span className="font-semibold">Phone:</span> {selectedSupplier.phone}
                    </div>
                  )}
                  {selectedSupplier.contactPerson?.phone && (
                    <div>
                      <span className="font-semibold">Contact Phone:</span> {selectedSupplier.contactPerson.phone}
                    </div>
                  )}
                  {selectedSupplier.contactPerson?.email && (
                    <div>
                      <span className="font-semibold">Contact Email:</span> {selectedSupplier.contactPerson.email}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-b pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Products to Receive
              </h3>
              <button
                type="button"
                onClick={addItem}
                disabled={!formData.supplier}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[12px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Add Product
              </button>
            </div>

            {!formData.supplier && (
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif] text-center py-4">
                Please select a supplier first
              </p>
            )}

            {formData.supplier && items.length === 0 && (
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif] text-center py-4">
                No products added. Click "Add Product" to start.
              </p>
            )}

            {items.map((item, index) => {
              const productId = getProductId(item.product);
              const selectedProduct = products.find(p => getProductId(p) === productId);
              const filteredProducts = getFilteredProducts(index);

              // Debug log for rendering
              if (index === 0) {
                console.log('Rendering item 0:', {
                  rawProduct: item.product,
                  extractedProductId: productId,
                  selectedProduct: selectedProduct?.name || 'NOT FOUND',
                  searchTerm: productSearchTerms[index]
                });
              }

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
                        <span className="text-emerald-600 font-semibold ml-2 flex-shrink-0">
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
                                  <span className="text-emerald-600 font-semibold">
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

          <div className="grid grid-cols-2 gap-3">
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

            <div>
              <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                Warehouse Location <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.warehouseLocation}
                onChange={(e) => setFormData({ ...formData, warehouseLocation: e.target.value })}
                placeholder="e.g., Shelf-A-1, Zone B-15"
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
              Notes <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Any additional notes about this stock receipt..."
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
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
              disabled={loading || !formData.supplier || items.length === 0}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-[13px] font-['Poppins',sans-serif] font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
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
                    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Receive & Create PO
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
