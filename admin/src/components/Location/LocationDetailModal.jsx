import React, { useState, useEffect } from 'react';
import { MapPin, X, Plus } from 'lucide-react';
import productService from '../../services/productService';
import detailInventoryService from '../../services/detailInventoryService';
import locationService from '../../services/locationService';

export const LocationDetailModal = ({ isOpen, location, onClose, onSuccess }) => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(location);
  const [successMessage, setSuccessMessage] = useState('');

  // Sync currentLocation with location prop when it changes
  useEffect(() => {
    if (location) {
      setCurrentLocation(location);
    }
  }, [location]);

  // Fetch products on modal open
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setShowAssignForm(false);
      setSelectedProduct('');
      setSelectedBatch('');
      setBatches([]);
      setError('');
    }
  }, [isOpen]);

  // Fetch batches when product is selected
  useEffect(() => {
    if (selectedProduct) {
      fetchBatchesForProduct(selectedProduct);
    } else {
      setBatches([]);
      setSelectedBatch('');
    }
  }, [selectedProduct]);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      // Fetch all detail inventories (backend will populate batchId -> product)
      const response = await detailInventoryService.getAllDetailInventories();

      // Handle different response structures
      let inventoryData = [];
      if (response?.data?.detailInventories) {
        inventoryData = response.data.detailInventories;
      } else if (response?.detailInventories) {
        inventoryData = response.detailInventories;
      } else if (Array.isArray(response)) {
        inventoryData = response;
      }

      // Extract unique products from inventory that have batches without location and with stock
      const productMap = new Map();

      inventoryData.forEach(invItem => {
        // Only include batches without location and with stock
        const hasNoLocation = !invItem.location;
        const hasStock = (invItem.quantityOnHand || 0) + (invItem.quantityOnShelf || 0) > 0;

        if (hasNoLocation && hasStock && invItem.batchId?.product) {
          const product = invItem.batchId.product;
          const productId = product._id || product.id;

          if (!productMap.has(productId)) {
            productMap.set(productId, {
              id: productId,
              _id: productId,
              name: product.name,
              productCode: product.productCode,
              image: product.image,
              category: product.category
            });
          }
        }
      });

      setProducts(Array.from(productMap.values()));
    } catch (err) {
      console.error('Error fetching products:', err);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchBatchesForProduct = async (productId) => {
    try {
      setLoadingBatches(true);
      // Fetch with productId filter - backend will populate batchId and product
      const response = await detailInventoryService.getAllDetailInventories({ productId });

      // Handle different response structures
      let data = [];
      if (response?.data?.detailInventories) {
        data = response.data.detailInventories;
      } else if (response?.detailInventories) {
        data = response.detailInventories;
      } else if (Array.isArray(response)) {
        data = response;
      }

      // Filter batches that don't have a location and have stock
      const availableBatches = data.filter(detail => {
        const hasNoLocation = !detail.location;
        const hasStock = (detail.quantityOnHand || 0) + (detail.quantityOnShelf || 0) > 0;
        return hasNoLocation && hasStock;
      });

      setBatches(availableBatches);
    } catch (err) {
      console.error('Error fetching batches:', err);
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleAssignBatch = async () => {
    if (!selectedBatch) {
      setError('Please select a batch to assign');
      return;
    }

    try {
      setAssigning(true);
      setError('');
      setSuccessMessage('');

      // Get the batch quantity before assigning
      const selectedBatchData = batches.find(b => (b._id || b.id) === selectedBatch);
      const batchQuantity = selectedBatchData?.quantityOnHand || 0;

      await detailInventoryService.updateDetailInventory(selectedBatch, {
        location: location._id || location.id
      });

      // Show success message first
      setSuccessMessage('Batch assigned successfully! Location has been updated.');

      // Reset form
      setShowAssignForm(false);
      setSelectedProduct('');
      setSelectedBatch('');
      setBatches([]);

      // Notify parent to refresh (this will update location prop and trigger currentLocation sync)
      if (onSuccess) onSuccess();

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error assigning batch:', err);

      // Get the batch quantity for error message
      const selectedBatchData = batches.find(b => (b._id || b.id) === selectedBatch);
      const batchQuantity = selectedBatchData?.quantityOnHand || 0;
      const currentCapacity = occupiedCapacity;
      const wouldBeCapacity = currentCapacity + batchQuantity;

      // Check if it's a capacity/validation error
      const errorMessage = err.response?.data?.error?.message || '';
      const isValidationError = errorMessage.toLowerCase().includes('validation') ||
        errorMessage.toLowerCase().includes('capacity') ||
        errorMessage.toLowerCase().includes('exceed');

      // If validation error or would exceed capacity, show detailed message
      if (isValidationError || wouldBeCapacity > maxCapacity) {
        setError(
          `Cannot assign batch: Adding ${batchQuantity} units would exceed location capacity. ` +
          `Current: ${currentCapacity}/${maxCapacity} units. ` +
          `Would be: ${wouldBeCapacity}/${maxCapacity} units. ` +
          `Available space: ${maxCapacity - currentCapacity} units.`
        );
      } else {
        setError(errorMessage || 'Failed to assign batch to location');
      }

      // Ensure currentLocation stays valid even on error
      if (!currentLocation) {
        setCurrentLocation(location);
      }
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen || !location || !currentLocation) return null;

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get stock status badge
  const getStockStatusBadge = (item) => {
    if (item.quantityAvailable === 0) {
      return (
        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[9px] font-bold font-['Poppins',sans-serif] uppercase">
          Out of Stock
        </span>
      );
    }
    return (
      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[9px] font-bold font-['Poppins',sans-serif] uppercase">
        In Stock
      </span>
    );
  };

  const occupiedCapacity = currentLocation?.currentBatches?.reduce((total, batch) => {
    return total + (batch.quantityOnHand || 0);
  }, 0) || 0;
  const maxCapacity = currentLocation?.maxCapacity || 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Location {currentLocation?.name || 'N/A'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Code: {currentLocation?.locationCode || 'N/A'} • Capacity: {occupiedCapacity} / {maxCapacity}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{successMessage}</p>
            </div>
          )}

          {/* Assign Batch Section */}
          {!showAssignForm ? (
            <div className="mb-6">
              <button
                onClick={() => setShowAssignForm(true)}
                className="w-full py-3 border-2 border-dashed border-emerald-300 rounded-lg text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="w-5 h-5" />
                Assign Batch to This Location
              </button>
            </div>
          ) : (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-emerald-900">Assign New Batch</h3>
                <button
                  onClick={() => {
                    setShowAssignForm(false);
                    setSelectedProduct('');
                    setSelectedBatch('');
                    setError('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Product Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    1. Select Product
                  </label>
                  {loadingProducts ? (
                    <div className="flex items-center justify-center py-3">
                      <svg className="animate-spin h-5 w-5 text-emerald-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : (
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select Product --</option>
                      {products.map(product => (
                        <option key={product._id || product.id} value={product._id || product.id}>
                          {product.name} ({product.productCode})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Batch Selection */}
                {selectedProduct && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      2. Select Batch (without location)
                    </label>
                    {loadingBatches ? (
                      <div className="flex items-center justify-center py-3">
                        <svg className="animate-spin h-5 w-5 text-emerald-600" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : batches.length === 0 ? (
                      <div className="py-3 px-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                        <p className="text-sm text-gray-500">No available batches without location for this product</p>
                      </div>
                    ) : (
                      <>
                        <select
                          value={selectedBatch}
                          onChange={(e) => setSelectedBatch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">-- Select Batch --</option>
                          {batches.map(batch => (
                            <option key={batch._id || batch.id} value={batch._id || batch.id}>
                              {batch.batchId?.batchCode} - On Hand: {batch.quantityOnHand || 0}, On Shelf: {batch.quantityOnShelf || 0}
                              {batch.batchId?.expiryDate && ` - Exp: ${new Date(batch.batchId.expiryDate).toLocaleDateString()}`}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {batches.length} batch(es) available
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Assign Button */}
                {selectedBatch && (
                  <button
                    onClick={handleAssignBatch}
                    disabled={assigning}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {assigning ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Assign to Location {currentLocation?.name || 'N/A'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Current Batches Section */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Batches in This Location</h3>
          </div>

          {currentLocation?.currentBatches && currentLocation.currentBatches.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Table Header */}
              <div className="flex items-center h-[34px] bg-gray-50 border-b border-gray-200">
                {/* Batch Code Column */}
                <div className="w-[140px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    Batch Code
                  </p>
                </div>

                {/* Product Name Column */}
                <div className="flex-1 min-w-[200px] px-3 flex items-center">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    Product Name
                  </p>
                </div>

                {/* Expiry Date Column */}
                <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    Expiry Date
                  </p>
                </div>

                {/* On Hand Column */}
                <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    On Hand
                  </p>
                </div>

                {/* On Shelf Column */}
                <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    On Shelf
                  </p>
                </div>

                {/* Reserved Column */}
                <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    Reserved
                  </p>
                </div>

                {/* Available Column */}
                <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    Available
                  </p>
                </div>

                {/* Batch Quantity Column */}
                <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    Batch Qty
                  </p>
                </div>

                {/* Status Column */}
                <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    Status
                  </p>
                </div>
              </div>

              {/* Table Body */}
              <div className="flex flex-col">
                {currentLocation.currentBatches.map((batch, index) => {
                  // Try both field names for expiry date
                  const expiryDateStr = batch.batchId?.expiryDate || batch.batchId?.expirationDate;
                  const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
                  const isExpiringSoon = expiryDate && (expiryDate - new Date()) < (30 * 24 * 60 * 60 * 1000);

                  return (
                    <div
                      key={batch._id || index}
                      className={`flex items-center h-[60px] hover:bg-gray-50 transition-colors ${index !== currentLocation.currentBatches.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                    >
                      {/* Batch Code */}
                      <div className="w-[140px] px-3 flex items-center flex-shrink-0">
                        <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-emerald-600 leading-[20px]">
                          {batch.batchId?.batchCode || 'N/A'}
                        </p>
                      </div>

                      {/* Product Name */}
                      <div className="flex-1 min-w-[200px] px-3 flex items-center">
                        <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                          {batch.batchId?.product?.name || 'N/A'}
                        </p>
                      </div>

                      {/* Expiry Date */}
                      <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                        <p className={`text-[13px] font-normal font-['Poppins',sans-serif] leading-[20px] ${isExpiringSoon ? 'text-orange-600 font-semibold' : 'text-[#212529]'
                          }`}>
                          {formatDate(expiryDateStr)}
                        </p>
                      </div>

                      {/* On Hand */}
                      <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                        <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                          {batch.quantityOnHand || 0}
                        </p>
                      </div>

                      {/* On Shelf */}
                      <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                        <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                          {batch.quantityOnShelf || 0}
                        </p>
                      </div>

                      {/* Reserved */}
                      <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                        <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-gray-600 leading-[20px]">
                          {batch.quantityReserved || 0}
                        </p>
                      </div>

                      {/* Available */}
                      <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                        <p className={`text-[13px] font-semibold font-['Poppins',sans-serif] leading-[20px] ${batch.quantityAvailable === 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                          {batch.quantityAvailable || 0}
                        </p>
                      </div>

                      {/* Batch Quantity */}
                      <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                        <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-gray-600 leading-[20px]">
                          {batch.batchId?.quantity || 0}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                        {getStockStatusBadge(batch)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif]">
                No batches in this location
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
