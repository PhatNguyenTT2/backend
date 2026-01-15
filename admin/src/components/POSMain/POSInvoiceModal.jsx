import React, { useState, useEffect } from 'react';
import orderService from '../../services/orderService';
import orderDetailService from '../../services/orderDetailService';

/**
 * POSInvoiceModal Component
 * Hiển thị hóa đơn của order vừa tạo trong POS
 * 
 * Workflow mới (POS direct sale):
 * - Order tạo với status = 'draft'
 * - Sau thanh toán, tự động chuyển thành 'delivered'
 * - Không cần confirm delivery thủ công
 * 
 * Flow:
 * 1. Nhận order từ props
 * 2. Fetch order details từ orderDetailService.getDetailsByOrder()
 * 3. Hiển thị invoice với đầy đủ thông tin
 * 4. Cho phép in hóa đơn
 * 5. Button "Confirm Delivery" chỉ hiện với held orders (nếu còn pending)
 * 6. Callback onComplete để clear cart và đóng modal
 */
export const POSInvoiceModal = ({ isOpen, order, orderDetails: propsOrderDetails, onClose, onComplete }) => {
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [orderDetails, setOrderDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch order details when order changes
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!order || !isOpen) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('📥 Fetching order details for:', order.orderNumber || order.id);

        // Try to fetch order details from API
        const detailsResponse = await orderDetailService.getDetailsByOrder(order.id || order._id);
        console.log('📥 Order details response:', detailsResponse);

        let detailsData = [];
        if (detailsResponse.success && detailsResponse.data && detailsResponse.data.orderDetails) {
          detailsData = detailsResponse.data.orderDetails;
        } else if (Array.isArray(detailsResponse.data)) {
          detailsData = detailsResponse.data;
        } else if (Array.isArray(detailsResponse)) {
          detailsData = detailsResponse;
        } else if (order.details && Array.isArray(order.details)) {
          // Fallback to order.details if API call fails
          detailsData = order.details;
        } else if (propsOrderDetails && Array.isArray(propsOrderDetails)) {
          // Fallback to props if all else fails
          detailsData = propsOrderDetails;
        }

        console.log('✅ Order details loaded:', detailsData.length, 'items');
        setOrderDetails(detailsData);
      } catch (error) {
        console.error('❌ Error fetching order details:', error);
        // Fallback to order.details or props
        const fallbackDetails = order.details || propsOrderDetails || [];
        console.log('⚠️ Using fallback details:', fallbackDetails.length, 'items');
        setOrderDetails(fallbackDetails);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [order, isOpen, propsOrderDetails]);

  if (!isOpen || !order) return null;

  // Show loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-[14px] font-['Poppins',sans-serif] text-gray-600">Loading invoice...</p>
          </div>
        </div>
      </div>
    );
  }

  // Format currency VND
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Handle print invoice
  const handlePrintInvoice = () => {
    const printContent = document.getElementById('pos-invoice-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${order.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            .text-right { text-align: right; }
            .text-center { text-center; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Handle confirm delivery
  const handleConfirmDelivery = async () => {
    const confirm = window.confirm(
      'Confirm that this order has been delivered to the customer?\n\nThis will change the order status to Delivered.'
    );

    if (!confirm) return;

    setConfirmingDelivery(true);
    try {
      // Update order status to delivered
      await orderService.updateOrder(order.id, {
        status: 'delivered'
      });

      // Call onComplete to clear cart and close modal
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('❌ Error confirming delivery:', error);
      alert('Failed to confirm delivery. Please try again.');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  // Calculate totals from orderDetails
  // Use fetched orderDetails state instead of order.details
  const details = orderDetails || [];
  const subtotal = details.reduce((sum, detail) => {
    const quantity = parseFloat(detail.quantity) || 0;
    const unitPrice = parseFloat(detail.unitPrice) || 0;
    return sum + (quantity * unitPrice);
  }, 0);

  const discountPercentage = parseFloat(order.discountPercentage) || 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  const shippingFee = parseFloat(order.shippingFee) || 0;
  const total = parseFloat(order.total) || (subtotal - discountAmount + shippingFee);

  console.log('💰 Invoice totals:', {
    detailsCount: details.length,
    subtotal,
    discountPercentage,
    discountAmount,
    shippingFee,
    total
  });

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          // Prevent closing if order is still pending (held order not delivered yet)
          if (order.status === 'pending') {
            alert('Please confirm delivery or cancel the order before closing.');
            return;
          }
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-500 to-emerald-600">
          <h3 className="text-[20px] font-bold font-['Poppins',sans-serif] text-white">
            Order Invoice
          </h3>
          <button
            onClick={() => {
              // Only block closing if order is pending (held order)
              if (order.status === 'pending') {
                alert('Please confirm delivery before closing.');
                return;
              }
              onClose();
            }}
            className="p-2 hover:bg-emerald-700 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Invoice Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-8 bg-white" id="pos-invoice-content">
          {/* Title */}
          <div className="text-center mb-6 border-b-2 border-emerald-600 pb-4">
            <h1 className="text-[28px] font-bold font-['Poppins',sans-serif] text-emerald-600 uppercase tracking-wider">
              SALES INVOICE
            </h1>
            <p className="text-[13px] font-['Poppins',sans-serif] text-gray-600 mt-2">
              Thank you for your purchase!
            </p>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-[13px]">
            <div>
              <p className="font-['Poppins',sans-serif]">
                <span className="font-semibold text-emerald-600">Order Number:</span>
                <span className="ml-2 text-gray-900">{order.orderNumber}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-['Poppins',sans-serif]">
                <span className="font-semibold text-emerald-600">Date:</span>
                <span className="ml-2 text-gray-900">{formatDate(order.orderDate)}</span>
              </p>
              <p className="font-['Poppins',sans-serif] text-gray-600 mt-1">
                {formatTime(order.orderDate)}
              </p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <p className="text-[14px] font-semibold font-['Poppins',sans-serif] text-emerald-600 mb-3">
              Customer Information
            </p>
            <div className="space-y-2 text-[13px]">
              <p className="font-['Poppins',sans-serif]">
                <span className="font-semibold text-gray-700">Name:</span>
                <span className="ml-2 text-gray-900">{order.customer?.fullName || 'Walk-in Customer'}</span>
              </p>
              {order.customer?.phone && (
                <p className="font-['Poppins',sans-serif]">
                  <span className="font-semibold text-gray-700">Phone:</span>
                  <span className="ml-2 text-gray-900">{order.customer.phone}</span>
                </p>
              )}
              {order.customer?.customerType && (
                <p className="font-['Poppins',sans-serif]">
                  <span className="font-semibold text-gray-700">Type:</span>
                  <span className={`ml-2 capitalize font-medium ${order.customer.customerType === 'vip' ? 'text-purple-600' :
                    order.customer.customerType === 'wholesale' ? 'text-emerald-600' :
                      order.customer.customerType === 'retail' ? 'text-blue-600' :
                        'text-gray-600'
                    }`}>
                    {order.customer.customerType}
                  </span>
                </p>
              )}
              <p className="font-['Poppins',sans-serif]">
                <span className="font-semibold text-gray-700">Delivery:</span>
                <span className={`ml-2 capitalize ${order.deliveryType === 'delivery' ? 'text-emerald-600' : 'text-blue-600'
                  }`}>
                  {order.deliveryType === 'delivery' ? 'Home Delivery' : 'Pickup'}
                </span>
              </p>
              {order.deliveryType === 'delivery' && order.shippingAddress && (
                <p className="font-['Poppins',sans-serif]">
                  <span className="font-semibold text-gray-700">Address:</span>
                  <span className="ml-2 text-gray-900">{order.shippingAddress}</span>
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-emerald-50">
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-center">
                    No.
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-left">
                    Product Name
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-center">
                    Qty
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    Price
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-[12px] font-semibold font-['Poppins',sans-serif] text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {details && details.length > 0 ? (
                  details.map((detail, idx) => {
                    const quantity = parseFloat(detail.quantity) || 0;
                    const unitPrice = parseFloat(detail.unitPrice) || 0;
                    const amount = quantity * unitPrice;

                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 text-[12px] text-center">
                          {idx + 1}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] font-medium">
                          {detail.product?.name || 'Unknown Product'}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] text-center">
                          {quantity}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] text-right">
                          {formatCurrency(unitPrice)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-[12px] text-right font-medium">
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="border border-gray-300 px-3 py-4 text-center text-[12px] text-gray-500">
                      No items found
                    </td>
                  </tr>
                )}

                {/* Subtotal */}
                <tr className="bg-gray-50">
                  <td colSpan="4" className="border border-gray-300 px-3 py-2 text-[13px] font-semibold font-['Poppins',sans-serif] text-right">
                    Subtotal:
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[13px] font-semibold font-['Poppins',sans-serif] text-right">
                    {formatCurrency(subtotal)}
                  </td>
                </tr>

                {/* Discount */}
                {discountPercentage > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan="4" className="border border-gray-300 px-3 py-2 text-[13px] font-semibold font-['Poppins',sans-serif] text-right text-green-600">
                      Discount ({discountPercentage}%) - {order.customer?.customerType?.toUpperCase() || 'N/A'}:
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-[13px] font-semibold font-['Poppins',sans-serif] text-right text-green-600">
                      -{formatCurrency(discountAmount)}
                    </td>
                  </tr>
                )}

                {/* Shipping Fee */}
                <tr className="bg-gray-50">
                  <td colSpan="4" className="border border-gray-300 px-3 py-2 text-[13px] font-semibold font-['Poppins',sans-serif] text-right">
                    Shipping Fee:
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[13px] font-semibold font-['Poppins',sans-serif] text-right">
                    {shippingFee > 0 ? (
                      formatCurrency(shippingFee)
                    ) : (
                      <span className="text-green-600">FREE</span>
                    )}
                  </td>
                </tr>

                {/* Total */}
                <tr className="bg-emerald-50">
                  <td colSpan="4" className="border border-gray-300 px-3 py-2 text-[16px] font-bold font-['Poppins',sans-serif] text-right text-emerald-600">
                    TOTAL:
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-[16px] font-bold font-['Poppins',sans-serif] text-right text-emerald-600">
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Info */}
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex justify-between items-center text-[13px] font-['Poppins',sans-serif]">
              <span className="font-semibold text-emerald-800">Payment Method:</span>
              <span className="font-bold uppercase text-emerald-600">
                {order.paymentMethod === 'cash' ? 'CASH' :
                  order.paymentMethod === 'card' ? 'CARD' :
                    order.paymentMethod === 'bank_transfer' ? 'BANK TRANSFER' :
                      'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[13px] font-['Poppins',sans-serif] mt-2">
              <span className="font-semibold text-emerald-800">Payment Status:</span>
              <span className="font-bold uppercase text-emerald-600">
                {order.paymentStatus === 'paid' ? (
                  <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline mr-1 align-text-bottom"><path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>PAID</>
                ) : order.paymentStatus || 'N/A'}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="text-center mb-6">
            <span className={`inline-block px-6 py-2 rounded-full text-[14px] font-bold font-['Poppins',sans-serif] ${order.status === 'pending' ? 'bg-amber-100 text-amber-800' :
              order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
              Status: {order.status?.toUpperCase() || 'N/A'}
            </span>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center border-t border-gray-200 pt-6">
            <p className="text-[12px] font-['Poppins',sans-serif] text-gray-600">
              Thank you for your business!
            </p>
            <p className="text-[11px] font-['Poppins',sans-serif] text-gray-500 mt-2">
              Served by: {order.createdBy?.employeeName || 'POS System'}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center gap-3">
          <button
            onClick={handlePrintInvoice}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-[14px] font-['Poppins',sans-serif] font-semibold transition-colors flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="2" width="10" height="3" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2" y="5" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="4" y="9" width="8" height="5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Print Invoice
          </button>

          {order.status === 'pending' ? (
            <button
              onClick={handleConfirmDelivery}
              disabled={confirmingDelivery}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[14px] font-['Poppins',sans-serif] font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {confirmingDelivery ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Confirming...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 6L9 17L4 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Confirm Delivery
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                if (onComplete) onComplete();
              }}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[14px] font-['Poppins',sans-serif] font-semibold transition-colors"
            >
              Complete & Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
