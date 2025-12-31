import React, { useState, useEffect } from 'react';
import { X, Package, Calendar, DollarSign, AlertCircle, Clock } from 'lucide-react';
import productBatchService from '../../services/productBatchService';

/**
 * BatchListModal Component
 * Displays list of batches for a product that are available on shelf
 * Sorted by FEFO (First Expire First Out)
 * 
 * Props:
 * - isOpen: boolean - Modal visibility
 * - onClose: function - Close modal handler
 * - product: object - Product data
 */
export const BatchListModal = ({ isOpen, onClose, product }) => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && product) {
      fetchBatches();
    }
  }, [isOpen, product]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await productBatchService.getAllBatches({
        product: product.id || product._id,
        status: 'active',
        withInventory: 'true', // Include detailInventory data
        limit: 100
      });

      // Filter batches with quantityOnShelf > 0 and sort by expiry date (FEFO)
      const availableBatches = (response.data?.batches || [])
        .filter(batch => {
          const onShelf = batch.detailInventory?.quantityOnShelf || 0;
          return onShelf > 0;
        })
        .sort((a, b) => {
          // Batches without expiry date go last
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return new Date(a.expiryDate) - new Date(b.expiryDate);
        });

      setBatches(availableBatches);
    } catch (err) {
      console.error('Error fetching batches:', err);
      setError('Failed to load batches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = (expiryDate) => {
    const days = getDaysUntilExpiry(expiryDate);
    if (days === null) return { color: 'gray', text: 'No expiry', icon: null };
    if (days < 0) return { color: 'red', text: 'Expired', icon: <AlertCircle className="w-4 h-4" /> };
    if (days <= 7) return { color: 'red', text: `${days}d left`, icon: <AlertCircle className="w-4 h-4" /> };
    if (days <= 30) return { color: 'amber', text: `${days}d left`, icon: <Clock className="w-4 h-4" /> };
    return { color: 'green', text: `${days}d left`, icon: <Clock className="w-4 h-4" /> };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Available Batches</h2>
            <p className="text-sm text-gray-600 mt-1">
              {product?.name} ({product?.productCode})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
                <p className="text-sm text-gray-500 mt-3">Loading batches...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={fetchBatches}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : batches.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No batches available on shelf</p>
                <p className="text-xs text-gray-400 mt-1">All batches are in warehouse or out of stock</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-900 font-medium">
                    Total batches on shelf: {batches.length}
                  </span>
                  <span className="text-blue-700">
                    Total quantity: {batches.reduce((sum, b) => sum + (b.detailInventory?.quantityOnShelf || 0), 0)} units
                  </span>
                </div>
              </div>

              {/* Batch Cards */}
              {batches.map((batch) => {
                const onShelf = batch.detailInventory?.quantityOnShelf || 0;
                const hasDiscount = batch.discountPercentage > 0;
                const finalPrice = hasDiscount
                  ? batch.unitPrice * (1 - batch.discountPercentage / 100)
                  : batch.unitPrice;
                const expiryStatus = getExpiryStatus(batch.expiryDate);

                return (
                  <div
                    key={batch.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-emerald-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      {/* Batch Code */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">
                            {batch.batchCode}
                          </span>
                          {hasDiscount && (
                            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded">
                              -{batch.discountPercentage}% OFF
                            </span>
                          )}
                        </div>
                        {batch.notes && (
                          <p className="text-xs text-gray-500 mt-1">{batch.notes}</p>
                        )}
                      </div>

                      {/* Quantity Badge */}
                      <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold">
                        {onShelf} units
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Price */}
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Price</span>
                          {hasDiscount ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-red-600">
                                {formatVND(finalPrice)}
                              </span>
                              <span className="text-xs text-gray-400 line-through">
                                {formatVND(batch.unitPrice)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-gray-900">
                              {formatVND(batch.unitPrice)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expiry Date */}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Expiry Date</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatDate(batch.expiryDate)}
                            </span>
                            {expiryStatus.icon && (
                              <div className={`flex items-center gap-1 text-${expiryStatus.color}-600`}>
                                {expiryStatus.icon}
                                <span className={`text-xs font-medium text-${expiryStatus.color}-700`}>
                                  {expiryStatus.text}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Manufacturing Date */}
                      {batch.mfgDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Mfg Date</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatDate(batch.mfgDate)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Cost Price */}
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">Cost</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {formatVND(batch.costPrice)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Location Info */}
                    {batch.detailInventory?.location && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Package className="w-3 h-3" />
                          <span>Location: {batch.detailInventory.location.locationCode || 'N/A'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Sorted by expiry date (FEFO - First Expire First Out)</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
