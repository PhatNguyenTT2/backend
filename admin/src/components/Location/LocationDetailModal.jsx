import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, X, Plus, MoveRight, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import productService from '../../services/productService';
import detailInventoryService from '../../services/detailInventoryService';
import locationService from '../../services/locationService';
import inventoryMovementBatchService from '../../services/inventoryMovementBatchService';
import { MovementHistoryBatchModal } from '../DetailInventoryList/BatchMovementModals/MovementHistoryBatchModal';

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

  // New states for moving batches
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [batchToMove, setBatchToMove] = useState(null);
  const [allLocations, setAllLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [selectedTargetLocation, setSelectedTargetLocation] = useState(null);
  const [moving, setMoving] = useState(false);

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  // Column gaps for MapView (from localStorage)
  const [blockColumnGaps, setBlockColumnGaps] = useState({});

  // Hover tooltip state for Move Modal (to render at modal level)
  const [hoveredLocation, setHoveredLocation] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Movement History Modal state
  const [showMovementHistoryModal, setShowMovementHistoryModal] = useState(false);
  const [selectedBatchForHistory, setSelectedBatchForHistory] = useState(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);

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

  // Open move modal and load all locations
  const handleOpenMoveModal = async (batch) => {
    setBatchToMove(batch);
    setShowMoveModal(true);
    setSelectedTargetLocation(null);
    setError('');

    // Load all locations
    try {
      setLoadingLocations(true);
      const data = await locationService.getAllLocations();
      // Data is returned as array directly - load ALL locations to preserve grid structure
      const locationsData = Array.isArray(data) ? data : [];

      // Don't filter - keep all locations to maintain correct grid structure
      // We will disable invalid locations in the UI instead
      setAllLocations(locationsData);
    } catch (err) {
      console.error('Error loading locations:', err);
      setError('Failed to load available locations');
      setAllLocations([]);
    } finally {
      setLoadingLocations(false);
    }
  };

  // Move batch to selected location
  const handleMoveBatch = async () => {
    if (!selectedTargetLocation || !batchToMove) {
      setError('Please select a target location');
      return;
    }

    try {
      setMoving(true);
      setError('');

      // Call change-location API
      await inventoryMovementBatchService.changeLocation({
        detailInventoryId: batchToMove._id || batchToMove.id,
        toLocationId: selectedTargetLocation._id || selectedTargetLocation.id,
        reason: `Batch relocation from ${currentLocation.name} to ${selectedTargetLocation.name}`
      });

      setSuccessMessage(`Batch ${batchToMove.batchId?.batchCode} moved successfully to ${selectedTargetLocation.name}!`);

      // Close move modal
      setShowMoveModal(false);
      setBatchToMove(null);
      setSelectedTargetLocation(null);

      // Notify parent to refresh
      if (onSuccess) onSuccess();

      // Auto-clear success message
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error moving batch:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to move batch';
      setError(errorMessage);
    } finally {
      setMoving(false);
    }
  };

  // Toggle dropdown
  const toggleDropdown = (batchId, event) => {
    if (activeDropdown === batchId) {
      setActiveDropdown(null);
    } else {
      const buttonRect = event.currentTarget.getBoundingClientRect();

      // Calculate position (align to right)
      const leftPosition = buttonRect.right - 160; // 160px is dropdown width

      setDropdownPosition({
        top: buttonRect.bottom + 4,
        left: leftPosition
      });
      setActiveDropdown(batchId);
    }
  };

  // Handle view detail inventory - opens Movement History Modal
  const handleViewDetailInventory = (batch) => {
    // Transform batch data to match detailInventory format expected by MovementHistoryBatchModal
    setSelectedBatchForHistory(batch);
    setShowMovementHistoryModal(true);
    setActiveDropdown(null);
  };

  // Helper functions for UI
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const getStockStatusBadge = (batch) => {
    const total = (batch.quantityOnHand || 0) + (batch.quantityOnShelf || 0);
    const expiryDateStr = batch.batchId?.expiryDate || batch.batchId?.expirationDate;
    const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
    const now = new Date();

    if (expiryDate && expiryDate < now) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          Expired
        </span>
      );
    }

    if (expiryDate && (expiryDate - now) < (30 * 24 * 60 * 60 * 1000)) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
          Expiring Soon
        </span>
      );
    }

    if (total === 0) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
          Out of Stock
        </span>
      );
    }

    return (
      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
        In Stock
      </span>
    );
  };

  // Group locations by block for MapView style
  const blockGroups = useMemo(() => {
    const groups = {};

    allLocations.forEach(location => {
      const blockName = location.name.split('-')[0];
      if (!groups[blockName]) {
        groups[blockName] = [];
      }
      groups[blockName].push(location);
    });

    // Sort locations within each block
    Object.keys(groups).forEach(blockName => {
      groups[blockName].sort((a, b) => {
        const numA = parseInt(a.name.split('-')[1]) || 0;
        const numB = parseInt(b.name.split('-')[1]) || 0;
        return numA - numB;
      });
    });

    return groups;
  }, [allLocations]);

  // Load column gaps from localStorage when blockGroups change
  useEffect(() => {
    const gaps = {};
    Object.keys(blockGroups).forEach(blockName => {
      const saved = localStorage.getItem(`warehouse-block-${blockName}-gaps`);
      if (saved) {
        try {
          gaps[blockName] = JSON.parse(saved);
        } catch (e) {
          gaps[blockName] = [];
        }
      } else {
        gaps[blockName] = [];
      }
    });
    setBlockColumnGaps(gaps);
  }, [blockGroups]);

  // Get block dimensions
  const getBlockDimensions = (blockLocations) => {
    const count = blockLocations.length;
    const possibleRows = [6, 5, 4, 3, 2, 1];

    for (const rows of possibleRows) {
      if (count % rows === 0) {
        return { rows, cols: count / rows };
      }
    }

    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
  };

  // Get location capacity info
  const getLocationCapacity = (loc) => {
    const locOccupied = loc.currentBatches?.reduce((total, b) => total + (b.quantityOnHand || 0), 0) || 0;
    const locMax = loc.maxCapacity || 100;
    const locAvailable = locMax - locOccupied;
    const batchQty = batchToMove?.quantityOnHand || 0;
    const hasCapacity = locAvailable >= batchQty;
    const capacityPercent = (locOccupied / locMax) * 100;

    // Check if this is the current location (source)
    const locId = loc._id || loc.id;
    const currentLocId = currentLocation?._id || currentLocation?.id;
    const isCurrentLocation = locId === currentLocId;

    // Check if location is active
    const isActive = loc.isActive !== false;

    // Location is selectable only if: active, not current, and has capacity
    const isSelectable = isActive && !isCurrentLocation && hasCapacity;

    return { locOccupied, locMax, locAvailable, batchQty, hasCapacity, capacityPercent, isCurrentLocation, isActive, isSelectable };
  };

  // Calculate occupied capacity
  const occupiedCapacity = currentLocation?.currentBatches?.reduce((total, batch) => {
    return total + (batch.quantityOnHand || 0);
  }, 0) || 0;

  const maxCapacity = currentLocation?.maxCapacity || 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col">
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

                {/* Actions Column */}
                <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                  <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                    Actions
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

                      {/* Actions */}
                      <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                        <button
                          onClick={(e) => toggleDropdown(`action-${batch._id || batch.id}`, e)}
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                          title="Actions"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="3" cy="8" r="1.5" fill="#6B7280" />
                            <circle cx="8" cy="8" r="1.5" fill="#6B7280" />
                            <circle cx="13" cy="8" r="1.5" fill="#6B7280" />
                          </svg>
                        </button>
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

      {/* Fixed Position Dropdown Menu */}
      {activeDropdown && (() => {
        const batchId = activeDropdown.replace('action-', '');
        const batch = currentLocation?.currentBatches?.find(b =>
          (b._id || b.id) === batchId
        );

        if (!batch) return null;

        return (
          <div
            ref={dropdownRef}
            className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[10001]"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`
            }}
          >
            <button
              onClick={() => handleViewDetailInventory(batch)}
              className="w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 4V8L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C9.8 2 11.4 2.8 12.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Movement History
            </button>

            <div className="border-t border-gray-200 my-1"></div>

            <button
              onClick={() => {
                handleOpenMoveModal(batch);
                setActiveDropdown(null);
              }}
              className="w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 8H14M14 8L10 4M14 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Move Location
            </button>
          </div>
        );
      })()}

      {/* Move Batch Modal */}
      {showMoveModal && batchToMove && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10001] p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            {/* Move Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Move Batch to Another Location
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Batch: {batchToMove.batchId?.batchCode} • From: {currentLocation?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setBatchToMove(null);
                  setSelectedTargetLocation(null);
                  setError('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Move Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Select Target Location
                </h4>
                <p className="text-xs text-gray-600 mb-4">
                  Choose a location to move this batch. Only active locations with available capacity are shown.
                </p>
              </div>

              {loadingLocations ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
                    <p className="text-sm text-gray-500 mt-3">Loading locations...</p>
                  </div>
                </div>
              ) : allLocations.length === 0 ? (
                <div className="py-12 text-center">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No available locations found</p>
                </div>
              ) : (
                <div>
                  {/* Legend */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <span className="font-semibold text-gray-700">Legend:</span>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-purple-500 border-2 border-purple-600 rounded"></div>
                        <span className="text-gray-600">Current</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-gray-300 border-2 border-gray-400 rounded"></div>
                        <span className="text-gray-600">Inactive</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-white border-2 border-gray-300 rounded"></div>
                        <span className="text-gray-600">Empty</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-emerald-500 border-2 border-emerald-600 rounded"></div>
                        <span className="text-gray-600">In Use</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-yellow-400 border-2 border-yellow-500 rounded"></div>
                        <span className="text-gray-600">&gt;80%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-red-500 border-2 border-red-600 rounded"></div>
                        <span className="text-gray-600">Full</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-blue-500 border-2 border-blue-600 rounded ring-2 ring-blue-300"></div>
                        <span className="text-gray-600">Selected</span>
                      </div>
                    </div>
                  </div>

                  {/* Map View Blocks */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.keys(blockGroups).sort().map(blockName => {
                      const blockLocations = blockGroups[blockName];
                      const { rows, cols } = getBlockDimensions(blockLocations);
                      const columnGaps = blockColumnGaps[blockName] || [];

                      // Create grid array
                      const gridArray = Array(rows * cols).fill(null);
                      blockLocations.forEach((loc, idx) => {
                        gridArray[idx] = loc;
                      });

                      return (
                        <div key={blockName} className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                          <h5 className="text-sm font-bold text-gray-900 mb-3">Block {blockName}</h5>
                          <div className="overflow-x-auto">
                            <div className="inline-block border-2 border-gray-300 rounded-lg">
                              <div className="flex gap-0 p-2 bg-gray-200">
                                {Array.from({ length: cols }).map((_, colIdx) => {
                                  const hasGapAfter = columnGaps.includes(colIdx + 1);
                                  return (
                                    <React.Fragment key={colIdx}>
                                      <div
                                        className="grid gap-1"
                                        style={{ gridTemplateRows: `repeat(${rows}, 40px)` }}
                                      >
                                        {Array.from({ length: rows }).map((_, rowIdx) => {
                                          const idx = colIdx * rows + rowIdx;
                                          const loc = gridArray[idx];

                                          if (!loc) {
                                            return (
                                              <div
                                                key={`empty-${rowIdx}-${colIdx}`}
                                                className="w-[40px] bg-gray-100 rounded border border-gray-200 opacity-30"
                                              />
                                            );
                                          }

                                          const { locOccupied, locMax, locAvailable, batchQty, hasCapacity, capacityPercent, isCurrentLocation, isActive, isSelectable } = getLocationCapacity(loc);
                                          const isSelected = selectedTargetLocation && (selectedTargetLocation._id || selectedTargetLocation.id) === (loc._id || loc.id);

                                          // Determine color based on capacity and selection
                                          let bgColor = 'bg-white border-gray-300';
                                          let textColor = 'text-gray-900';

                                          if (!isActive) {
                                            // Inactive location
                                            bgColor = 'bg-gray-300 border-gray-400';
                                            textColor = 'text-gray-500';
                                          } else if (isCurrentLocation) {
                                            // Current location (source) - highlight differently
                                            bgColor = 'bg-purple-500 border-purple-600';
                                            textColor = 'text-white';
                                          } else if (isSelected) {
                                            bgColor = 'bg-blue-500 border-blue-600 ring-2 ring-blue-300';
                                            textColor = 'text-white';
                                          } else if (!hasCapacity) {
                                            bgColor = 'bg-red-400 border-red-500';
                                            textColor = 'text-white';
                                          } else if (capacityPercent > 90) {
                                            bgColor = 'bg-red-500 border-red-600';
                                            textColor = 'text-white';
                                          } else if (capacityPercent > 80) {
                                            bgColor = 'bg-yellow-400 border-yellow-500';
                                            textColor = 'text-gray-900';
                                          } else if (capacityPercent > 0) {
                                            bgColor = 'bg-emerald-500 border-emerald-600';
                                            textColor = 'text-white';
                                          }

                                          return (
                                            <button
                                              key={loc._id || loc.id}
                                              onClick={() => isSelectable && setSelectedTargetLocation(loc)}
                                              disabled={!isSelectable}
                                              className={`relative w-[40px] rounded border-2 transition-all ${bgColor} ${isSelectable ? 'hover:shadow-lg cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                                              onMouseEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setHoveredLocation({
                                                  loc,
                                                  locOccupied,
                                                  locMax,
                                                  locAvailable,
                                                  batchQty,
                                                  hasCapacity,
                                                  isCurrentLocation,
                                                  isActive
                                                });
                                                setTooltipPosition({
                                                  top: rect.top - 10,
                                                  left: rect.left + rect.width / 2
                                                });
                                              }}
                                              onMouseLeave={() => setHoveredLocation(null)}
                                            >
                                              <div className="absolute inset-0 flex items-center justify-center">
                                                <span className={`text-[9px] font-bold ${textColor}`}>
                                                  {loc.name.split('-')[1]}
                                                </span>
                                              </div>

                                              {/* Selected checkmark */}
                                              {isSelected && (
                                                <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow">
                                                  <svg className="w-2.5 h-2.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                  </svg>
                                                </div>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {hasGapAfter && (
                                        <div className="w-2 bg-transparent" />
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Move Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {selectedTargetLocation ? (
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Selected:</span>
                    <span className="text-emerald-600 font-bold">{selectedTargetLocation.name}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Batch will be moved here</span>
                  </span>
                ) : (
                  'Please select a target location'
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMoveModal(false);
                    setBatchToMove(null);
                    setSelectedTargetLocation(null);
                    setError('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveBatch}
                  disabled={!selectedTargetLocation || moving}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {moving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Moving...
                    </>
                  ) : (
                    <>
                      <MoveRight className="w-4 h-4" />
                      Move Batch
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Fixed Tooltip - rendered at modal level to avoid overflow clipping */}
            {hoveredLocation && (
              <div
                className="fixed z-[10003] pointer-events-none"
                style={{
                  top: tooltipPosition.top,
                  left: tooltipPosition.left,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <div className="bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-xl">
                  <div className="font-bold">{hoveredLocation.loc.name}</div>
                  <div className="text-[10px] text-gray-300">
                    Capacity: {hoveredLocation.locOccupied}/{hoveredLocation.locMax}
                  </div>
                  <div className="text-[10px] text-gray-300">
                    Available: {hoveredLocation.locAvailable} | Need: {hoveredLocation.batchQty}
                  </div>
                  {hoveredLocation.isCurrentLocation && (
                    <div className="text-[10px] text-purple-400 font-medium mt-1">
                      Current Location (Source)
                    </div>
                  )}
                  {!hoveredLocation.isActive && (
                    <div className="text-[10px] text-gray-400 font-medium mt-1">
                      Inactive
                    </div>
                  )}
                  {hoveredLocation.isActive && !hoveredLocation.isCurrentLocation && !hoveredLocation.hasCapacity && (
                    <div className="text-[10px] text-red-400 font-medium mt-1">
                      Insufficient capacity
                    </div>
                  )}
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 mx-auto"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Movement History Modal */}
      <MovementHistoryBatchModal
        isOpen={showMovementHistoryModal}
        onClose={() => {
          setShowMovementHistoryModal(false);
          setSelectedBatchForHistory(null);
        }}
        detailInventory={selectedBatchForHistory}
      />
    </div>
  );
};
