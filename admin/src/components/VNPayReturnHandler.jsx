import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import vnpayService from '../services/vnpayService';
import orderService from '../services/orderService';
import posLoginService from '../services/posLoginService';

export const VNPayReturnHandler = ({ onPaymentComplete, onPaymentFailed }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Đang xử lý thanh toán...');
  const [processed, setProcessed] = useState(false); // Prevent re-processing

  useEffect(() => {
    const handleVNPayReturn = async () => {
      const paymentStatus = searchParams.get('payment');
      const vnpTxnRef = searchParams.get('ref');
      const errorCode = searchParams.get('code');
      const errorMessage = searchParams.get('message');

      // Skip if not VNPay return or already processed
      if (!paymentStatus || processed) return;

      // Mark as processed to prevent infinite loop
      setProcessed(true);
      setProcessing(true);

      try {
        if (paymentStatus === 'success' && vnpTxnRef) {
          // Payment success - fetch order from VNPay record
          setStatusMessage('Thanh toán thành công! Đang tải thông tin đơn hàng...');

          // Get VNPay transaction to find orderId
          const vnpayRecord = await vnpayService.checkPaymentStatus(vnpTxnRef);

          if (!vnpayRecord || !vnpayRecord.orderId) {
            throw new Error('Không tìm thấy thông tin đơn hàng');
          }

          // CRITICAL: Extract orderId correctly (handle both populated and non-populated)
          let orderId;
          if (typeof vnpayRecord.orderId === 'object' && vnpayRecord.orderId !== null) {
            orderId = vnpayRecord.orderId._id || vnpayRecord.orderId.id;
          } else {
            orderId = vnpayRecord.orderId;
          }

          console.log('📝 Fetching order:', orderId);

          // Fetch complete order with all details
          const orderResponse = await orderService.getOrderById(orderId);

          if (!orderResponse.success) {
            throw new Error('Không thể tải thông tin đơn hàng');
          }

          const completeOrder = orderResponse.data.order;

          setStatusMessage('Thanh toán hoàn tất!');

          // Clear URL params BEFORE calling parent handler
          setSearchParams({});

          // Call parent handler to show invoice
          if (onPaymentComplete) {
            onPaymentComplete(completeOrder);
          }

        } else {
          // Payment failed
          const message = errorMessage
            ? decodeURIComponent(errorMessage)
            : 'Thanh toán thất bại';

          setStatusMessage(message);

          if (onPaymentFailed) {
            onPaymentFailed({ code: errorCode, message });
          }

          // Clear URL params after 3 seconds
          setTimeout(() => {
            setSearchParams({});
          }, 3000);
        }
      } catch (error) {
        console.error('VNPay return handler error:', error);
        setStatusMessage(error.message || 'Có lỗi xảy ra');

        if (onPaymentFailed) {
          onPaymentFailed({ message: error.message });
        }

        // Clear URL params after 3 seconds
        setTimeout(() => {
          setSearchParams({});
        }, 3000);
      } finally {
        setProcessing(false);
      }
    };

    handleVNPayReturn();
  }, [searchParams]); // Only depend on searchParams, not on callbacks

  if (!processing && !searchParams.get('payment')) {
    return null; // Don't render if not processing VNPay return
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center">
          {processing ? (
            <>
              <svg className="animate-spin h-16 w-16 text-blue-600 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Đang xử lý thanh toán</h3>
              <p className="text-gray-600 text-center">{statusMessage}</p>
            </>
          ) : (
            <>
              {searchParams.get('payment') === 'success' ? (
                <svg className="w-16 h-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {searchParams.get('payment') === 'success' ? 'Hoàn tất!' : 'Thất bại'}
              </h3>
              <p className="text-gray-600 text-center">{statusMessage}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
