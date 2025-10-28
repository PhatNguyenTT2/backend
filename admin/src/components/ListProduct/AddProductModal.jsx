import React, { useState, useEffect } from 'react';
// import productService from '../../services/productService';
// import categoryService from '../../services/categoryService';

export const AddProductModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    image: '',
    category: '',
    costPrice: '',
    price: '',
    originalPrice: '',
    vendor: '',
    stock: '0',
    description: ''
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      // Reset form
      setFormData({
        name: '',
        image: '',
        category: '',
        costPrice: '',
        price: '',
        originalPrice: '',
        vendor: '',
        stock: '0',
        description: ''
      });
      setError(null);
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const response = await categoryService.getCategories();
      if (response.success && response.data && response.data.categories) {
        setCategories(response.data.categories);
      } else if (Array.isArray(response)) {
        setCategories(response);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load categories');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }

    if (!formData.category) {
      setError('Category is required');
      return;
    }

    if (!formData.costPrice || parseFloat(formData.costPrice) < 0) {
      setError('Cost price must be greater than or equal to 0');
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError('Selling price must be greater than 0');
      return;
    }

    // Warning if selling below cost
    if (parseFloat(formData.price) < parseFloat(formData.costPrice)) {
      const confirmed = window.confirm(
        '⚠️ WARNING: Selling price is lower than cost price.\nThis will result in a loss!\n\nContinue anyway?'
      );
      if (!confirmed) return;
    }

    if (!formData.vendor.trim()) {
      setError('Vendor is required');
      return;
    }

    // Stock is always 0 for new products (managed through purchase orders)
    // Description is optional

    setLoading(true);
    setError(null);

    try {
      // Prepare data
      const productData = {
        name: formData.name.trim(),
        category: formData.category,
        costPrice: parseFloat(formData.costPrice),
        price: parseFloat(formData.price),
        vendor: formData.vendor.trim(),
        stock: 0, // Always 0 for new products
        description: formData.description.trim() || 'No description provided'
      };

      // Add originalPrice if provided
      if (formData.originalPrice && parseFloat(formData.originalPrice) > 0) {
        productData.originalPrice = parseFloat(formData.originalPrice);
      }

      // Add image if provided
      if (formData.image.trim()) {
        productData.image = formData.image.trim();
      } else {
        // Use placeholder if no image
        productData.image = 'https://via.placeholder.com/400?text=No+Image';
      }

      const response = await productService.createProduct(productData);

      if (onSuccess) {
        onSuccess(response);
      }
      onClose();
    } catch (err) {
      console.error('Error creating product:', err);
      setError(err.response?.data?.error || err.error || err.message || 'Failed to create product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Create New Product
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {error}
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter product name"
              required
              maxLength={255}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
              SKU will be auto-generated
            </p>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Image URL (Optional)
            </label>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => handleChange('image', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
              Leave empty to use placeholder image
            </p>

            {/* Image Preview */}
            {formData.image && (
              <div className="mt-3">
                <p className="text-[12px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Preview:
                </p>
                <img
                  src={formData.image}
                  alt="Preview"
                  className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"%3E%3Crect width="128" height="128" fill="%23f3f4f6"/%3E%3Ctext x="64" y="64" text-anchor="middle" dy=".3em" fill="%23ef4444" font-family="sans-serif" font-size="12"%3EInvalid URL%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
            )}
          </div>

          {/* Row 2: Category & Vendor */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id || cat._id} value={cat.id || cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Vendor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => handleChange('vendor', e.target.value)}
                placeholder="Enter vendor name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 3: Cost Price, Selling Price, Original Price */}
          <div className="grid grid-cols-3 gap-4">
            {/* Cost Price (Purchase Price) */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Cost Price ($) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.costPrice}
                onChange={(e) => handleChange('costPrice', e.target.value)}
                placeholder="0.00"
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                Purchase from supplier
              </p>
            </div>

            {/* Selling Price */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Selling Price ($) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                placeholder="0.00"
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {/* Auto-calculate profit margin */}
              {formData.costPrice && formData.price &&
                parseFloat(formData.costPrice) > 0 && parseFloat(formData.price) > 0 && (
                  <p className={`mt-1 text-[11px] font-medium font-['Poppins',sans-serif] ${parseFloat(formData.price) >= parseFloat(formData.costPrice)
                    ? 'text-emerald-600'
                    : 'text-red-600'
                    }`}>
                    {parseFloat(formData.price) >= parseFloat(formData.costPrice) ? '📈' : '📉'} Margin: {
                      (((parseFloat(formData.price) - parseFloat(formData.costPrice)) /
                        parseFloat(formData.price)) * 100).toFixed(2)
                    }%
                  </p>
                )}
            </div>

            {/* Original Price (Optional - for discount) */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Original Price ($)
              </label>
              <input
                type="number"
                value={formData.originalPrice}
                onChange={(e) => handleChange('originalPrice', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {/* Auto-calculate discount */}
              {formData.originalPrice && formData.price &&
                parseFloat(formData.originalPrice) > parseFloat(formData.price) && (
                  <p className="mt-1 text-[11px] text-blue-600 font-medium font-['Poppins',sans-serif]">
                    🏷️ Discount: {
                      Math.round(((parseFloat(formData.originalPrice) - parseFloat(formData.price)) /
                        parseFloat(formData.originalPrice)) * 100)
                    }% off
                  </p>
                )}
              {!formData.originalPrice && (
                <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                  For products on sale
                </p>
              )}
            </div>
          </div>

          {/* Row 4: Stock (Read-only) */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Stock Quantity
            </label>
            <input
              type="number"
              value="0"
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-['Poppins',sans-serif] bg-gray-50 text-gray-600 cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
              Stock will be added through purchase orders
            </p>
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter product description (optional)"
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                Maximum 2000 characters
              </p>
              <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                {formData.description.length}/2000
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2"
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
                'Create Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
