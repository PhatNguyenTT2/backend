import React from 'react';

export const ViewSalesDetailsModal = ({ product, orders, onClose }) => {
  if (!product) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-blue-50">
          <div>
            <h3 className="text-[18px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Sales Details: {product.name}
            </h3>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-[12px] text-[#6c757d] font-['Poppins',sans-serif]">
                SKU: <span className="font-semibold text-gray-700">{product.sku}</span>
              </p>
              <span className="text-gray-300">|</span>
              <p className="text-[12px] text-[#6c757d] font-['Poppins',sans-serif]">
                Total Sold: <span className="font-semibold text-blue-600">{product.quantity}</span>
              </p>
              <span className="text-gray-300">|</span>
              <p className="text-[12px] text-[#6c757d] font-['Poppins',sans-serif]">
                Total Revenue: <span className="font-semibold text-emerald-600">${product.totalAmount?.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto max-h-[calc(80vh-180px)]">
          {orders && orders.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                    Order Number
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                    Date
                  </th>
                  <th className="px-6 py-3 text-center text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => {
                  // Get status badge color
                  const getStatusColor = (status) => {
                    const statusMap = {
                      pending: 'bg-yellow-100 text-yellow-800',
                      processing: 'bg-blue-100 text-blue-800',
                      shipping: 'bg-purple-100 text-purple-800',
                      delivered: 'bg-green-100 text-green-800',
                      cancelled: 'bg-red-100 text-red-800',
                    };
                    return statusMap[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
                  };

                  return (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-emerald-600">
                          {order.orderNumber}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529]">
                          {order.customerName || 'N/A'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#6c757d]">
                          {new Date(order.orderDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold font-['Poppins',sans-serif] uppercase ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-blue-600">
                          {order.quantity}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529]">
                          ${order.unitPrice?.toFixed(2)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-[14px] font-semibold font-['Poppins',sans-serif] text-emerald-600">
                          ${order.subtotal?.toFixed(2)}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-16 text-center">
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
              <p className="mt-4 text-[13px] text-[#6c757d] font-['Poppins',sans-serif]">
                No order details found for this product
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-[13px] text-[#6c757d] font-['Poppins',sans-serif]">
              Total Orders: <span className="font-semibold text-gray-700">{orders?.length || 0}</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[11px] text-[#6c757d] font-['Poppins',sans-serif] uppercase tracking-[0.5px]">
                  Total Quantity
                </p>
                <p className="text-[16px] font-bold font-['Poppins',sans-serif] text-blue-600">
                  {product.quantity}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#6c757d] font-['Poppins',sans-serif] uppercase tracking-[0.5px]">
                  Total Revenue
                </p>
                <p className="text-[18px] font-bold font-['Poppins',sans-serif] text-emerald-600">
                  ${product.totalAmount?.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
