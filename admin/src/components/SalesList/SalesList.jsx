import React, { useState } from 'react';
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
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm py-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
        <p className="mt-4 text-[13px] text-gray-500 font-['Poppins',sans-serif]">
          Loading sales data...
        </p>
      </div>
    );
  }

  if (!salesData || salesData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm py-16 text-center">
        <svg
          className="mx-auto h-16 w-16 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-4 text-[16px] font-semibold text-gray-900 font-['Poppins',sans-serif]">
          No sales data found
        </h3>
        <p className="mt-2 text-[13px] text-gray-500 font-['Poppins',sans-serif]">
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
              <th className="px-6 py-3 text-left text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                Product
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                SKU
              </th>
              <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                Quantity Sold
              </th>
              <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                Unit Price
              </th>
              <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                Total Amount
              </th>
              <th className="px-6 py-3 text-center text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {salesData.map((item, index) => (
              <tr
                key={index}
                className={`hover:bg-gray-50 transition-colors ${index !== salesData.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
              >
                {/* Product Name */}
                <td className="px-6 py-4">
                  <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529]">
                    {item.name || 'N/A'}
                  </p>
                </td>

                {/* SKU */}
                <td className="px-6 py-4">
                  <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#6c757d]">
                    {item.sku || 'N/A'}
                  </p>
                </td>

                {/* Quantity */}
                <td className="px-6 py-4 text-right">
                  <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-blue-600">
                    {item.quantity || 0}
                  </p>
                </td>

                {/* Unit Price */}
                <td className="px-6 py-4 text-right">
                  <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529]">
                    ${(item.unitPrice || 0).toFixed(2)}
                  </p>
                </td>

                {/* Total Amount */}
                <td className="px-6 py-4 text-right">
                  <p className="text-[14px] font-semibold font-['Poppins',sans-serif] text-emerald-600">
                    ${(item.totalAmount || 0).toFixed(2)}
                  </p>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleViewDetails(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg transition-colors text-[12px] font-['Poppins',sans-serif] font-medium"
                    title="View order details"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Table Footer with Total */}
          {summary && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan="3" className="px-6 py-4">
                  <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#6c757d]">
                    Total Products: {salesData.length}
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-blue-600">
                    {summary.totalQuantity || 0}
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-[14px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                    Total Revenue:
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-[18px] font-bold font-['Poppins',sans-serif] text-emerald-600">
                    ${(summary.totalRevenue || 0).toFixed(2)}
                  </p>
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* View Sales Details Modal */}
      <ViewSalesDetailsModal
        product={selectedProduct}
        orders={selectedProduct?.orders || []}
        onClose={handleCloseModal}
      />
    </div>
  );
};
