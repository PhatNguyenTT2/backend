import React, { useState } from 'react';
import { Eye, TrendingUp } from 'lucide-react';
import { ViewSalesDetailsModal } from './ViewSalesDetailsModal';

export const SalesList = ({ salesData = [], summary = null, loading = false }) => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewDetailsModal, setViewDetailsModal] = useState(false);

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setViewDetailsModal(true);
  };

  const handleCloseModal = () => {
    setViewDetailsModal(false);
    setSelectedProduct(null);
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';

    // Handle Mongoose Decimal128
    if (typeof amount === 'object' && amount.$numberDecimal) {
      return `₫${Number(amount.$numberDecimal).toLocaleString('vi-VN')}`;
    }

    return `₫${Number(amount).toLocaleString('vi-VN')}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm py-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-[13px] text-gray-500">
          Loading sales data...
        </p>
      </div>
    );
  }

  if (!salesData || salesData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm py-16 text-center">
        <TrendingUp className="mx-auto h-16 w-16 text-gray-400" />
        <h3 className="mt-4 text-[16px] font-semibold text-gray-900">
          No sales data found
        </h3>
        <p className="mt-2 text-[13px] text-gray-500">
          There are no orders in the selected date range
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Table Header */}
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                Product Code
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-right text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                Qty Sold
              </th>
              <th className="px-6 py-3 text-right text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-right text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                Total Revenue
              </th>
              <th className="px-6 py-3 text-center text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                Orders
              </th>
              <th className="px-6 py-3 text-center text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-gray-100">
            {salesData.map((product, index) => (
              <tr
                key={product.productId || index}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Product Code */}
                <td className="px-6 py-4">
                  <p className="text-[13px] font-medium text-gray-900">
                    {product.productCode}
                  </p>
                </td>

                {/* Product Name */}
                <td className="px-6 py-4">
                  <p className="text-[13px] font-medium text-gray-900">
                    {product.productName}
                  </p>
                </td>

                {/* Category */}
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">
                    {product.categoryName}
                  </span>
                </td>

                {/* Quantity Sold */}
                <td className="px-6 py-4 text-right">
                  <p className="text-[13px] font-semibold text-green-600">
                    {product.totalQuantity.toLocaleString()}
                  </p>
                </td>

                {/* Average Price */}
                <td className="px-6 py-4 text-right">
                  <p className="text-[13px] text-gray-700">
                    {formatCurrency(product.averagePrice)}
                  </p>
                </td>

                {/* Total Revenue */}
                <td className="px-6 py-4 text-right">
                  <p className="text-[14px] font-semibold text-blue-600">
                    {formatCurrency(product.totalRevenue)}
                  </p>
                </td>

                {/* Total Orders */}
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-[12px] font-semibold text-gray-700">
                    {product.totalOrders}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleViewDetails(product)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg transition-colors text-[12px] font-medium"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Table Footer with Summary */}
          {summary && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan="3" className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="text-[13px] font-semibold text-gray-900">
                      Summary Statistics
                    </p>
                    <p className="text-[12px] text-gray-600">
                      {summary.totalProducts} products • {summary.totalOrders} orders
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-[11px] text-gray-500 uppercase">Total Qty</p>
                  <p className="text-[14px] font-bold text-green-600">
                    {summary.totalQuantity.toLocaleString()}
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-[11px] text-gray-500 uppercase">Order</p>
                  <p className="text-[13px] font-semibold text-gray-700">
                    {formatCurrency(summary.averageOrderValue)}
                  </p>
                </td>
                <td colSpan="3" className="px-6 py-4 text-right">
                  <p className="text-[11px] text-gray-500 uppercase mb-1">Total Revenue</p>
                  <p className="text-[18px] font-bold text-blue-600">
                    {formatCurrency(summary.totalRevenue)}
                  </p>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* View Sales Details Modal */}
      {viewDetailsModal && (
        <ViewSalesDetailsModal
          product={selectedProduct}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
