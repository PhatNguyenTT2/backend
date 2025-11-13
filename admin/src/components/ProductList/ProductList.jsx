import React, { useState } from 'react';

export const ProductList = ({
  products,
  onSort,
  sortField,
  sortOrder,
  onEdit,
  onDelete,
  onToggleActive
}) => {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const handleSort = (field) => {
    const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(field, newOrder);
  };

  const toggleRowExpansion = (productId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm font-['Poppins',sans-serif]">No products found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('productCode')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-emerald-600 font-['Poppins',sans-serif]"
                >
                  Product Code
                  <SortIcon field="productCode" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-emerald-600 font-['Poppins',sans-serif]"
                >
                  Product Name
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('categoryName')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-emerald-600 font-['Poppins',sans-serif]"
                >
                  Category
                  <SortIcon field="categoryName" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('unitPrice')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-emerald-600 font-['Poppins',sans-serif]"
                >
                  Unit Price
                  <SortIcon field="unitPrice" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('vendor')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-emerald-600 font-['Poppins',sans-serif]"
                >
                  Vendor
                  <SortIcon field="vendor" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('stock')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-emerald-600 font-['Poppins',sans-serif]"
                >
                  Stock
                  <SortIcon field="stock" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider font-['Poppins',sans-serif]">
                  Status
                </span>
              </th>
              <th className="px-6 py-3 text-center">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider font-['Poppins',sans-serif]">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <React.Fragment key={product.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  {/* Product Code */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRowExpansion(product.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${expandedRows.has(product.id) ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <span className="text-sm font-medium text-gray-900 font-['Poppins',sans-serif]">
                        {product.productCode}
                      </span>
                    </div>
                  </td>

                  {/* Product Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-10 h-10 rounded-md object-cover"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/40?text=No+Image';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="text-sm font-medium text-gray-900 font-['Poppins',sans-serif] max-w-xs truncate">
                        {product.name}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700 font-['Poppins',sans-serif]">
                      {product.categoryName || product.category?.name || '-'}
                    </span>
                  </td>

                  {/* Unit Price */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900 font-['Poppins',sans-serif]">
                      {formatPrice(product.unitPrice)}
                    </span>
                  </td>

                  {/* Vendor */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700 font-['Poppins',sans-serif]">
                      {product.vendor || '-'}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium font-['Poppins',sans-serif] ${(product.stock || 0) === 0 ? 'text-red-600' :
                        (product.stock || 0) < 10 ? 'text-yellow-600' :
                          'text-green-600'
                      }`}>
                      {product.stock || 0}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onToggleActive(product)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-['Poppins',sans-serif] transition-colors ${product.isActive !== false
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                    >
                      {product.isActive !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onEdit(product)}
                        className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(product)}
                        className="text-red-600 hover:text-red-800 transition-colors p-1"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded Row - Product Details */}
                {expandedRows.has(product.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan="8" className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-['Poppins',sans-serif]">
                        <div>
                          <span className="font-semibold text-gray-700">Created:</span>
                          <span className="ml-2 text-gray-600">
                            {new Date(product.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Updated:</span>
                          <span className="ml-2 text-gray-600">
                            {new Date(product.updatedAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        {product.image && (
                          <div className="md:col-span-2">
                            <span className="font-semibold text-gray-700">Image:</span>
                            <div className="mt-2">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-32 h-32 rounded-md object-cover border border-gray-200"
                                onError={(e) => {
                                  e.target.src = 'https://via.placeholder.com/128?text=No+Image';
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductList;
