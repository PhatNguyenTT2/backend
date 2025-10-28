import React from 'react';

/**
 * InvoicePurchaseModal Component
 * Hiển thị chi tiết hóa đơn của purchase order với đầy đủ thông tin
 */
export const InvoicePurchaseModal = ({ purchaseOrder, onClose, onViewItems }) => {
  if (!purchaseOrder) return null;

  // Sử dụng giá trị trực tiếp từ database
  const invoiceValues = {
    subtotal: parseFloat(purchaseOrder.subtotal) || 0,
    discount: parseFloat(purchaseOrder.discount) || 0,
    shippingFee: parseFloat(purchaseOrder.shippingFee) || 0,
    tax: parseFloat(purchaseOrder.tax) || 0,
    total: parseFloat(purchaseOrder.total) || 0
  };

  const handlePrintInvoice = () => {
    const printContent = document.getElementById('purchase-invoice-content');
    if (printContent) {
      const printWindow = window.open('', '', 'width=800,height=600');
      printWindow.document.write('<html><head><title>Purchase Order Invoice</title>');
      printWindow.document.write('<style>body{font-family:Arial,sans-serif;padding:20px;}</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
            Purchase Order Invoice
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
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-8 bg-white" id="purchase-invoice-content">
          {/* Invoice Header */}
          <div className="text-center mb-6 border-b-2 border-emerald-600 pb-4">
            <h1 className="text-[24px] font-bold font-['Poppins',sans-serif] text-emerald-600 uppercase tracking-wider">
              PURCHASE ORDER
            </h1>
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-[13px]">
            <div>
              <p className="font-['Poppins',sans-serif]">
                <span className="font-semibold text-emerald-600">PO Number:</span> {purchaseOrder.poNumber || purchaseOrder.id}
              </p>
            </div>
            <div className="text-right">
              <p className="font-['Poppins',sans-serif]">
                <span className="font-semibold text-emerald-600">Order Date:</span> {formatDate(purchaseOrder.orderDate)}
              </p>
            </div>
          </div>

          {/* Supplier Info */}
          <div className="mb-6 space-y-2">
            <p className="text-[14px] font-['Poppins',sans-serif]">
              <span className="font-semibold text-emerald-600">Supplier Name:</span> {purchaseOrder.supplierName || purchaseOrder.supplier?.companyName || 'N/A'}
            </p>
            {purchaseOrder.supplierCode && (
              <p className="text-[13px] font-['Poppins',sans-serif]">
                <span className="font-semibold text-emerald-600">Supplier Code:</span> {purchaseOrder.supplierCode}
              </p>
            )}
            {purchaseOrder.supplier?.email && (
              <p className="text-[13px] font-['Poppins',sans-serif]">
                <span className="font-semibold text-emerald-600">Email:</span> {purchaseOrder.supplier.email}
              </p>
            )}
            {purchaseOrder.supplier?.phone && (
              <p className="text-[13px] font-['Poppins',sans-serif]">
                <span className="font-semibold text-emerald-600">Phone:</span> {purchaseOrder.supplier.phone}
              </p>
            )}
            {purchaseOrder.expectedDeliveryDate && (
              <p className="text-[13px] font-['Poppins',sans-serif]">
                <span className="font-semibold text-emerald-600">Expected Delivery:</span>
                <span className="ml-2 text-amber-600">
                  {formatDate(purchaseOrder.expectedDeliveryDate)}
                </span>
              </p>
            )}
            <p className="text-[13px] font-['Poppins',sans-serif]">
              <span className="font-semibold text-emerald-600">Status:</span>
              <span className={`ml-2 capitalize font-medium ${purchaseOrder.status === 'pending' ? 'text-amber-600' :
                  purchaseOrder.status === 'approved' ? 'text-blue-600' :
                    purchaseOrder.status === 'received' ? 'text-emerald-600' :
                      'text-red-600'
                }`}>
                {purchaseOrder.status || 'N/A'}
              </span>
            </p>
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
                    SKU
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
                {purchaseOrder.items && purchaseOrder.items.length > 0 ? (
                  purchaseOrder.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-center">
                        {idx + 1}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif]">
                        {item.product?.name || item.productName || 'N/A'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-center text-gray-600">
                        {item.product?.sku || item.sku || '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-center">
                        {item.quantity || 0}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-right">
                        ${(item.unitPrice || 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-right">
                        ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))
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
                    ${invoiceValues.subtotal.toFixed(2)}
                  </td>
                </tr>
                {/* Discount Row - Chỉ hiển thị khi có discount */}
                {invoiceValues.discount > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan="5" className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right text-green-600">
                      Discount:
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right text-green-600">
                      -${invoiceValues.discount.toFixed(2)}
                    </td>
                  </tr>
                )}
                {/* Shipping Row */}
                <tr className="bg-gray-50">
                  <td colSpan="5" className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    Shipping Fee:
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    {invoiceValues.shippingFee > 0 ? (
                      `$${invoiceValues.shippingFee.toFixed(2)}`
                    ) : (
                      <span className="text-green-600">FREE</span>
                    )}
                  </td>
                </tr>
                {/* Tax Row */}
                <tr className="bg-gray-50">
                  <td colSpan="5" className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    Tax (10%):
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    ${invoiceValues.tax.toFixed(2)}
                  </td>
                </tr>
                {/* Total Row */}
                <tr className="bg-emerald-50">
                  <td colSpan="5" className="border border-gray-300 px-3 py-2 text-[14px] font-bold font-['Poppins',sans-serif] text-right text-emerald-600">
                    TOTAL:
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[14px] font-bold font-['Poppins',sans-serif] text-right text-emerald-600">
                    ${invoiceValues.total.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Status */}
          {purchaseOrder.paymentStatus && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center text-[13px] font-['Poppins',sans-serif]">
                <span className="font-semibold text-gray-700">Payment Status:</span>
                <span className={`font-semibold uppercase ${purchaseOrder.paymentStatus === 'paid' ? 'text-green-600' :
                    purchaseOrder.paymentStatus === 'partial' ? 'text-amber-600' :
                      'text-red-600'
                  }`}>
                  {purchaseOrder.paymentStatus}
                </span>
              </div>
              {purchaseOrder.paidAmount !== undefined && (
                <div className="flex justify-between items-center text-[13px] font-['Poppins',sans-serif] mt-2">
                  <span className="font-semibold text-gray-700">Paid Amount:</span>
                  <span className="font-semibold text-green-600">
                    ${(parseFloat(purchaseOrder.paidAmount) || 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {purchaseOrder.notes && (
            <div className="mb-6">
              <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-2">
                Notes:
              </p>
              <p className="text-[12px] font-['Poppins',sans-serif] text-gray-600 p-3 bg-gray-50 rounded-lg">
                {purchaseOrder.notes}
              </p>
            </div>
          )}

          {/* Signature Section */}
          <div className="mt-8 text-center">
            <p className="text-[13px] font-['Poppins',sans-serif] text-gray-600 mb-12">
              Created by
            </p>
            <p className="text-[14px] font-semibold font-['Poppins',sans-serif] text-emerald-600">
              {purchaseOrder.createdBy || 'admin'}
            </p>
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
          <div className="flex gap-3">
            {onViewItems && (
              <button
                onClick={() => {
                  onViewItems(purchaseOrder);
                  onClose();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-[13px] font-['Poppins',sans-serif] font-medium transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                View Items
              </button>
            )}
            <button
              onClick={handlePrintInvoice}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium transition-colors flex items-center gap-2"
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
    </div>
  );
};
