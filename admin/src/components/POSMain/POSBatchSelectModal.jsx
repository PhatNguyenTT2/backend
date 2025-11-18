import React, { useState } from 'react';

export const POSBatchSelectModal = ({
  isOpen,
  productData,
  onClose,
  onBatchSelected
}) => {
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [quantity, setQuantity] = useState(1);

  if (!isOpen || !productData) return null;

  const { product, batches } = productData;

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

  const handleQuantityChange = (value) => {
    const maxQty = selectedBatch ? selectedBatch.quantity : 1;
    const newQty = Math.max(1, Math.min(value, maxQty));
    setQuantity(newQty);
  };

  const handleConfirm = () => {
    if (selectedBatch && onBatchSelected) {
      onBatchSelected(selectedBatch, quantity);
      setSelectedBatch(null);
      setQuantity(1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-['Poppins']">
                Select Batch
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
              const isRecommended = batch.isAutoSelected; // FEFO batch

              return (
                <div
                  key={batch.id}
                  onClick={() => {
                    setSelectedBatch(batch);
                    setQuantity(1);
                  }}
                  className={`
                    p-4 border-2 rounded-lg cursor-pointer transition-all
                    ${isSelected
                      ? 'border-emerald-500 bg-emerald-50 shadow-md'
                      : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex justify-between items-start">
                    {/* Left: Batch Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-gray-900">
                          {batch.batchCode}
                        </span>

                        {isRecommended && (
                          <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-semibold">
                            ⭐ Recommended (FEFO)
                          </span>
                        )}

                        {isSelected && (
                          <span className="px-2 py-1 bg-emerald-500 text-white rounded text-xs font-semibold">
                            ✓ Selected
                          </span>
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
                          <span className="text-gray-600">Available Stock:</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {batch.quantity} units
                          </span>
                        </p>

                        <p className="text-sm">
                          <span className="text-gray-600">Supplier:</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {batch.supplier?.name || 'N/A'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Right: Price */}
                    <div className="text-right ml-4">
                      <p className="text-3xl font-bold text-gray-900">
                        {formatCurrency(batch.unitPrice || product.unitPrice)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        per unit
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quantity Selection */}
          {selectedBatch && (
            <div className="mt-6 p-5 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
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
                  max={selectedBatch.quantity}
                  className="w-28 h-12 text-center text-2xl font-bold border-2 border-emerald-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                />

                <button
                  onClick={() => handleQuantityChange(quantity + 1)}
                  className="w-12 h-12 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg font-bold text-xl hover:bg-emerald-50 transition-colors"
                >
                  +
                </button>

                <span className="text-sm text-gray-600">
                  / {selectedBatch.quantity} units available
                </span>
              </div>

              {/* Subtotal */}
              <div className="mt-5 pt-4 border-t border-emerald-300">
                <div className="flex justify-between items-center">
                  <span className="text-lg text-gray-700 font-semibold">Subtotal:</span>
                  <span className="text-4xl font-bold text-emerald-600">
                    {formatCurrency((selectedBatch.unitPrice || product.unitPrice) * quantity)}
                  </span>
                </div>
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
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};
