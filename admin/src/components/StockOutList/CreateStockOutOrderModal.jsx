import React, { useState, useEffect, useRef } from 'react';
import stockOutOrderService from '../../services/stockOutOrderService';
import detailStockOutOrderService from '../../services/detailStockOutOrderService';
import authService from '../../services/authService';
import employeeService from '../../services/employeeService';

export const CreateStockOutOrderModal = ({ isOpen, onClose, onSuccess, inventoryList = [] }) => {
  const dropdownRefs = useRef({});

  const [formData, setFormData] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    reason: 'sales',
    destination: '',
    notes: ''
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  // Product search states
  const [productSearchTerms, setProductSearchTerms] = useState({});
  const [showProductDropdown, setShowProductDropdown] = useState({});

  // Batch search states
  const [batchSearchTerms, setBatchSearchTerms] = useState({});
  const [showBatchDropdown, setShowBatchDropdown] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setFormData({
        orderDate: new Date().toISOString().split('T')[0],
        reason: 'sales',
        destination: '',
        notes: ''
      });
      setItems([]);
      setProductSearchTerms({});
      setShowProductDropdown({});
      setBatchSearchTerms({});
      setShowBatchDropdown({});
      setError(null);

      // Get current user and fetch employee data
      const fetchEmployeeData = async () => {
        try {
          const user = authService.getUser();
          setCurrentUser(user);

          // Fetch employee if user has employeeId
          if (user?.employeeId) {
            const employeeResponse = await employeeService.getEmployeeById(user.employeeId);
            if (employeeResponse.success && employeeResponse.data) {
              setCurrentEmployee(employeeResponse.data.employee);
            }
          }
        } catch (err) {
          console.error('Error fetching employee:', err);
        }
      };

      fetchEmployeeData();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.entries(dropdownRefs.current).forEach(([key, ref]) => {
        if (ref && !ref.contains(event.target)) {
          const [type, index] = key.split('-');
          if (type === 'product') {
            setShowProductDropdown(prev => ({ ...prev, [index]: false }));
          } else if (type === 'batch') {
            setShowBatchDropdown(prev => ({ ...prev, [index]: false }));
          }
        }
      });
    };

    if (Object.values(showProductDropdown).some(v => v) || Object.values(showBatchDropdown).some(v => v)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductDropdown, showBatchDropdown]);

  // Get unique products from inventoryList (only products with available stock)
  const getUniqueProducts = () => {
    console.log('DEBUG: inventoryList length:', inventoryList.length);
    console.log('DEBUG: inventoryList sample:', inventoryList[0]);

    const productMap = new Map();

    inventoryList.forEach(item => {
      // Only check onHand (warehouse stock) > 0
      const onHand = item.quantityOnHand || 0;

      console.log('DEBUG: Processing item:', {
        batchCode: item.batchId?.batchCode,
        onHand: item.quantityOnHand,
        onShelf: item.quantityOnShelf,
        reserved: item.quantityReserved
      });

      // Only process items with onHand stock > 0
      if (onHand <= 0) {
        return;
      }

      // Get product from populated batchId
      const product = item.batchId?.product;
      const productId = product?._id || product?.id;

      console.log('DEBUG: Product from batch:', product);
      console.log('DEBUG: Product ID:', productId);
      console.log('DEBUG: Product name:', product?.name);

      if (product && productId) {
        // Add to map (will automatically deduplicate by product ID)
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            id: productId,
            name: product.name,
            productCode: product.productCode
          });
          console.log('DEBUG: Added product to map:', product.name);
        }
      }
    });

    const products = Array.from(productMap.values());
    console.log('DEBUG: unique products:', products.length);
    console.log('DEBUG: products array:', products);
    return products;
  };

  // Product selection
  const addItem = () => {
    const newIndex = items.length;
    setItems([...items, { product: '', batch: '', quantity: 1, unitPrice: 0, onHandQty: 0, batchCode: '', expiryDate: null }]);
    setProductSearchTerms({ ...productSearchTerms, [newIndex]: '' });
    setShowProductDropdown({ ...showProductDropdown, [newIndex]: false });
    setBatchSearchTerms({ ...batchSearchTerms, [newIndex]: '' });
    setShowBatchDropdown({ ...showBatchDropdown, [newIndex]: false });
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);

    // Re-index search terms and dropdowns
    const newProductSearchTerms = {};
    const newShowProductDropdown = {};
    const newBatchSearchTerms = {};
    const newShowBatchDropdown = {};
    newItems.forEach((item, newIndex) => {
      newProductSearchTerms[newIndex] = productSearchTerms[newIndex] || '';
      newShowProductDropdown[newIndex] = false;
      newBatchSearchTerms[newIndex] = batchSearchTerms[newIndex] || '';
      newShowBatchDropdown[newIndex] = false;
    });
    setProductSearchTerms(newProductSearchTerms);
    setShowProductDropdown(newShowProductDropdown);
    setBatchSearchTerms(newBatchSearchTerms);
    setShowBatchDropdown(newShowBatchDropdown);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // If product changed, clear batch and related fields
    if (field === 'product') {
      newItems[index].batch = '';
      newItems[index].onHandQty = 0;
      newItems[index].batchCode = '';
      newItems[index].expiryDate = null;
      newItems[index].unitPrice = 0;
      setBatchSearchTerms({ ...batchSearchTerms, [index]: '' });
    }

    setItems(newItems);
  };

  const handleProductSearch = (index, searchTerm) => {
    setProductSearchTerms({ ...productSearchTerms, [index]: searchTerm });
    setShowProductDropdown({ ...showProductDropdown, [index]: true });
  };

  const selectProduct = (index, productId) => {
    const products = getUniqueProducts();
    const product = products.find(p => p.id === productId);
    if (product) {
      updateItem(index, 'product', productId);
      setProductSearchTerms({ ...productSearchTerms, [index]: product.name });
      setShowProductDropdown({ ...showProductDropdown, [index]: false });
    }
  };

  const getFilteredProducts = (index) => {
    const searchTerm = productSearchTerms[index] || '';
    const products = getUniqueProducts();
    const selectedProductIds = items
      .map((item, idx) => idx !== index ? item.product : null)
      .filter(id => id);

    let filtered = products.filter(product => {
      if (selectedProductIds.includes(product.id)) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return product.name?.toLowerCase().includes(term) ||
        product.productCode?.toLowerCase().includes(term);
    });

    return searchTerm ? filtered : filtered.slice(0, 20);
  };

  // Batch selection
  const handleBatchSearch = (index, searchTerm) => {
    setBatchSearchTerms({ ...batchSearchTerms, [index]: searchTerm });
    setShowBatchDropdown({ ...showBatchDropdown, [index]: true });
  };

  const selectBatch = (index, detailInventory) => {
    const batchId = detailInventory.batchId?._id || detailInventory.batchId?.id;
    const batchCode = detailInventory.batchId?.batchCode;
    const onHand = detailInventory.quantityOnHand || 0;

    // Get unitPrice from batch (handle Decimal128 type)
    const unitPrice = detailInventory.batchId?.unitPrice?.$numberDecimal
      ? parseFloat(detailInventory.batchId.unitPrice.$numberDecimal)
      : (typeof detailInventory.batchId?.unitPrice === 'number'
        ? detailInventory.batchId.unitPrice
        : 0);

    // Update all fields at once to avoid React state batching issues
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      batch: batchId,
      onHandQty: onHand,
      batchCode: batchCode,
      expiryDate: detailInventory.batchId?.expiryDate,
      unitPrice: unitPrice
    };
    setItems(newItems);

    setBatchSearchTerms({ ...batchSearchTerms, [index]: batchCode });
    setShowBatchDropdown({ ...showBatchDropdown, [index]: false });
  };

  const getFilteredBatches = (index) => {
    const item = items[index];
    if (!item || !item.product) return [];

    const searchTerm = batchSearchTerms[index] || '';

    // Get batches for selected product with onHand stock > 0
    const productBatches = inventoryList.filter(invItem => {
      const product = invItem.batchId?.product || invItem.batchId?.productId;
      const productId = product?._id || product?.id;
      const onHand = invItem.quantityOnHand || 0;
      return productId === item.product && onHand > 0;
    });

    // Filter by search term
    let filtered = productBatches;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = productBatches.filter(invItem => {
        const batchCode = invItem.batchId?.batchCode?.toLowerCase() || '';
        return batchCode.includes(term);
      });
    }

    return searchTerm ? filtered : filtered.slice(0, 20);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.product) {
        setError(`Item ${i + 1}: Please select a product`);
        return;
      }

      if (!item.batch) {
        setError(`Item ${i + 1}: Please select a batch`);
        return;
      }

      if (item.quantity <= 0) {
        setError(`Item ${i + 1}: Quantity must be greater than 0`);
        return;
      }

      if (item.quantity > item.onHandQty) {
        setError(`Item ${i + 1}: Quantity exceeds available stock (${item.onHandQty})`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create StockOutOrder with status = 'draft'
      const stockOutOrderData = {
        orderDate: new Date(formData.orderDate),
        reason: formData.reason,
        destination: formData.destination || null,
        status: 'draft',
        notes: formData.notes || null,
        createdBy: currentUser?.employeeId || null
      };

      const createdOrder = await stockOutOrderService.createStockOutOrder(stockOutOrderData);

      // Step 2: Create DetailStockOutOrders
      const detailPromises = items.map(item => {
        return detailStockOutOrderService.createDetailStockOutOrder({
          stockOutOrder: createdOrder._id || createdOrder.id,
          product: item.product,
          batchId: item.batch,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: null
        });
      });

      await Promise.all(detailPromises);

      if (onSuccess) {
        onSuccess(createdOrder);
      }

      onClose();
    } catch (err) {
      console.error('Error creating stock out order:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create stock out order');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totals = calculateTotal();
  const products = getUniqueProducts();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Create Stock Out Order
            </h2>
            <p className="text-[12px] text-gray-500 font-['Poppins',sans-serif] mt-1">
              Release inventory from warehouse • Status: <span className="font-semibold text-gray-600">Draft</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
              {error}
            </div>
          )}

          {/* Order Information */}
          <div className="space-y-4">
            <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">Order Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                  required
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="sales">Sales</option>
                  <option value="transfer">Transfer</option>
                  <option value="damage">Damage</option>
                  <option value="expired">Expired</option>
                  <option value="return_to_supplier">Return to Supplier</option>
                  <option value="internal_use">Internal Use</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                Destination <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="e.g., Customer name, warehouse location, etc."
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-2">
                Notes <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="2"
                placeholder="Additional notes..."
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Items <span className="text-red-500">*</span>
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-[12px] font-['Poppins',sans-serif] font-medium flex items-center gap-1.5 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Add Item
              </button>
            </div>

            {items.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif]">
                  No items added yet. Click "Add Item" to start.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, index) => {
                const selectedProduct = products.find(p => p.id === item.product);
                const filteredProducts = getFilteredProducts(index);
                const filteredBatches = getFilteredBatches(index);

                return (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        {/* Product Selection */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[12px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-1">
                              Product <span className="text-red-500">*</span>
                            </label>
                            <div ref={el => dropdownRefs.current[`product-${index}`] = el} className="relative">
                              <input
                                type="text"
                                value={productSearchTerms[index] || ''}
                                onChange={(e) => handleProductSearch(index, e.target.value)}
                                onFocus={() => setShowProductDropdown({ ...showProductDropdown, [index]: true })}
                                placeholder="Search product..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[12px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-red-500"
                              />

                              {selectedProduct && !showProductDropdown[index] && (
                                <div className="absolute inset-0 px-3 py-2 bg-white border border-red-500 rounded-lg text-[12px] font-['Poppins',sans-serif] flex items-center justify-between pointer-events-none">
                                  <span className="text-red-700 font-semibold">{selectedProduct.name}</span>
                                  <span className="text-blue-600 text-[10px] font-semibold">{selectedProduct.productCode}</span>
                                </div>
                              )}

                              {showProductDropdown[index] && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                  {filteredProducts.length === 0 ? (
                                    <div className="px-3 py-2 text-[12px] text-gray-500 font-['Poppins',sans-serif]">
                                      No products found
                                    </div>
                                  ) : (
                                    filteredProducts.map(product => (
                                      <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => selectProduct(index, product.id)}
                                        className="w-full px-3 py-2 text-left text-[12px] font-['Poppins',sans-serif] hover:bg-red-50 focus:bg-red-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-semibold text-gray-900">{product.name}</span>
                                          <span className="text-blue-600 text-[10px] font-semibold">{product.productCode}</span>
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Batch Selection */}
                          <div>
                            <label className="block text-[12px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-1">
                              Batch <span className="text-red-500">*</span>
                            </label>
                            <div ref={el => dropdownRefs.current[`batch-${index}`] = el} className="relative">
                              <input
                                type="text"
                                value={batchSearchTerms[index] || ''}
                                onChange={(e) => handleBatchSearch(index, e.target.value)}
                                onFocus={() => item.product && setShowBatchDropdown({ ...showBatchDropdown, [index]: true })}
                                placeholder={item.product ? "Search batch..." : "Select product first"}
                                disabled={!item.product}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[12px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                              />

                              {item.batch && !showBatchDropdown[index] && (
                                <div className="absolute inset-0 px-3 py-2 bg-white border border-red-500 rounded-lg text-[12px] font-['Poppins',sans-serif] flex items-center justify-between pointer-events-none">
                                  <span className="text-red-700 font-semibold font-mono">{item.batchCode}</span>
                                  <span className="text-gray-500 text-[10px]">OnHand: {item.onHandQty}</span>
                                </div>
                              )}

                              {showBatchDropdown[index] && item.product && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                  {filteredBatches.length === 0 ? (
                                    <div className="px-3 py-2 text-[12px] text-gray-500 font-['Poppins',sans-serif]">
                                      No batches available
                                    </div>
                                  ) : (
                                    <>
                                      {!batchSearchTerms[index] && filteredBatches.length > 20 && (
                                        <div className="px-3 py-2 text-[10px] text-gray-400 font-['Poppins',sans-serif] bg-gray-50 border-b">
                                          Showing first 20 results. Type to search...
                                        </div>
                                      )}
                                      {filteredBatches.map(invItem => (
                                        <button
                                          key={invItem._id || invItem.id}
                                          type="button"
                                          onClick={() => selectBatch(index, invItem)}
                                          className="w-full px-3 py-2 text-left text-[12px] font-['Poppins',sans-serif] hover:bg-red-50 focus:bg-red-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold text-gray-900 font-mono">{invItem.batchId?.batchCode}</span>
                                            <span className="text-gray-600 text-[10px]">OnHand: {invItem.quantityOnHand || 0}</span>
                                          </div>
                                          {invItem.batchId?.expiryDate && (
                                            <div className="text-gray-500 text-[10px] mt-0.5">
                                              Exp: {new Date(invItem.batchId.expiryDate).toLocaleDateString()}
                                            </div>
                                          )}
                                        </button>
                                      ))}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quantity and Price */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[12px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-1">
                              Available
                            </label>
                            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-[12px] font-['Poppins',sans-serif] text-gray-700">
                              {item.onHandQty || 0}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[12px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-1">
                              Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                              min="1"
                              max={item.onHandQty || 999999}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[12px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[12px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-1">
                              Unit Price (₫)
                            </label>
                            <input
                              type="number"
                              value={item.unitPrice}
                              readOnly
                              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-[12px] font-['Poppins',sans-serif] text-gray-700 cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Total */}
                        <div className="flex justify-end">
                          <div className="text-[12px] font-['Poppins',sans-serif]">
                            <span className="text-gray-600">Total: </span>
                            <span className="font-semibold text-red-600">{(item.quantity * item.unitPrice).toLocaleString('vi-VN')}₫</span>
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="mt-6 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove item"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Summary */}
          {items.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-5">
              <h4 className="text-[14px] font-semibold font-['Poppins',sans-serif] text-[#212529] mb-3">
                Order Summary
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                  <span className="text-gray-600">Total Items:</span>
                  <span className="font-semibold">{items.length} item(s)</span>
                </div>
                <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                  <span className="text-gray-600">Total Quantity:</span>
                  <span className="font-semibold">{items.reduce((sum, item) => sum + item.quantity, 0)} units</span>
                </div>
                <div className="flex justify-between border-t-2 border-red-300 pt-2 mt-2">
                  <span className="font-bold text-[15px] font-['Poppins',sans-serif] text-gray-900">Estimated Value:</span>
                  <span className="font-bold text-red-600 text-[18px] font-['Poppins',sans-serif]">
                    {totals.toLocaleString('vi-VN')}₫
                  </span>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="border-t-2 border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-gray-600 font-['Poppins',sans-serif]">
              <p>✓ Stock out order will be created with status: <span className="font-semibold text-gray-600">Draft</span></p>
              <p className="mt-1">Reason: {formData.reason}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors text-[13px] font-['Poppins',sans-serif] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading || items.length === 0}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-[13px] font-['Poppins',sans-serif] font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl"
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
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Create Stock Out Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
