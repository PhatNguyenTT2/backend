import React from 'react';

export const POSPaymentModal = ({ isOpen, totals, onClose, onPayment }) => {
  if (!isOpen) return null;

  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-[20px] font-bold font-['Poppins',sans-serif] text-gray-900 mb-4">
          Payment
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
            onClick={() => onPayment('cash')}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors"
          >
            Cash Payment
          </button>
          <button
            onClick={() => onPayment('card')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors"
          >
            Card Payment
          </button>
          <button
            onClick={() => onPayment('ewallet')}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors"
          >
            E-Wallet
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
