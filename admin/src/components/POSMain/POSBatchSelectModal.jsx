import React, { useState } from 'react';

export const POSBatchSelectModal = ({
  isOpen,
  productData,
  onClose,
  onBatchSelected
}) => {
  // Single batch selection with quantity
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [quantity, setQuantity] = useState(1);

  if (!isOpen || !productData) return null;

  const { product, batches: allBatches } = productData;

  // Safety filter: Only show batches with quantity > 0
  // Note: POS endpoint returns batch.quantity field (from ProductBatch model)
  // AddOrderModal uses detailInventory.quantityOnShelf (different data source)
  const batches = (allBatches || []).filter(batch => {
    const qty = batch.detailInventory?.quantityOnShelf || batch.quantityOnShelf || batch.quantity || 0;
    return qty > 0;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₫${parseFloat(amount).toLocaleString('vi-VN')}`;
  };

  // Helper: Get batch unit price (handle Decimal128)
  const getBatchPrice = (batch) => {
    if (!batch) return 0;

    const price = batch.unitPrice;

    // Handle null or undefined
    if (price === null || price === undefined) return 0;

    // Handle Decimal128 object
    if (typeof price === 'object' && price !== null) {
      if (price.$numberDecimal) {
        return parseFloat(price.$numberDecimal);
      }
      return parseFloat(price.toString());
    }

    // Handle number or string
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper: Get batch discount percentage
  const getBatchDiscountPercentage = (batch) => {
    if (!batch) return 0;
    return batch.discountPercentage || 0;
  };

  // Helper: Get current batch price after discount
  const getCurrentBatchPrice = (batch) => {
    if (!batch) return 0;

    const basePrice = getBatchPrice(batch);
    const discountPercentage = getBatchDiscountPercentage(batch);

    if (discountPercentage > 0) {
      return basePrice * (1 - discountPercentage / 100);
    }

    return basePrice;
  };

  const handleQuantityChange = (value) => {
    if (!selectedBatch) return;
    const maxQty = selectedBatch.detailInventory?.quantityOnShelf || selectedBatch.quantityOnShelf || 0;
    const newQty = Math.max(1, Math.min(value, maxQty));
    setQuantity(newQty);
  };

  const handleConfirm = () => {
    if (!onBatchSelected || !selectedBatch) {
      alert('Please select a batch');
      return;
    }

    if (quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    // Call onBatchSelected for the selected batch
    onBatchSelected(selectedBatch, quantity);

    // Reset and close
    setSelectedBatch(null);
    setQuantity(1);
    onClose();
  };

  // Handle batch selection
  const handleBatchSelect = (batch) => {
    setSelectedBatch(batch);
    setQuantity(1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-['Poppins']">
                Select Batch - Fresh Product
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {product.name} - {product.productCode}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Product Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              {product.image && (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-bold text-lg">{product.name}</h3>
                <p className="text-sm text-gray-600">
                  Category: {product.category?.name || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Base Price: {formatCurrency(product.unitPrice)}
                </p>
              </div>
            </div>
          </div>
          {/* Batch List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 mb-3">
              Available Batches ({batches.length})
            </h3>

            {batches.map((batch, index) => {
              const isSelected = selectedBatch?.id === batch.id;
              const maxQty = batch.detailInventory?.quantityOnShelf || batch.quantityOnShelf || 0;

              return (
                <div
                  key={batch.id}
                  onClick={() => handleBatchSelect(batch)}
                  className={`
                    p-4 border-2 rounded-lg transition-all cursor-pointer
                    ${isSelected
                      ? 'border-emerald-500 bg-emerald-50 shadow-md'
                      : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex justify-between items-start gap-4">
                    {/* Left: Batch Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-gray-900">
                          {batch.batchCode}
                        </span>

                        {isSelected && (
                          <span className="px-2 py-1 bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            Selected
                          </span>
                        )}

                        {/* Show discount badge if applicable */}
                        {getBatchDiscountPercentage(batch) > 0 && (
                          <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold">
                            🔥 -{getBatchDiscountPercentage(batch)}% OFF
                          </span>
                        )}

                        {/* Show urgency badge based on days until expiry */}
                        {batch.daysUntilExpiry !== undefined && batch.daysUntilExpiry !== null && (
                          <>
                            {batch.daysUntilExpiry <= 3 && (
                              <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold">
                                🔥 Urgent - {batch.daysUntilExpiry}d left
                              </span>
                            )}
                            {batch.daysUntilExpiry > 3 && batch.daysUntilExpiry <= 7 && (
                              <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs font-semibold">
                                ⚠️ {batch.daysUntilExpiry}d left
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="text-sm">
                          <span className="text-gray-600">Expiry Date:</span>{' '}
                          <span className={`font-semibold ${batch.daysUntilExpiry !== undefined && batch.daysUntilExpiry < 5
                            ? 'text-orange-600'
                            : 'text-gray-900'
                            }`}>
                            {formatDate(batch.expiryDate)}
                            {batch.daysUntilExpiry !== undefined && batch.daysUntilExpiry !== null && (
                              <> ({batch.daysUntilExpiry} {batch.daysUntilExpiry === 1 ? 'day' : 'days'} left)</>
                            )}
                          </span>
                        </p>

                        <p className="text-sm">
                          <span className="text-gray-600">Available On Shelf:</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {batch.detailInventory?.quantityOnShelf || batch.quantityOnShelf || 0} units
                          </span>
                        </p>

                        {batch.mfgDate && (
                          <p className="text-sm">
                            <span className="text-gray-600">Mfg Date:</span>{' '}
                            <span className="font-semibold text-gray-900">
                              {formatDate(batch.mfgDate)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Price and Quantity */}
                    <div className="flex flex-col items-end gap-3">
                      {/* Price Display */}
                      <div className="text-right">
                        {getBatchDiscountPercentage(batch) > 0 ? (
                          <>
                            <p className="text-2xl font-bold text-red-600">
                              {formatCurrency(getCurrentBatchPrice(batch))}
                            </p>
                            <p className="text-xs text-gray-500 line-through">
                              {formatCurrency(getBatchPrice(batch))}
                            </p>
                            <p className="text-xs text-red-600 font-semibold">
                              🔥 -{getBatchDiscountPercentage(batch)}%
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-gray-900">
                              {formatCurrency(getBatchPrice(batch))}
                            </p>
                            <p className="text-xs text-gray-600">
                              per unit
                            </p>
                          </>
                        )}
                      </div>

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="text-center">
                          <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quantity Selection */}
          {selectedBatch && (
            <div className="mt-6 p-5 bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-300 rounded-lg">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Selected Batch</h3>

              <div className="mb-4 p-3 bg-white rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-gray-900">{selectedBatch.batchCode}</span>
                  {getBatchDiscountPercentage(selectedBatch) > 0 && (
                    <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold">
                      🔥 -{getBatchDiscountPercentage(selectedBatch)}% OFF
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Expiry: {formatDate(selectedBatch.expiryDate)}
                </div>
                <div className="text-sm text-gray-600">
                  Available: {selectedBatch.detailInventory?.quantityOnShelf || selectedBatch.quantityOnShelf || 0} units
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Quantity
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleQuantityChange(quantity - 1)}
                    className="w-12 h-12 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg font-bold text-xl hover:bg-emerald-50 transition-colors"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                    min="1"
                    max={selectedBatch.detailInventory?.quantityOnShelf || selectedBatch.quantityOnShelf || 1}
                    className="w-28 h-12 text-center text-2xl font-bold border-2 border-emerald-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                  />

                  <button
                    onClick={() => handleQuantityChange(quantity + 1)}
                    className="w-12 h-12 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg font-bold text-xl hover:bg-emerald-50 transition-colors"
                  >
                    +
                  </button>

                  <span className="text-sm text-gray-600">
                    / {selectedBatch.detailInventory?.quantityOnShelf || selectedBatch.quantityOnShelf || 0} units on shelf
                  </span>
                </div>
              </div>

              {/* Subtotal */}
              <div className="pt-4 border-t-2 border-emerald-400">
                <div className="flex justify-between items-center">
                  <span className="text-lg text-gray-700 font-semibold">Subtotal:</span>
                  <span className="text-4xl font-bold text-emerald-600">
                    {formatCurrency(getCurrentBatchPrice(selectedBatch) * quantity)}
                  </span>
                </div>
                {getBatchDiscountPercentage(selectedBatch) > 0 && (
                  <div className="mt-2 text-right">
                    <span className="text-sm text-gray-500 line-through">
                      {formatCurrency(getBatchPrice(selectedBatch) * quantity)}
                    </span>
                    <span className="ml-2 text-sm text-red-600 font-semibold">
                      (Save {formatCurrency((getBatchPrice(selectedBatch) - getCurrentBatchPrice(selectedBatch)) * quantity)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={!selectedBatch}
            className={`
              px-8 py-3 rounded-lg font-bold text-white transition-all
              ${selectedBatch
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl'
                : 'bg-gray-300 cursor-not-allowed'
              }
            `}
          >
            {selectedBatch ? `Add ${quantity} items to Cart` : 'Select a Batch'}
          </button>
        </div>
      </div>
    </div>
  );
};
