import { useState, useRef, useEffect } from 'react';
import { EditPurchaseOrderModal } from './EditPurchaseOrderModal';
import { InvoicePurchaseModal } from './InvoicePurchaseModal';
import purchaseOrderService from '../../services/purchaseOrderService';
import inventoryService from '../../services/inventoryService';

const PurchaseOrderList = ({
  purchaseOrders = [],
  onSort,
  sortField,
  sortOrder,
  onRefresh
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  const [viewItemsModal, setViewItemsModal] = useState(null);
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

      // Status dropdown: align left
      if (dropdownId.startsWith('status-')) {
        leftPosition = buttonRect.left;
      } else {
        // Actions dropdown: align right
        leftPosition = buttonRect.right - 160;
      }

      setDropdownPosition({
        top: buttonRect.bottom + 4,
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

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // PO status badge styles
  const getStatusStyles = (status) => {
    const map = {
      pending: 'bg-[#f59e0b]',         // Orange - Pending
      approved: 'bg-[#3b82f6]',        // Blue - Approved
      received: 'bg-[#10b981]',        // Green - Received
      cancelled: 'bg-[#ef4444]'        // Red - Cancelled
    };
    return map[(status || '').toLowerCase()] || 'bg-[#6b7280]';
  };

  // Action handlers
  const handleEdit = (po) => {
    // Only allow edit when status is pending, approved, or received
    if (po.status === 'cancelled') {
      alert('Cannot edit purchase order. Cancelled purchase orders cannot be edited.');
      return;
    }

    setEditingPO(po);
    setEditModalOpen(true);
  };

  const handleDelete = async (po) => {
    // Only allow delete when status is cancelled or received
    if (po.status !== 'cancelled' && po.status !== 'received') {
      alert('Cannot delete purchase order. Only cancelled or received purchase orders can be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete Purchase Order ${po.poNumber}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await purchaseOrderService.deletePurchaseOrder(po.id);
      alert('Purchase order deleted successfully');
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      alert(error.error || error.message || 'Failed to delete purchase order');
    }
  };

  // Handle status change
  const handleStatusChange = async (po, newStatus) => {
    if (updatingStatus) return;

    const oldStatus = po.status;

    // Prevent changing status if already received or cancelled
    if (oldStatus === 'received' || oldStatus === 'cancelled') {
      alert(`Cannot change status. Purchase Order is already ${oldStatus}.`);
      setActiveDropdown(null);
      return;
    }

    // Confirm critical status changes
    if (newStatus === 'approved' || newStatus === 'received') {
      const action = newStatus === 'approved' ? 'approve' : 'mark as received';
      const confirmed = window.confirm(
        `Are you sure you want to ${action} Purchase Order ${po.poNumber}?${newStatus === 'approved' ? '\n\nThis will update inventory stock levels.' :
          newStatus === 'received' ? '\n\nThis will mark all items as received and update stock.' : ''
        }`
      );

      if (!confirmed) {
        setActiveDropdown(null);
        return;
      }
    }

    // Confirm cancellation of approved PO (inventory will be reversed)
    if (newStatus === 'cancelled' && oldStatus === 'approved') {
      const confirmed = window.confirm(
        `Are you sure you want to cancel Purchase Order ${po.poNumber}?\n\n⚠️ Warning: This PO was already APPROVED.\nInventory stock that was added will be REVERSED (removed).\n\nThis action cannot be undone.`
      );

      if (!confirmed) {
        setActiveDropdown(null);
        return;
      }
    }

    setUpdatingStatus(true);
    setActiveDropdown(null);

    try {
      // Update PO status using the correct endpoint
      const result = await purchaseOrderService.updatePurchaseOrderStatus(po.id, newStatus);
      console.log('Status update result:', result);

      // If status changed to approved or received, update inventory (stock in)
      if ((newStatus === 'approved' || newStatus === 'received') &&
        (oldStatus !== 'approved' && oldStatus !== 'received')) {

        console.log(`Status changed to ${newStatus}, stocking in inventory...`);

        // Stock in all items
        if (po.items && po.items.length > 0) {
          for (const item of po.items) {
            const productId = item.product?.id || item.product?._id || item.product;
            const quantity = item.quantity || 0;

            if (productId && quantity > 0) {
              try {
                await inventoryService.stockIn({
                  product: productId,
                  quantity: quantity,
                  referenceType: 'purchase_order',
                  referenceId: po.poNumber,
                  reason: `Purchase Order ${newStatus === 'approved' ? 'Approved' : 'Received'}: ${po.poNumber}`,
                  notes: `Auto stock-in when PO status changed to ${newStatus}`
                });
                console.log(`Stocked in ${quantity} units of product ${productId}`);
              } catch (stockError) {
                console.error(`Error stocking in product ${productId}:`, stockError);
              }
            }
          }
        }
      }

      // If status changed from approved to cancelled, reverse inventory (adjustment decrease)
      // This is similar to refund logic - restore inventory to previous state
      if (newStatus === 'cancelled' && oldStatus === 'approved') {
        console.log('Status changed from approved to cancelled, reversing inventory (adjustment decrease)...');

        // Reverse all items using adjustment (decrease) - same as refund logic
        if (po.items && po.items.length > 0) {
          for (const item of po.items) {
            const productId = item.product?.id || item.product?._id || item.product;
            const quantity = item.quantity || 0;

            if (productId && quantity > 0) {
              try {
                // Use adjustStock with 'decrease' to reverse the stock-in from approval
                await inventoryService.adjustStock(productId, {
                  type: 'adjustment',
                  quantity: quantity,
                  adjustmentType: 'decrease',
                  referenceType: 'stock_adjustment', // Valid enum value
                  referenceId: po.poNumber,
                  notes: `Reverse stock-in due to PO cancellation: ${po.poNumber} (was previously approved)`
                });
                console.log(`Adjusted stock down ${quantity} units of product ${productId} (reversed)`);
              } catch (adjustError) {
                console.error(`Error adjusting stock for product ${productId}:`, adjustError);
                console.error('Full error details:', JSON.stringify(adjustError, null, 2));
                // Continue with other items even if one fails
              }
            }
          }
          alert(`Purchase Order cancelled. Inventory has been reversed to previous state.`);
        }
      } else {
        alert(`Purchase Order status updated to ${newStatus}`);
      }

      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error updating purchase order status:', error);
      alert(error.error || error.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Scrollable Container */}
      <div className="overflow-x-auto rounded-lg">
        <div className="min-w-[1000px]">
          {/* Table Header */}
          <div className="flex items-center h-[34px] bg-gray-50 border-b border-gray-200">
            {/* ID Column - Sortable (displays poNumber) */}
            <div
              className="w-[100px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('poNumber')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                ID
                {getSortIcon('poNumber')}
              </p>
            </div>

            {/* Supplier Column - Sortable */}
            <div
              className="flex-1 min-w-[120px] px-3 flex items-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('supplier')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                SUPPLIER
                {getSortIcon('supplier')}
              </p>
            </div>

            {/* Items Column */}
            <div className="w-[80px] px-3 flex items-center justify-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                ITEMS
              </p>
            </div>

            {/* Total Column - Sortable */}
            <div
              className="w-[100px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('total')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                TOTAL
                {getSortIcon('total')}
              </p>
            </div>

            {/* Paid Amount Column */}
            <div className="w-[100px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                PAID
              </p>
            </div>

            {/* Order Date Column - Sortable */}
            <div
              className="w-[100px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('orderDate')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                DATE
                {getSortIcon('orderDate')}
              </p>
            </div>

            {/* Delivery Date Column - Sortable */}
            <div
              className="w-[100px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('expectedDeliveryDate')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                DELIVERY
                {getSortIcon('expectedDeliveryDate')}
              </p>
            </div>

            {/* Payment Status Column */}
            <div className="w-[100px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                STATUS
              </p>
            </div>

            {/* Created By Column */}
            <div className="w-[120px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                CREATED BY
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
            {purchaseOrders.map((po, index) => {
              return (
                <div
                  key={po.id}
                  className={`flex items-center h-[60px] hover:bg-gray-50 transition-colors ${index !== purchaseOrders.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                >
                  {/* PO Number */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-emerald-600 leading-[20px]">
                      {po.poNumber}
                    </p>
                  </div>

                  {/* Supplier */}
                  <div className="flex-1 min-w-[120px] px-3 flex items-center">
                    <div>
                      <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                        {po.supplierName}
                      </p>
                      {po.supplierCode && (
                        <p className="text-[11px] text-[#6c757d]">{po.supplierCode}</p>
                      )}
                    </div>
                  </div>

                  {/* Items - View Icon */}
                  <div className="w-[80px] px-3 flex items-center justify-center flex-shrink-0">
                    <button
                      onClick={() => setViewItemsModal(po)}
                      className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                      title="View items"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4H14M2 8H14M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span className="text-[13px] font-normal font-['Poppins',sans-serif]">
                        {po.itemCount || 0}
                      </span>
                    </button>
                  </div>

                  {/* Total */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatCurrency(po.total)}
                    </p>
                  </div>

                  {/* Paid Amount */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatCurrency(po.paidAmount)}
                    </p>
                  </div>

                  {/* Order Date */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatDate(po.orderDate)}
                    </p>
                  </div>

                  {/* Delivery Date */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatDate(po.expectedDeliveryDate)}
                    </p>
                  </div>

                  {/* PO Status - Dropdown */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    {(po.status === 'pending' || po.status === 'approved') ? (
                      <button
                        onClick={(e) => toggleDropdown(`status-${po.id}`, e)}
                        disabled={updatingStatus}
                        className={`${getStatusStyles(po.status)} px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span className="text-[9px] font-bold font-['Poppins',sans-serif] text-white leading-[10px] uppercase">
                          {po.status ? po.status.replace('_', ' ') : 'pending'}
                        </span>
                        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L4 4L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ) : (
                      <div className={`${getStatusStyles(po.status)} px-2 py-1 rounded inline-flex items-center`}>
                        <span className="text-[9px] font-bold font-['Poppins',sans-serif] text-white leading-[10px] uppercase">
                          {po.status ? po.status.replace('_', ' ') : 'pending'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Created By */}
                  <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[12px] font-['Poppins',sans-serif] text-[#6c757d] leading-[18px] truncate">
                      {po.createdBy || 'N/A'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="w-[100px] px-3 flex items-center justify-center flex-shrink-0">
                    <button
                      onClick={(e) => toggleDropdown(`action-${po.id}`, e)}
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
          {purchaseOrders.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif]">
                No purchase orders found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Position Dropdown Menus */}
      {activeDropdown && (() => {
        const po = purchaseOrders.find(p =>
          activeDropdown === `action-${p.id}` || activeDropdown === `status-${p.id}`
        );

        if (!po) return null;

        const isAction = activeDropdown === `action-${po.id}`;
        const isStatus = activeDropdown === `status-${po.id}`;

        // Status Dropdown
        if (isStatus) {
          const statusOptions = [
            { value: 'pending', label: 'Pending', color: 'bg-[#f59e0b]' },
            { value: 'approved', label: 'Approved', color: 'bg-[#3b82f6]' },
            { value: 'received', label: 'Received', color: 'bg-[#10b981]' },
            { value: 'cancelled', label: 'Cancelled', color: 'bg-[#ef4444]' }
          ];

          return (
            <div
              ref={dropdownRef}
              className="fixed min-w-[180px] bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`
              }}
            >
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(po, option.value)}
                  disabled={updatingStatus}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${po.status === option.value ? 'bg-gray-50' : ''
                    }`}
                >
                  <span className={`${option.color} w-2 h-2 rounded-full`}></span>
                  <span className={`text-[12px] font-['Poppins',sans-serif] ${po.status === option.value ? 'text-emerald-600 font-semibold' : 'text-[#212529]'
                    }`}>
                    {option.label}
                  </span>
                  {po.status === option.value && (
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
              <button
                onClick={() => {
                  setInvoiceModal(po);
                  setActiveDropdown(null);
                }}
                className="w-full px-3 py-2 text-left hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-2 text-gray-700"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 5H11M5 8H11M5 11H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-[12px] font-['Poppins',sans-serif]">View Invoice</span>
              </button>

              <button
                onClick={() => {
                  handleEdit(po);
                  setActiveDropdown(null);
                }}
                disabled={po.status === 'cancelled'}
                className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${po.status === 'cancelled'
                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                  : 'hover:bg-blue-50 hover:text-blue-600 text-gray-700'
                  }`}
                title={po.status === 'cancelled' ? 'Cancelled purchase orders cannot be edited' : 'Edit purchase order'}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <span className="text-[12px] font-['Poppins',sans-serif]">Edit</span>
              </button>

              <div className="border-t border-gray-200 my-1"></div>

              <button
                onClick={() => {
                  handleDelete(po);
                  setActiveDropdown(null);
                }}
                disabled={po.status !== 'cancelled' && po.status !== 'received'}
                className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${po.status !== 'cancelled' && po.status !== 'received'
                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                  : 'hover:bg-red-50 hover:text-red-600 text-gray-700'
                  }`}
                title={po.status !== 'cancelled' && po.status !== 'received' ? 'Only cancelled or received purchase orders can be deleted' : 'Delete purchase order'}
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

      {/* Items Modal */}
      {viewItemsModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
          onClick={() => setViewItemsModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                  Items in PO {viewItemsModal.poNumber}
                </h3>
                <p className="text-[12px] text-[#6c757d] mt-1">
                  Supplier: {viewItemsModal.supplierName}
                </p>
              </div>
              <button
                onClick={() => setViewItemsModal(null)}
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
                  {viewItemsModal.items && viewItemsModal.items.length > 0 ? (
                    viewItemsModal.items.map((item, idx) => (
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
                            {formatCurrency(item.unitPrice || 0)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                            {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
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
                  Total Items: {viewItemsModal.itemCount || 0}
                </div>
                <div className="text-[16px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                  Total Amount: {formatCurrency(viewItemsModal.total || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Purchase Modal */}
      {invoiceModal && (
        <InvoicePurchaseModal
          purchaseOrder={invoiceModal}
          onClose={() => setInvoiceModal(null)}
          onViewItems={(po) => {
            setViewItemsModal(po);
          }}
        />
      )}

      {/* Edit Purchase Order Modal */}
      <EditPurchaseOrderModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingPO(null);
        }}
        onSuccess={(updatedPO) => {
          console.log('Purchase order updated:', updatedPO);
          setEditModalOpen(false);
          setEditingPO(null);
          if (onRefresh) {
            onRefresh();
          }
        }}
        purchaseOrder={editingPO}
      />
    </div>
  );
};

export default PurchaseOrderList;
