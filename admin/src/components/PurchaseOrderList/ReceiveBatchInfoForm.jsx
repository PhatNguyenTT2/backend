import React, { useState, useEffect } from 'react';

/**
 * ReceiveBatchInfoForm
 * Form để nhập thông tin batch khi nhận hàng từ Purchase Order
 * Tạo batch mới với manufacturing date, expiry date từ bao bì sản phẩm
 */
export const ReceiveBatchInfoForm = ({
  poDetail,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    quantityReceived: poDetail?.quantity || '',
    mfgDate: '',
    expiryDate: '',
    warehouseLocation: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  // Reset form when poDetail changes
  useEffect(() => {
    if (poDetail) {
      setFormData({
        quantityReceived: poDetail.quantity || '',
        mfgDate: '',
        expiryDate: '',
        warehouseLocation: '',
        notes: ''
      });
      setErrors({});
    }
  }, [poDetail]);

  const validateForm = () => {
    const newErrors = {};

    // Quantity validation
    const receivedQty = parseInt(formData.quantityReceived);
    const orderedQty = poDetail?.quantity || 0;

    if (!formData.quantityReceived || receivedQty <= 0) {
      newErrors.quantityReceived = 'Quantity received is required and must be greater than 0';
    } else if (receivedQty > orderedQty) {
      newErrors.quantityReceived = `Cannot receive more than ordered quantity (${orderedQty})`;
    }

    // Manufacturing date validation
    if (!formData.mfgDate) {
      newErrors.mfgDate = 'Manufacturing date is required';
    } else {
      const mfg = new Date(formData.mfgDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (mfg > today) {
        newErrors.mfgDate = 'Manufacturing date cannot be in the future';
      }
    }

    // Expiry date validation
    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (formData.mfgDate) {
      const mfg = new Date(formData.mfgDate);
      const exp = new Date(formData.expiryDate);

      if (exp <= mfg) {
        newErrors.expiryDate = 'Expiry date must be after manufacturing date';
      }

      const today = new Date();
      if (exp <= today) {
        newErrors.expiryDate = 'Expiry date must be in the future';
      }
    }

    // Warehouse location validation
    if (!formData.warehouseLocation?.trim()) {
      newErrors.warehouseLocation = 'Warehouse location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      ...formData,
      quantityReceived: parseInt(formData.quantityReceived),
      poDetail: poDetail
    });
  };

  if (!poDetail) return null;

  const orderedQty = poDetail.quantity || 0;
  const unitPrice = poDetail.unitPrice || 0;
  const totalValue = orderedQty * unitPrice;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Info Header */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start gap-4">
          {poDetail.product?.image && (
            <img
              src={poDetail.product.image}
              alt={poDetail.product?.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
          )}
          <div className="flex-1">
            <h4 className="text-[14px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              {poDetail.product?.name || 'Product'}
            </h4>
            <div className="mt-2 grid grid-cols-3 gap-4 text-[12px] font-['Poppins',sans-serif]">
              <div>
                <span className="text-gray-600">Ordered:</span>
                <span className="ml-2 font-semibold text-emerald-700">{orderedQty} units</span>
              </div>
              <div>
                <span className="text-gray-600">Unit Price:</span>
                <span className="ml-2 font-semibold text-emerald-700">
                  {unitPrice.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total Value:</span>
                <span className="ml-2 font-semibold text-emerald-700">
                  {totalValue.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quantity Received */}
      <div>
        <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
          Quantity Received <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="number"
            name="quantityReceived"
            value={formData.quantityReceived}
            onChange={handleChange}
            min="1"
            max={orderedQty}
            placeholder={`Max: ${orderedQty} units`}
            className={`w-full px-3 py-2 border rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errors.quantityReceived ? 'border-red-500' : 'border-gray-300'
              }`}
            disabled={loading}
          />
          {formData.quantityReceived && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[11px] text-gray-500">
              {((parseInt(formData.quantityReceived) / orderedQty) * 100).toFixed(0)}%
            </div>
          )}
        </div>
        {errors.quantityReceived && (
          <p className="mt-1 text-[11px] text-red-600 font-['Poppins',sans-serif]">
            {errors.quantityReceived}
          </p>
        )}
        {formData.quantityReceived && parseInt(formData.quantityReceived) < orderedQty && (
          <p className="mt-1 text-[11px] text-orange-600 font-['Poppins',sans-serif]">
            ⚠️ Receiving partial quantity. Remaining: {orderedQty - parseInt(formData.quantityReceived)} units
          </p>
        )}
      </div>

      {/* Batch Information from Package */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-[12px] font-medium font-['Poppins',sans-serif] text-blue-700 mb-2">
          📦 Enter batch information from product packaging
        </p>
      </div>

      {/* Manufacturing Date & Expiry Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
            Manufacturing Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="mfgDate"
            value={formData.mfgDate}
            onChange={handleChange}
            max={new Date().toISOString().split('T')[0]}
            className={`w-full px-3 py-2 border rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errors.mfgDate ? 'border-red-500' : 'border-gray-300'
              }`}
            disabled={loading}
          />
          {errors.mfgDate && (
            <p className="mt-1 text-[11px] text-red-600 font-['Poppins',sans-serif]">
              {errors.mfgDate}
            </p>
          )}
        </div>

        <div>
          <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
            Expiry Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="expiryDate"
            value={formData.expiryDate}
            onChange={handleChange}
            min={formData.mfgDate || new Date().toISOString().split('T')[0]}
            className={`w-full px-3 py-2 border rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errors.expiryDate ? 'border-red-500' : 'border-gray-300'
              }`}
            disabled={loading}
          />
          {errors.expiryDate && (
            <p className="mt-1 text-[11px] text-red-600 font-['Poppins',sans-serif]">
              {errors.expiryDate}
            </p>
          )}
          {formData.mfgDate && formData.expiryDate && !errors.expiryDate && (
            <p className="mt-1 text-[11px] text-emerald-600 font-['Poppins',sans-serif]">
              ✓ Shelf life: {Math.ceil((new Date(formData.expiryDate) - new Date(formData.mfgDate)) / (1000 * 60 * 60 * 24))} days
            </p>
          )}
        </div>
      </div>

      {/* Warehouse Location */}
      <div>
        <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
          Warehouse Location <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="warehouseLocation"
          value={formData.warehouseLocation}
          onChange={handleChange}
          placeholder="e.g., A1-B2, Shelf 3, Zone C"
          maxLength={50}
          className={`w-full px-3 py-2 border rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errors.warehouseLocation ? 'border-red-500' : 'border-gray-300'
            }`}
          disabled={loading}
        />
        {errors.warehouseLocation && (
          <p className="mt-1 text-[11px] text-red-600 font-['Poppins',sans-serif]">
            {errors.warehouseLocation}
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
          Notes (Optional)
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          maxLength={500}
          placeholder="e.g., Package condition, temperature, special handling..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          disabled={loading}
        />
        <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
          {formData.notes.length}/500
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Receiving...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 12V4M8 4L5 7M8 4L11 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12H14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Receive Stock
            </>
          )}
        </button>
      </div>
    </form>
  );
};
