import React from 'react';
import { MapPin, X } from 'lucide-react';

export const LocationDetailModal = ({ isOpen, location, onClose }) => {
  if (!isOpen || !location) return null;

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

  const occupiedCapacity = location.currentBatches?.reduce((total, batch) => {
    return total + (batch.quantityOnHand || 0) + (batch.quantityOnShelf || 0);
  }, 0) || 0;
  const maxCapacity = location.maxCapacity || 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Location {location.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Code: {location.locationCode} • Capacity: {occupiedCapacity} / {maxCapacity}
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
          {location.currentBatches && location.currentBatches.length > 0 ? (
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
                {location.currentBatches.map((batch, index) => {
                  // Try both field names for expiry date
                  const expiryDateStr = batch.batchId?.expiryDate || batch.batchId?.expirationDate;
                  const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
                  const isExpiringSoon = expiryDate && (expiryDate - new Date()) < (30 * 24 * 60 * 60 * 1000);

                  return (
                    <div
                      key={batch._id || index}
                      className={`flex items-center h-[60px] hover:bg-gray-50 transition-colors ${index !== location.currentBatches.length - 1 ? 'border-b border-gray-100' : ''
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
