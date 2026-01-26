import React, { useState, useEffect } from 'react';
import { X, Package, Search } from 'lucide-react';
import storeLocationService from '../../services/storeLocationService';

export const AssignBatchModal = ({ isOpen, onClose, onSuccess, initialLocationName = '' }) => {
  const [batchesOnShelf, setBatchesOnShelf] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedBatch, setSelectedBatch] = useState(null);
  const [locationName, setLocationName] = useState('');

  // Fetch batches on shelf when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialLocationName) {
        setLocationName(initialLocationName);
      } else {
        setLocationName('');
      }
      fetchBatchesOnShelf();
    }
  }, [isOpen, initialLocationName]);

  const fetchBatchesOnShelf = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await storeLocationService.getBatchesOnShelf();
      setBatchesOnShelf(data);
    } catch (err) {
      console.error('Error fetching batches on shelf:', err);
      setError('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBatch) {
      setError('Please select a batch');
      return;
    }

    if (!locationName.trim()) {
      setError('Please enter a location name');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await storeLocationService.createStoreLocation({
        batchCode: selectedBatch.batchCode,
        name: locationName.trim().toUpperCase()
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error assigning batch:', err);
      setError(err.response?.data?.error || 'Failed to assign batch to location');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter batches by search query
  const filteredBatches = batchesOnShelf.filter(batch => {
    if (!searchQuery.trim()) return !batch.isAssigned;
    const query = searchQuery.toLowerCase();
    return !batch.isAssigned && (
      batch.batchCode?.toLowerCase().includes(query) ||
      batch.product?.name?.toLowerCase().includes(query)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Assign Batch to Store Location
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Select a batch on shelf to assign to a store location
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Location Name Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Location Name *
            </label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase"
              placeholder="SHELF A01"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: SHELF [Section][Number] (e.g., SHELF A01). If location exists, batch will be assigned to it.
            </p>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="Search by batch code or product name..."
              />
            </div>
          </div>

          {/* Batch List */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Batch *
            </label>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading batches...
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No unassigned batches on shelf</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
                {filteredBatches.map((batch) => (
                  <div
                    key={batch.batchCode}
                    onClick={() => setSelectedBatch(batch)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer mb-2 flex flex-col gap-1 ${selectedBatch?.batchCode === batch.batchCode
                      ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${selectedBatch?.batchCode === batch.batchCode ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
                          }`}>
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {batch.product?.name || 'Unknown Product'}
                          </p>
                          <p className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-1">
                            {batch.batchCode}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">
                          {batch.quantityOnShelf}
                          <span className="text-xs font-normal text-gray-500 ml-1">qty</span>
                        </p>
                        {batch.expiryDate && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            Exp: {new Date(batch.expiryDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedBatch || !locationName.trim()}
              className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Assigning...' : 'Assign Batch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
