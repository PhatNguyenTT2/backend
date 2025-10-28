import { useState, useRef, useEffect } from 'react';

const PaymentList = ({
  payments = [],
  onStatusChange,
  onSort,
  sortField,
  sortOrder,
  onRefund
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const [refundModal, setRefundModal] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Handle sort click
  const handleSortClick = (field) => {
    if (onSort) {
      onSort(field);
    }
  };

  // Get sort icon with color
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1">
          <path d="M6 3V9M6 3L4 5M6 3L8 5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (sortOrder === 'asc') {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1">
          <path d="M6 9V3M6 3L4 5M6 3L8 5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    } else {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1">
          <path d="M6 3V9M6 9L4 7M6 9L8 7" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
  };

  // Toggle dropdown
  const toggleDropdown = (dropdownId, event) => {
    if (activeDropdown === dropdownId) {
      setActiveDropdown(null);
    } else {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      let leftPosition;

      if (dropdownId.startsWith('status-') || dropdownId.startsWith('type-') || dropdownId.startsWith('method-')) {
        leftPosition = buttonRect.left;
      } else {
        leftPosition = buttonRect.right - 160;
      }

      setDropdownPosition({
        top: buttonRect.bottom + 4,
        left: leftPosition
      });
      setActiveDropdown(dropdownId);
    }
  };

  // Handle status change
  const handleStatusChange = (paymentId, newStatus) => {
    if (onStatusChange) {
      onStatusChange(paymentId, newStatus);
    }
    setActiveDropdown(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);

  // Get status badge styling
  const getStatusStyles = (status) => {
    const statusMap = {
      pending: 'bg-[#fbbf24]',    // Yellow
      completed: 'bg-[#10b981]',  // Green
      failed: 'bg-[#ef4444]',     // Red
      refunded: 'bg-[#f59e0b]',   // Orange
    };
    return statusMap[status?.toLowerCase()] || 'bg-gray-500';
  };

  // Status options for dropdown (refunded is not manually selectable)
  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'bg-[#fbbf24]' },
    { value: 'completed', label: 'Completed', color: 'bg-[#10b981]' },
    { value: 'failed', label: 'Failed', color: 'bg-[#ef4444]' },
    // Note: 'refunded' status is set automatically via the refund process, not manually
  ];

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format payment method display
  const formatPaymentMethod = (method) => {
    if (!method) return 'N/A';
    // Replace all underscores with spaces and capitalize each word
    return method.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Payment method options
  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'e_wallet', label: 'E-Wallet' },
    { value: 'check', label: 'Check' },
    { value: 'credit', label: 'Credit' }
  ];

  // Handle payment method change
  const handlePaymentMethodChange = async (payment, newMethod) => {
    if (payment.paymentMethod === newMethod) {
      setActiveDropdown(null);
      return;
    }

    try {
      console.log('Updating payment method:', payment.id, newMethod);

      // Import paymentService dynamically
      const { default: paymentService } = await import('../../services/paymentService');

      await paymentService.updatePaymentMethod(payment.id, newMethod);

      alert(`Payment method updated to ${newMethod.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')} successfully`);

      setActiveDropdown(null);

      // Trigger refresh if callback provided
      if (onStatusChange) {
        window.location.reload(); // Simple refresh for now
      }
    } catch (error) {
      console.error('Error updating payment method:', error);
      alert(error.error || error.message || 'Failed to update payment method');
    }
  };

  // Action handlers
  const handleDelete = (payment) => {
    if (payment.status === 'pending') {
      alert('Pending payments cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete payment ${payment.paymentNumber}?\n\nThis action cannot be undone.`
    );

    if (confirmed) {
      console.log('Delete payment:', payment);
      // TODO: Call API to delete payment
    }
  };

  const handleEdit = (payment) => {
    console.log('Edit payment:', payment);
    // TODO: Open edit modal
  };

  const handleRefund = (payment) => {
    if (payment.status !== 'completed') {
      alert('Only completed payments can be refunded.');
      return;
    }

    console.log('Refund payment:', payment);
    setRefundModal(payment);
    setRefundAmount(payment.amount.toString());
    setRefundReason('');
  };

  const handleRefundSubmit = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      alert('Please enter a valid refund amount');
      return;
    }

    if (!refundReason.trim()) {
      alert('Please provide a refund reason');
      return;
    }

    if (onRefund) {
      await onRefund(refundModal.id, parseFloat(refundAmount), refundReason);
    }

    setRefundModal(null);
    setRefundAmount('');
    setRefundReason('');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Scrollable Container */}
      <div className="overflow-x-auto rounded-lg">
        <div className="min-w-[1200px]">
          {/* Table Header */}
          <div className="flex items-center h-[34px] bg-gray-50 border-b border-gray-200">
            {/* ID Column - Sortable */}
            <div
              className="w-[140px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('paymentNumber')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                ID
                {getSortIcon('paymentNumber')}
              </p>
            </div>

            {/* Type Column */}
            <div className="w-[110px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                TYPE
              </p>
            </div>

            {/* Related Order Column - Sortable */}
            <div
              className="w-[150px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('relatedOrder')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                ORDER #
                {getSortIcon('relatedOrder')}
              </p>
            </div>

            {/* Amount Column - Sortable */}
            <div
              className="w-[130px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('amount')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                AMOUNT
                {getSortIcon('amount')}
              </p>
            </div>

            {/* Payment Method Column */}
            <div className="w-[160px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                METHOD
              </p>
            </div>

            {/* Date Column - Sortable */}
            <div
              className="w-[130px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('date')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                DATE
                {getSortIcon('date')}
              </p>
            </div>

            {/* Status Column */}
            <div className="w-[130px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                STATUS
              </p>
            </div>

            {/* Received By Column */}
            <div className="flex-1 min-w-[150px] px-3 flex items-center">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                RECEIVED BY
              </p>
            </div>

            {/* Actions Column */}
            <div className="w-[100px] px-3 flex items-center justify-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                ACTIONS
              </p>
            </div>
          </div>

          {/* Table Body */}
          <div className="flex flex-col">
            {payments.map((payment, index) => {
              const statusDropdownId = `status-${payment.id}`;

              return (
                <div
                  key={payment.id}
                  className={`flex items-center h-[60px] hover:bg-gray-50 transition-colors ${index !== payments.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                >
                  {/* ID */}
                  <div className="w-[140px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-emerald-600 leading-[20px]">
                      {payment.paymentNumber}
                    </p>
                  </div>

                  {/* Type */}
                  <div className="w-[110px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] capitalize">
                      {payment.type}
                    </p>
                  </div>

                  {/* Related Order */}
                  <div className="w-[150px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {payment.relatedOrderNumber}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="w-[130px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>

                  {/* Payment Method - Dropdown (Always editable) */}
                  <div className="w-[160px] px-3 flex items-center flex-shrink-0">
                    <button
                      onClick={(e) => toggleDropdown(`method-${payment.id}`, e)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors inline-flex items-center gap-1 text-left w-full"
                    >
                      <span className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] flex-1 truncate">
                        {formatPaymentMethod(payment.paymentMethod)}
                      </span>
                      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                        <path d="M1 1L4 4L7 1" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>

                  {/* Date */}
                  <div className="w-[130px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatDate(payment.date)}
                    </p>
                  </div>

                  {/* Status Badge with Dropdown */}
                  <div className="w-[130px] px-3 flex items-center flex-shrink-0">
                    {payment.status === 'pending' ? (
                      <button
                        onClick={(e) => toggleDropdown(statusDropdownId, e)}
                        className={`${getStatusStyles(payment.status)} px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity`}
                      >
                        <span className="text-[9px] font-bold font-['Poppins',sans-serif] text-white leading-[10px] uppercase">
                          {payment.status}
                        </span>
                        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L4 4L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ) : (
                      <div className={`${getStatusStyles(payment.status)} px-2 py-1 rounded inline-flex items-center`}>
                        <span className="text-[9px] font-bold font-['Poppins',sans-serif] text-white leading-[10px] uppercase">
                          {payment.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Received By */}
                  <div className="flex-1 min-w-[150px] px-3 flex items-center">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                      {payment.receivedBy}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="w-[100px] px-3 flex items-center justify-center flex-shrink-0">
                    <button
                      onClick={(e) => toggleDropdown(`action-${payment.id}`, e)}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      title="Actions"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="3" cy="8" r="1.5" fill="#6B7280" />
                        <circle cx="8" cy="8" r="1.5" fill="#6B7280" />
                        <circle cx="13" cy="8" r="1.5" fill="#6B7280" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {payments.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif]">
                No payments found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Position Dropdown Menus */}
      {activeDropdown && (() => {
        const payment = payments.find(p =>
          activeDropdown === `status-${p.id}` ||
          activeDropdown === `method-${p.id}` ||
          activeDropdown === `action-${p.id}`
        );

        if (!payment) return null;

        const isStatus = activeDropdown === `status-${payment.id}`;
        const isMethod = activeDropdown === `method-${payment.id}`;
        const isAction = activeDropdown === `action-${payment.id}`;

        // Status Dropdown
        if (isStatus) {
          return (
            <div
              ref={dropdownRef}
              className="fixed min-w-[140px] bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`
              }}
            >
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(payment.id, option.value)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${payment.status === option.value ? 'bg-gray-50' : ''
                    }`}
                >
                  <span className={`${option.color} w-2 h-2 rounded-full`}></span>
                  <span className={`text-[12px] font-['Poppins',sans-serif] ${payment.status === option.value ? 'text-emerald-600 font-semibold' : 'text-[#212529]'
                    }`}>
                    {option.label}
                  </span>
                  {payment.status === option.value && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-auto">
                      <path d="M10 3L4.5 8.5L2 6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          );
        }

        // Payment Method Dropdown
        if (isMethod) {
          return (
            <div
              ref={dropdownRef}
              className="fixed min-w-[160px] bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`
              }}
            >
              {paymentMethodOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handlePaymentMethodChange(payment, option.value)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${payment.paymentMethod === option.value ? 'bg-gray-50' : ''
                    }`}
                >
                  <span className={`text-[12px] font-['Poppins',sans-serif] ${payment.paymentMethod === option.value ? 'text-emerald-600 font-semibold' : 'text-[#212529]'
                    }`}>
                    {option.label}
                  </span>
                  {payment.paymentMethod === option.value && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-auto">
                      <path d="M10 3L4.5 8.5L2 6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          );
        }

        // Actions Dropdown
        if (isAction) {
          return (
            <div
              ref={dropdownRef}
              className="fixed w-[160px] bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`
              }}
            >
              {/* Process Refund - Always show, but disabled for non-completed */}
              <button
                onClick={() => {
                  handleRefund(payment);
                  setActiveDropdown(null);
                }}
                disabled={payment.status !== 'completed'}
                className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${payment.status !== 'completed'
                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                  : 'hover:bg-amber-50 hover:text-amber-600 text-gray-700'
                  }`}
                title={payment.status !== 'completed' ? 'Only completed payments can be refunded' : 'Process refund'}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 14A6 6 0 108 2a6 6 0 000 12z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 8H6M8 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-[12px] font-['Poppins',sans-serif]">Process Refund</span>
              </button>

              {/* Delete - Always show, but disabled for pending */}
              <div className="border-t border-gray-200 my-1"></div>

              <button
                onClick={() => {
                  handleDelete(payment);
                  setActiveDropdown(null);
                }}
                disabled={payment.status === 'pending'}
                className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${payment.status === 'pending'
                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                  : 'hover:bg-red-50 hover:text-red-600 text-gray-700'
                  }`}
                title={payment.status === 'pending' ? 'Pending payments cannot be deleted' : 'Delete payment'}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H3.33333H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.33301 4.00004V2.66671C5.33301 2.31309 5.47348 1.97395 5.72353 1.7239C5.97358 1.47385 6.31272 1.33337 6.66634 1.33337H9.33301C9.68663 1.33337 10.0258 1.47385 10.2758 1.7239C10.5259 1.97395 10.6663 2.31309 10.6663 2.66671V4.00004M12.6663 4.00004V13.3334C12.6663 13.687 12.5259 14.0261 12.2758 14.2762C12.0258 14.5262 11.6866 14.6667 11.333 14.6667H4.66634C4.31272 14.6667 3.97358 14.5262 3.72353 14.2762C3.47348 14.0261 3.33301 13.687 3.33301 13.3334V4.00004H12.6663Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[12px] font-['Poppins',sans-serif]">Delete</span>
              </button>
            </div>
          );
        }

        return null;
      })()}

      {/* Refund Modal */}
      {refundModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
          onClick={() => setRefundModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-[18px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Process Refund
              </h3>
              <button
                onClick={() => setRefundModal(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 5L5 15M5 5L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-[13px] font-['Poppins',sans-serif] text-yellow-800">
                  <span className="font-semibold">Warning:</span> This will restore inventory and update stock levels.
                </p>
              </div>

              <div>
                <p className="text-[13px] font-['Poppins',sans-serif] text-gray-700 mb-2">
                  <span className="font-semibold">Payment:</span> {refundModal.paymentNumber}
                </p>
                <p className="text-[13px] font-['Poppins',sans-serif] text-gray-700">
                  <span className="font-semibold">Order:</span> {refundModal.relatedOrderNumber}
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                  Refund Amount *
                </label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  min="0"
                  max={refundModal.amount}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter refund amount"
                />
                <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif] mt-1">
                  Maximum: ${refundModal.amount.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-gray-700 mb-2">
                  Reason *
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter reason for refund (e.g., Customer request, Damaged product, Wrong item)"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setRefundModal(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-[13px] font-['Poppins',sans-serif] font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundSubmit}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-[13px] font-['Poppins',sans-serif] font-medium transition-colors"
              >
                Process Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentList;
