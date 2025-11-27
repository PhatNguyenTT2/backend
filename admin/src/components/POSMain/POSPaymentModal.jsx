import React, { useState } from 'react';

export const POSPaymentModal = ({ isOpen, totals, onClose, onPaymentMethodSelect, onPaymentConfirm }) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  if (!isOpen) return null;

  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const handleMethodSelect = async (method) => {
    setProcessing(true);
    try {
      // Call parent to create order
      const result = await onPaymentMethodSelect(method);

      if (result && result.order) {
        setSelectedMethod(method);
        setCreatedOrder(result.order);
        setShowConfirmation(true);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      // Error already shown by parent
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      // Call parent to create payment and show invoice
      await onPaymentConfirm(selectedMethod, createdOrder);
      // Reset state
      setSelectedMethod(null);
      setCreatedOrder(null);
      setShowConfirmation(false);
    } catch (error) {
      console.error('Payment error:', error);
      // Error already shown by parent
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelConfirmation = () => {
    setSelectedMethod(null);
    setShowConfirmation(false);
  };

  const getMethodLabel = (method) => {
    const labels = {
      cash: 'Cash Payment',
      card: 'Card Payment',
      bank_transfer: 'Bank Transfer'
    };
    return labels[method] || method;
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" strokeWidth="2" />
          </svg>
        );
      case 'card':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
            <path d="M2 10h20" strokeWidth="2" />
          </svg>
        );
      case 'bank_transfer':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2" />
            <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Show confirmation screen
  if (showConfirmation) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
              {getMethodIcon(selectedMethod)}
            </div>
            <h2 className="text-[20px] font-bold font-['Poppins',sans-serif] text-gray-900 mb-2">
              Confirm Payment
            </h2>
            <p className="text-[14px] font-['Poppins',sans-serif] text-gray-600">
              {getMethodLabel(selectedMethod)}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[13px] font-['Poppins',sans-serif] text-gray-600">Subtotal:</span>
              <span className="text-[14px] font-semibold font-['Poppins',sans-serif]">
                {formatVND(totals.subtotal)}
              </span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-['Poppins',sans-serif] text-gray-600">
                  Discount ({totals.discountPercentage}%):
                </span>
                <span className="text-[14px] font-semibold font-['Poppins',sans-serif] text-green-600">
                  -{formatVND(totals.discount)}
                </span>
              </div>
            )}
            {totals.shippingFee > 0 && (
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-['Poppins',sans-serif] text-gray-600">Shipping:</span>
                <span className="text-[14px] font-semibold font-['Poppins',sans-serif]">
                  {formatVND(totals.shippingFee)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="text-[16px] font-bold font-['Poppins',sans-serif] text-gray-900">Total:</span>
              <span className="text-[24px] font-bold font-['Poppins',sans-serif] text-emerald-600">
                {formatVND(totals.total)}
              </span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-[12px] font-['Poppins',sans-serif] text-blue-800">
              <strong>Note:</strong> Clicking "Confirm" will create a payment record and complete this order.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancelConfirmation}
              disabled={processing}
              className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={processing}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                'Confirm Payment'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show payment method selection
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-[20px] font-bold font-['Poppins',sans-serif] text-gray-900 mb-4">
          Select Payment Method
        </h2>

        <div className="mb-6">
          <p className="text-[14px] font-['Poppins',sans-serif] text-gray-600 mb-2">
            Total Amount:
          </p>
          <p className="text-[32px] font-bold font-['Poppins',sans-serif] text-emerald-600">
            {formatVND(totals.total)}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleMethodSelect('cash')}
            disabled={processing}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Order...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
                  <circle cx="12" cy="12" r="3" strokeWidth="2" />
                </svg>
                Cash Payment
              </>
            )}
          </button>
          <button
            onClick={() => handleMethodSelect('card')}
            disabled={processing}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Order...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
                  <path d="M2 10h20" strokeWidth="2" />
                </svg>
                Card Payment
              </>
            )}
          </button>
          <button
            onClick={() => handleMethodSelect('bank_transfer')}
            disabled={processing}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Order...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2" />
                  <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2" />
                </svg>
                Bank Transfer
              </>
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
