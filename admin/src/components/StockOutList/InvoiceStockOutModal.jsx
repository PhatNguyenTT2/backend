import React, { useState, useEffect } from 'react';
import stockOutOrderService from '../../services/stockOutOrderService';
import detailStockOutOrderService from '../../services/detailStockOutOrderService';

/**
 * InvoiceStockOutModal Component
 * Hiển thị chi tiết invoice của stock out order
 */
export const InvoiceStockOutModal = ({ stockOutOrder, onClose }) => {
  const [fullSO, setFullSO] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFullSO = async () => {
      if (!stockOutOrder) return;

      // Check if stockOutOrder already has details populated
      if (stockOutOrder.details && Array.isArray(stockOutOrder.details) && stockOutOrder.details.length > 0) {
        setFullSO(stockOutOrder);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await stockOutOrderService.getStockOutOrderById(stockOutOrder._id || stockOutOrder.id);

        // Handle different response structures
        let soData = null;
        if (response.success && response.data && response.data.stockOutOrder) {
          soData = response.data.stockOutOrder;
        } else if (response.data && !response.success) {
          soData = response.data;
        } else if (response.stockOutOrder) {
          soData = response.stockOutOrder;
        } else {
          soData = stockOutOrder;
        }

        // If details is still not available, fetch it separately
        if (!soData.details || !Array.isArray(soData.details) || soData.details.length === 0) {
          try {
            const detailsResponse = await detailStockOutOrderService.getDetailsByStockOutOrder(stockOutOrder._id || stockOutOrder.id);
            if (detailsResponse.success && detailsResponse.data && detailsResponse.data.detailStockOutOrders) {
              soData.details = detailsResponse.data.detailStockOutOrders;
            } else if (Array.isArray(detailsResponse.data)) {
              soData.details = detailsResponse.data;
            } else if (Array.isArray(detailsResponse)) {
              soData.details = detailsResponse;
            }
          } catch (detailError) {
            soData.details = [];
          }
        }

        setFullSO(soData);
      } catch (error) {
        setFullSO(stockOutOrder);
      } finally {
        setLoading(false);
      }
    };

    fetchFullSO();
  }, [stockOutOrder]);

  if (!stockOutOrder) return null;

  if (loading || !fullSO) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <p className="text-[14px] font-['Poppins',sans-serif] text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  const so = fullSO;
  const details = so.details || [];

  // Calculate subtotal from details
  const subtotal = details.reduce((sum, detail) => {
    const itemTotal = detail.total || (detail.quantity * (detail.unitPrice || 0));
    return sum + parseFloat(itemTotal);
  }, 0);

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';
    return `₫${Number(amount).toLocaleString('vi-VN')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Get reason label
  const getReasonLabel = (reason) => {
    const labels = {
      sales: 'Sales',
      transfer: 'Transfer',
      damage: 'Damage',
      expired: 'Expired',
      return_to_supplier: 'Return to Supplier',
      internal_use: 'Internal Use',
      other: 'Other'
    };
    return labels[reason] || reason;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600';
      case 'approved':
        return 'text-blue-600';
      case 'pending':
        return 'text-amber-600';
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const handlePrintInvoice = () => {
    const printContent = document.getElementById('stockout-invoice-content');
    if (printContent) {
      const printWindow = window.open('', '', 'width=800,height=600');
      printWindow.document.write('<html><head><title>Stock Out Order Invoice</title>');
      printWindow.document.write('<style>body{font-family:Arial,sans-serif;padding:20px;}</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Stock Out Order Invoice
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Invoice Body */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-8 bg-white" id="stockout-invoice-content">
          {/* Invoice Header */}
          <div className="text-center mb-6 border-b-2 border-red-600 pb-4">
            <h1 className="text-[24px] font-bold font-['Poppins',sans-serif] text-red-600 uppercase tracking-wider">
              STOCK OUT ORDER
            </h1>
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-[13px]">
            <div>
              <p className="font-['Poppins',sans-serif]">
                <span className="font-semibold text-red-600">SO Number:</span> {so.soNumber || so.id}
              </p>
            </div>
            <div className="text-right">
              <p className="font-['Poppins',sans-serif]">
                <span className="font-semibold text-red-600">Order Date:</span> {formatDate(so.orderDate)}
              </p>
            </div>
          </div>

          {/* Order Details */}
          <div className="mb-6 space-y-2">
            <p className="text-[14px] font-['Poppins',sans-serif]">
              <span className="font-semibold text-red-600">Reason:</span> {getReasonLabel(so.reason)}
            </p>
            {so.destination && (
              <p className="text-[13px] font-['Poppins',sans-serif]">
                <span className="font-semibold text-red-600">Destination:</span> {so.destination}
              </p>
            )}
            {so.completedDate && (
              <p className="text-[13px] font-['Poppins',sans-serif]">
                <span className="font-semibold text-red-600">Completed Date:</span>
                <span className="ml-2 text-emerald-600">
                  {formatDate(so.completedDate)}
                </span>
              </p>
            )}
            <p className="text-[13px] font-['Poppins',sans-serif]">
              <span className="font-semibold text-red-600">Status:</span>
              <span className={`ml-2 capitalize font-medium ${getStatusColor(so.status)}`}>
                {so.status || 'N/A'}
              </span>
            </p>
            {so.createdBy && (
              <p className="text-[13px] font-['Poppins',sans-serif]">
                <span className="font-semibold text-red-600">Created By:</span> {so.createdBy?.fullName || so.createdBy?.username || 'N/A'}
              </p>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-center">
                    No.
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-left">
                    Product Name
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-center">
                    Batch Code
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-center">
                    Quantity
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    Unit Price
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {details && details.length > 0 ? (
                  details.map((detail, idx) => {
                    const productName = detail.product?.name || detail.productId?.name || 'N/A';
                    const batchCode = detail.batchId?.batchCode || detail.batch?.batchCode || 'N/A';
                    const quantity = detail.quantity || 0;
                    const unitPrice = detail.unitPrice || 0;
                    const itemTotal = detail.total || (quantity * unitPrice);

                    return (
                      <tr key={detail._id || detail.id || idx}>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-center">
                          {idx + 1}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif]">
                          {productName}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-center font-mono">
                          {batchCode}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-center">
                          {quantity}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-right">
                          {formatCurrency(unitPrice)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-right">
                          {formatCurrency(itemTotal)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="border border-gray-300 px-3 py-4 text-center text-[12px] text-gray-500">
                      No items found
                    </td>
                  </tr>
                )}
                {/* Subtotal Row */}
                <tr className="bg-gray-50">
                  <td colSpan="5" className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    Subtotal:
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    {formatCurrency(subtotal)}
                  </td>
                </tr>
                {/* Total Items Row */}
                <tr className="bg-red-50">
                  <td colSpan="3" className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right text-red-600">
                    TOTAL ITEMS:
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[12px] font-bold font-['Poppins',sans-serif] text-center text-red-600">
                    {details.reduce((sum, detail) => sum + (detail.quantity || 0), 0)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right text-red-600">
                    TOTAL VALUE:
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[12px] font-bold font-['Poppins',sans-serif] text-right text-red-600">
                    {formatCurrency(subtotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {so.notes && (
            <div className="mb-6">
              <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-2">
                Notes:
              </p>
              <p className="text-[12px] font-['Poppins',sans-serif] text-gray-600 p-3 bg-gray-50 rounded-lg">
                {so.notes}
              </p>
            </div>
          )}

          {/* Signature Section */}
          <div className="mt-8 grid grid-cols-2 gap-8">
            <div className="text-center">
              <p className="text-[13px] font-['Poppins',sans-serif] text-gray-600 mb-12">
                Prepared by
              </p>
              <p className="text-[14px] font-semibold font-['Poppins',sans-serif] text-red-600">
                {(() => {
                  if (!so.createdBy) return 'N/A';
                  if (typeof so.createdBy === 'string') return so.createdBy;
                  if (so.createdBy.fullName) return so.createdBy.fullName;
                  if (so.createdBy.firstName || so.createdBy.lastName) {
                    return `${so.createdBy.firstName || ''} ${so.createdBy.lastName || ''}`.trim();
                  }
                  if (so.createdBy.username) return so.createdBy.username;
                  return 'N/A';
                })()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[13px] font-['Poppins',sans-serif] text-gray-600 mb-12">
                Received by
              </p>
              <div className="border-t border-gray-400 pt-2">
                <p className="text-[12px] font-['Poppins',sans-serif] text-gray-500">
                  Signature
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-[13px] font-['Poppins',sans-serif] font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrintInvoice}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-[13px] font-['Poppins',sans-serif] font-medium transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="2" width="10" height="3" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2" y="5" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="4" y="9" width="8" height="5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
};
