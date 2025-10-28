import React, { useState, useRef, useEffect } from 'react';

export const CustomerListHeader = ({
  itemsPerPage,
  onItemsPerPageChange,
  searchQuery,
  onSearchChange,
  onSearch,
  onAddCustomer,
}) => {
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const itemsDropdownRef = useRef(null);
  const actionsDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (itemsDropdownRef.current && !itemsDropdownRef.current.contains(event.target)) {
        setShowItemsDropdown(false);
      }
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target)) {
        setShowActionsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle search input change
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    onSearchChange(value);

    // Auto-search as user types
    if (onSearch) {
      onSearch(value);
    }
  };

  // Handle search button click
  const handleSearchClick = () => {
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  // Handle Enter key in search input
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchQuery);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left Side - Items per page */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-['Poppins',sans-serif] text-[#212529]">
            Show
          </span>
          <div className="relative" ref={itemsDropdownRef}>
            <button
              onClick={() => setShowItemsDropdown(!showItemsDropdown)}
              className="w-[70px] h-[38px] px-3 bg-white border border-gray-300 rounded-lg flex items-center justify-between hover:border-gray-400 transition-colors"
            >
              <span className="text-[13px] font-['Poppins',sans-serif] text-[#212529]">
                {itemsPerPage}
              </span>
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${showItemsDropdown ? 'rotate-180' : ''}`}
              >
                <path
                  d="M1 1L5 5L9 1"
                  stroke="#212529"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Items Dropdown */}
            {showItemsDropdown && (
              <div className="absolute top-full mt-1 w-[70px] bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {[10, 20, 50, 100].map((value) => (
                  <button
                    key={value}
                    onClick={() => {
                      onItemsPerPageChange(value);
                      setShowItemsDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-[13px] font-['Poppins',sans-serif] hover:bg-gray-50 transition-colors ${itemsPerPage === value ? 'text-[#3bb77e] font-medium' : 'text-[#212529]'
                      }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-[13px] font-['Poppins',sans-serif] text-[#212529]">
            entries
          </span>
        </div>

        {/* Right Side - Search and Actions */}
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyPress={handleSearchKeyPress}
              placeholder="Search by ID, Name, Email..."
              className="w-[300px] h-[38px] pl-10 pr-4 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] text-[#212529] placeholder-gray-400 focus:outline-none focus:border-[#3bb77e] focus:ring-1 focus:ring-[#3bb77e] transition-all"
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <path
                d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 14L11.1 11.1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Actions Dropdown */}
          <div className="relative" ref={actionsDropdownRef}>
            <button
              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
              className="h-[38px] px-4 bg-[#3bb77e] text-white rounded-lg flex items-center gap-2 hover:bg-[#2ea76a] transition-colors"
            >
              <span className="text-[13px] font-medium font-['Poppins',sans-serif]">
                Actions
              </span>
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`}
              >
                <path
                  d="M1 1L5 5L9 1"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Actions Dropdown Menu */}
            {showActionsDropdown && (
              <div className="absolute top-full right-0 mt-1 w-[180px] bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    onAddCustomer();
                    setShowActionsDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-[13px] font-['Poppins',sans-serif] text-[#212529] hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 3.33337V12.6667"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M3.33301 8H12.6663"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Add Customer
                </button>

                <div className="border-t border-gray-200"></div>

                <button
                  onClick={() => {
                    console.log('Export customers clicked');
                    setShowActionsDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-[13px] font-['Poppins',sans-serif] text-[#212529] hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4.66699 6.66663L8.00033 9.99996L11.3337 6.66663"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 10V2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Export
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
