import { useState, useRef, useEffect } from 'react';

const PurchaseOrderListHeader = ({
  itemsPerPage = 20,
  onItemsPerPageChange,
  searchQuery = '',
  onSearchChange,
  onSearch,
  statusFilter = 'all',
  onStatusFilterChange,
  paymentStatusFilter = 'all',
  onPaymentStatusFilterChange,
  supplierFilter = 'all',
  onSupplierFilterChange,
  suppliers = [],
  onAddClick
}) => {
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowActionsDropdown(false);
      }
    };

    if (showActionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsDropdown]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="flex items-center justify-between gap-3">
        {/* Title */}
        <div className="flex items-center">
          <h2 className="text-[13px] font-normal font-['Poppins',sans-serif] text-black leading-[20px] whitespace-nowrap">
            Purchase Orders
          </h2>
        </div>

        {/* Controls Container */}
        <div className="flex items-center gap-2 flex-1 ml-4">
          {/* Items Per Page Dropdown */}
          <div className="relative w-[80px]">
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange && onItemsPerPageChange(parseInt(e.target.value))}
              className="w-full h-[36px] bg-white border border-[#ced4da] rounded-lg px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-[#212529] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#212529" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex-1 max-w-[300px]">
            <div className="relative h-[36px]">
              <input
                type="text"
                placeholder="Search by PO Number, Supplier..."
                value={searchQuery}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                className="w-full h-full bg-white border border-[#ced4da] rounded-lg pl-3 pr-10 py-2 text-[12px] font-['Poppins',sans-serif] text-gray-900 placeholder:text-[#6c757d] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.5 11.5C9.26142 11.5 11.5 9.26142 11.5 6.5C11.5 3.73858 9.26142 1.5 6.5 1.5C3.73858 1.5 1.5 3.73858 1.5 6.5C1.5 9.26142 3.73858 11.5 6.5 11.5Z"
                    stroke="#6B7280"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12.5 12.5L10.5 10.5"
                    stroke="#6B7280"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative w-[120px]">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange && onStatusFilterChange(e.target.value)}
              className="w-full h-[36px] bg-white border border-[#ced4da] rounded-lg px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-[#212529] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#212529" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Payment Status Filter */}
          <div className="relative w-[140px]">
            <select
              value={paymentStatusFilter}
              onChange={(e) => onPaymentStatusFilterChange && onPaymentStatusFilterChange(e.target.value)}
              className="w-full h-[36px] bg-white border border-[#ced4da] rounded-lg px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-[#212529] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Payment</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#212529" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Supplier Filter */}
          <div className="relative w-[160px]">
            <select
              value={supplierFilter}
              onChange={(e) => onSupplierFilterChange && onSupplierFilterChange(e.target.value)}
              className="w-full h-[36px] bg-white border border-[#ced4da] rounded-lg px-3 py-2 text-[12px] font-['Poppins',sans-serif] text-[#212529] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.companyName}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="#212529" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Add Purchase Order Button */}
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="h-[36px] px-4 bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg text-white text-[12px] font-['Poppins',sans-serif] font-semibold leading-[20px] flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap shadow-md hover:shadow-lg ml-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Add Purchase Order</span>
          </button>
        )}

        {/* Actions Button with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowActionsDropdown(!showActionsDropdown)}
            className="h-[36px] px-4 bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 rounded-lg text-white text-[12px] font-['Poppins',sans-serif] leading-[20px] flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 whitespace-nowrap"
          >
            <span>Actions</span>
            <svg
              width="8"
              height="5"
              viewBox="0 0 8 5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`}
            >
              <path d="M1 1L4 4L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {showActionsDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              <button
                onClick={() => {
                  console.log('Export CSV');
                  setShowActionsDropdown(false);
                }}
                className="w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.66667 6.66667L8 10L11.3333 6.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 10V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export CSV
              </button>

              <button
                onClick={() => {
                  window.print();
                  setShowActionsDropdown(false);
                }}
                className="w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6V2H12V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 12H3.33333C2.97971 12 2.64057 11.8595 2.39052 11.6095C2.14048 11.3594 2 11.0203 2 10.6667V8C2 7.64638 2.14048 7.30724 2.39052 7.05719C2.64057 6.80714 2.97971 6.66667 3.33333 6.66667H12.6667C13.0203 6.66667 13.3594 6.80714 13.6095 7.05719C13.8595 7.30724 14 7.64638 14 8V10.6667C14 11.0203 13.8595 11.3594 13.6095 11.6095C13.3594 11.8595 13.0203 12 12.6667 12H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 10H4V14H12V10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Print
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderListHeader;
