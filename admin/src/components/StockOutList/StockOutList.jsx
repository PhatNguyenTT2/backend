import { useState, useRef, useEffect } from 'react';
import { InvoiceStockOutModal } from './InvoiceStockOutModal';
import { EditStockOutOrderModal } from './EditStockOutOrderModal';

const StockOutList = ({
  stockOutOrders = [],
  onSort,
  sortField,
  sortOrder,
  onRefresh,
  inventoryList = []
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

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
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 3V9M6 3L4 5M6 3L8 5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (sortOrder === 'asc') {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9V3M6 3L4 5M6 3L8 5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    } else {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 3V9M6 9L4 7M6 9L8 7" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
  };

  // Toggle dropdown with auto-position
  const toggleDropdown = (dropdownId, event) => {
    if (activeDropdown === dropdownId) {
      setActiveDropdown(null);
    } else {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const dropdownHeight = 130;
      const dropdownWidth = 192;

      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const fitsBelow = spaceBelow >= dropdownHeight;

      const spaceRight = viewportWidth - buttonRect.right;
      const fitsRight = spaceRight >= dropdownWidth;

      let topPosition;
      if (fitsBelow) {
        topPosition = buttonRect.bottom + 8;
      } else if (spaceAbove >= dropdownHeight) {
        topPosition = buttonRect.top - dropdownHeight - 8;
      } else {
        topPosition = Math.max(10, Math.min(buttonRect.bottom + 8, viewportHeight - dropdownHeight - 10));
      }

      let leftPosition;
      if (dropdownId.startsWith('status-')) {
        leftPosition = buttonRect.left;
      } else {
        leftPosition = fitsRight
          ? buttonRect.right - dropdownWidth
          : Math.max(10, viewportWidth - dropdownWidth - 10);
      }

      setDropdownPosition({
        top: topPosition,
        left: leftPosition
      });
      setActiveDropdown(dropdownId);
    }
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

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Format currency (VND)
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₫0';
    return `₫${amount.toLocaleString('vi-VN')}`;
  };

  // Status badge styles
  const getStatusStyles = (status) => {
    const map = {
      draft: 'bg-[#6b7280]',
      pending: 'bg-[#f59e0b]',
      approved: 'bg-[#3b82f6]',
      completed: 'bg-[#10b981]',
      cancelled: 'bg-[#ef4444]'
    };
    return map[(status || '').toLowerCase()] || 'bg-[#6b7280]';
  };

  // Reason badge
  const getReasonBadge = (reason) => {
    const labels = {
      sales: 'Sales',
      transfer: 'Transfer',
      damage: 'Damage',
      expired: 'Expired',
      return_to_supplier: 'Return',
      internal_use: 'Internal',
      other: 'Other'
    };
    return labels[reason] || reason;
  };

  // Handle View Details
  const handleViewDetails = (wo) => {
    setInvoiceModal(wo);
    setActiveDropdown(null);
  };

  // Handle Edit
  const handleEdit = (wo) => {
    // Only allow edit when status is draft or pending
    if (wo.status === 'cancelled' || wo.status === 'completed') {
      alert('Cannot edit stock out order. Cancelled or completed orders cannot be edited.');
      return;
    }

    setEditingOrder(wo);
    setEditModalOpen(true);
    setActiveDropdown(null);
  };

  // Handle Delete
  const handleDelete = async (wo) => {
    if (wo.status !== 'cancelled' && wo.status !== 'draft' && wo.status !== 'completed') {
      alert('Only draft, completed, or cancelled orders can be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete Stock Out Order ${wo.soNumber}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const stockOutOrderService = (await import('../../services/stockOutOrderService')).default;
      await stockOutOrderService.deleteStockOutOrder(wo._id || wo.id);
      alert('Stock out order deleted successfully');
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert(error.error || error.message || 'Failed to delete order');
    }
  };

  // Handle Status Change
  const handleStatusChange = async (wo, newStatus) => {
    if (updatingStatus) return;

    const oldStatus = wo.status;

    if (oldStatus === 'completed' || oldStatus === 'cancelled') {
      alert(`Cannot change status. Order is already ${oldStatus}.`);
      setActiveDropdown(null);
      return;
    }

    // Confirm critical status changes
    if (newStatus === 'completed') {
      const confirmed = window.confirm(
        `Are you sure you want to mark as completed Stock Out Order ${wo.soNumber}?\n\nThis will finalize the stock release and create inventory movements.`
      );

      if (!confirmed) {
        setActiveDropdown(null);
        return;
      }
    }

    if (newStatus === 'cancelled' && oldStatus === 'pending') {
      const confirmed = window.confirm(
        `Are you sure you want to cancel ${wo.soNumber}?\n\n⚠️ Warning: This order was already PENDING.`
      );

      if (!confirmed) {
        setActiveDropdown(null);
        return;
      }
    }

    setUpdatingStatus(true);
    setActiveDropdown(null);

    try {
      const stockOutOrderService = (await import('../../services/stockOutOrderService')).default;
      await stockOutOrderService.updateStockOutOrderStatus(wo._id || wo.id, newStatus);

      if (onRefresh) {
        await onRefresh();
      }

      alert(`Stock out order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert(error.error || error.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="overflow-x-auto rounded-lg">
        <div className="min-w-[1000px]">
          {/* Table Header */}
          <div className="flex items-center h-[34px] bg-gray-50 border-b border-gray-200">
            {/* ID Column - Sortable */}
            <div
              className="w-[140px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('soNumber')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center gap-1">
                ID
                {getSortIcon('soNumber')}
              </p>
            </div>

            {/*Date Column - Sortable */}
            <div
              className="w-[110px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('orderDate')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center gap-1">
                Date
                {getSortIcon('orderDate')}
              </p>
            </div>

            {/* Reason Column - Sortable */}
            <div
              className="w-[110px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('reason')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center gap-1">
                Reason
                {getSortIcon('reason')}
              </p>
            </div>

            {/* Total Column */}
            <div className="flex-1 min-w-[120px] px-3 flex items-center">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                Total
              </p>
            </div>

            {/* Completed Date Column - Sortable */}
            <div
              className="w-[120px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('completedDate')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center gap-1">
                Completed
                {getSortIcon('completedDate')}
              </p>
            </div>

            {/* Created By Column */}
            <div className="w-[130px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                Created By
              </p>
            </div>

            {/* Status Column - Sortable */}
            <div
              className="w-[120px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('status')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center gap-1">
                Status
                {getSortIcon('status')}
              </p>
            </div>

            {/* Actions Column */}
            <div className="w-[100px] px-3 flex items-center justify-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                Actions
              </p>
            </div>
          </div>

          {/* Table Body */}
          <div className="flex flex-col">
            {stockOutOrders.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif]">
                  No stock out orders found
                </p>
              </div>
            ) : (
              stockOutOrders.map((wo, index) => (
                <div
                  key={wo._id || wo.id}
                  className={`flex items-center h-[60px] hover:bg-gray-50 transition-colors ${index !== stockOutOrders.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                >
                  {/* SO Number */}
                  <div className="w-[140px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[12px] font-medium font-['Poppins',sans-serif] text-blue-600 leading-[20px] font-mono truncate">
                      {wo.soNumber}
                    </p>
                  </div>

                  {/* Order Date */}
                  <div className="w-[110px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatDate(wo.orderDate)}
                    </p>
                  </div>

                  {/* Reason */}
                  <div className="w-[110px] px-3 flex items-center flex-shrink-0">
                    <span className="text-[11px] font-normal font-['Poppins',sans-serif] bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {getReasonBadge(wo.reason)}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="flex-1 min-w-[120px] px-3 flex items-center">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatCurrency(wo.totalPrice || 0)}
                    </p>
                  </div>

                  {/* Completed Date */}
                  <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatDate(wo.completedDate)}
                    </p>
                  </div>

                  {/* Created By */}
                  <div className="w-[130px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                      {wo.createdBy?.fullName || wo.createdBy?.username || 'N/A'}
                    </p>
                  </div>

                  {/* Status - Dropdown */}
                  <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                    {(wo.status === 'draft' || wo.status === 'pending') ? (
                      <button
                        onClick={(e) => toggleDropdown(`status-${wo._id || wo.id}`, e)}
                        disabled={updatingStatus}
                        className={`${getStatusStyles(wo.status)} px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span className="text-[9px] font-bold font-['Poppins',sans-serif] text-white leading-[10px] uppercase">
                          {wo.status}
                        </span>
                        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L4 4L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ) : (
                      <div className={`${getStatusStyles(wo.status)} px-2 py-1 rounded inline-flex items-center`}>
                        <span className="text-[9px] font-bold font-['Poppins',sans-serif] text-white leading-[10px] uppercase">
                          {wo.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-[100px] px-3 flex items-center justify-center flex-shrink-0">
                    <button
                      onClick={(e) => toggleDropdown(`actions-${wo._id || wo.id}`, e)}
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
              ))
            )}
          </div>
        </div>
      </div>

      {/* Dropdown Menus */}
      {activeDropdown && (() => {
        const woId = activeDropdown.replace(/^(status|actions)-/, '');
        const wo = stockOutOrders.find(o => (o._id || o.id) === woId);
        if (!wo) return null;

        const isStatusDropdown = activeDropdown.startsWith('status-');
        const isActionsDropdown = activeDropdown.startsWith('actions-');

        // Render Status Dropdown
        if (isStatusDropdown) {
          // Define available status transitions based on current status
          let statusOptions = [];

          if (wo.status === 'draft') {
            statusOptions = [
              { value: 'draft', label: 'Draft', color: 'bg-[#6b7280]' },
              { value: 'pending', label: 'Pending', color: 'bg-[#f59e0b]' },
              { value: 'cancelled', label: 'Cancelled', color: 'bg-[#ef4444]' }
            ];
          } else if (wo.status === 'pending') {
            statusOptions = [
              { value: 'pending', label: 'Pending', color: 'bg-[#f59e0b]' },
              { value: 'completed', label: 'Completed', color: 'bg-[#10b981]' },
              { value: 'cancelled', label: 'Cancelled', color: 'bg-[#ef4444]' }
            ];
          }

          const availableOptions = statusOptions;

          return (
            <div
              ref={dropdownRef}
              className="fixed min-w-[140px] bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`
              }}
            >
              {availableOptions.map((option) => {
                const isCurrentStatus = wo.status === option.value;

                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      if (!isCurrentStatus) {
                        handleStatusChange(wo, option.value);
                      }
                    }}
                    disabled={updatingStatus || isCurrentStatus}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isCurrentStatus ? 'bg-gray-50' : ''
                      }`}
                  >
                    <span className={`${option.color} w-2 h-2 rounded-full`}></span>
                    <span className={`text-[12px] font-['Poppins',sans-serif] ${isCurrentStatus ? 'text-emerald-600 font-semibold' : 'text-[#212529]'
                      }`}>
                      {option.label}
                    </span>
                    {isCurrentStatus && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-auto">
                        <path d="M10 3L4.5 8.5L2 6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          );
        }

        // Render Actions Dropdown
        if (isActionsDropdown) {
          const canDelete = wo.status === 'cancelled' || wo.status === 'draft' || wo.status === 'completed';

          return (
            <div
              ref={dropdownRef}
              className="fixed w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`
              }}
            >
              <button
                onClick={() => handleViewDetails(wo)}
                className="w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 8C1 8 3 3 8 3C13 3 15 8 15 8C15 8 13 13 8 13C3 13 1 8 1 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                View Invoice
              </button>

              {/* Edit Button */}
              <button
                onClick={() => handleEdit(wo)}
                disabled={wo.status === 'cancelled' || wo.status === 'completed'}
                className={`w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] transition-colors flex items-center gap-2 ${wo.status === 'cancelled' || wo.status === 'completed'
                    ? 'text-gray-400 cursor-not-allowed opacity-50'
                    : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                title={
                  wo.status === 'cancelled' || wo.status === 'completed'
                    ? 'Cannot edit cancelled or completed orders'
                    : 'Edit stock out order'
                }
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.5 2.5L13.5 4.5M2 14L4 13.5L13 4.5L11 2.5L2 11.5L1.5 14H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Edit
              </button>

              <div className="border-t border-gray-200 my-1"></div>

              <button
                onClick={() => {
                  handleDelete(wo);
                  setActiveDropdown(null);
                }}
                disabled={!canDelete}
                className={`w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] transition-colors flex items-center gap-2 ${canDelete
                  ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                  : 'text-gray-400 cursor-not-allowed opacity-50'
                  }`}
                title={
                  canDelete
                    ? 'Delete stock out order'
                    : 'Only draft, completed, or cancelled orders can be deleted'
                }
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H3.33333H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.33301 4.00004V2.66671C5.33301 2.31309 5.47348 1.97395 5.72353 1.7239C5.97358 1.47385 6.31272 1.33337 6.66634 1.33337H9.33301C9.68663 1.33337 10.0258 1.47385 10.2758 1.7239C10.5259 1.97395 10.6663 2.31309 10.6663 2.66671V4.00004M12.6663 4.00004V13.3334C12.6663 13.687 12.5259 14.0261 12.2758 14.2762C12.0258 14.5262 11.6866 14.6667 11.333 14.6667H4.66634C4.31272 14.6667 3.97358 14.5262 3.72353 14.2762C3.47348 14.0261 3.33301 13.687 3.33301 13.3334V4.00004H12.6663Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Delete
              </button>
            </div>
          );
        }

        return null;
      })()}

      {/* Invoice Modal */}
      {invoiceModal && (
        <InvoiceStockOutModal
          stockOutOrder={invoiceModal}
          onClose={() => setInvoiceModal(null)}
        />
      )}

      {/* Edit Stock Out Order Modal */}
      {editModalOpen && editingOrder && (
        <EditStockOutOrderModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingOrder(null);
          }}
          onSuccess={() => {
            setEditModalOpen(false);
            setEditingOrder(null);
            if (onRefresh) onRefresh();
          }}
          stockOutOrder={editingOrder}
          inventoryList={inventoryList}
        />
      )}
    </div>
  );
};

export default StockOutList;
