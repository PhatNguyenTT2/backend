import React from 'react';

export const ViewItemsModal = ({ order, onClose }) => {
  if (!order) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Items in Order {order.orderNumber}
            </h3>
            <p className="text-[12px] text-[#6c757d] mt-1">
              Customer: {order.customerName}
            </p>
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
        <div className="overflow-y-auto max-h-[calc(80vh-140px)]">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                  SKU
                </th>
                <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                  Quantity
                </th>
                <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-right text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529]">
                        {item.product?.name || item.productName || 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#6c757d]">
                        {item.product?.sku || item.sku || 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529]">
                        {item.quantity || 0}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529]">
                        ${(item.price || 0).toFixed(2)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                        ${((item.quantity || 0) * (item.price || 0)).toFixed(2)}
                      </p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center">
                    <p className="text-[13px] text-[#6c757d] font-['Poppins',sans-serif]">
                      No items found
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-[13px] text-[#6c757d] font-['Poppins',sans-serif]">
              Total Items: {order.items?.length || 0}
            </div>
            <div className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Total Amount: ${parseFloat(order.total || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
