import React, { useState, useRef, useEffect } from 'react';

export const EmployeeList = ({ employees = [], onEdit, onDelete, onSort, sortField, sortOrder }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

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

      setDropdownPosition({
        top: buttonRect.bottom + 4,
        left: buttonRect.right - 150
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
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Scrollable Container */}
      <div className="overflow-x-auto rounded-lg">
        <div className="min-w-[1000px]">
          {/* Table Header */}
          <div className="flex items-center h-[34px] bg-gray-50 border-b border-gray-200">
            {/* ID Column - Sortable */}
            <div
              className="w-[120px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('userCode')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                ID
                {getSortIcon('userCode')}
              </p>
            </div>

            {/* Full Name Column - Sortable */}
            <div
              className="flex-1 min-w-[180px] px-3 flex items-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('fullName')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                Full Name
                {getSortIcon('fullName')}
              </p>
            </div>

            {/* Phone Column */}
            <div className="w-[140px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                Phone
              </p>
            </div>

            {/* Address Column */}
            <div className="flex-1 min-w-[200px] px-3 flex items-center">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                Address
              </p>
            </div>

            {/* Department Column - Sortable */}
            <div
              className="w-[150px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('departmentName')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                Department
                {getSortIcon('departmentName')}
              </p>
            </div>

            {/* Date of Birth Column */}
            <div className="w-[120px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                Birth Date
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
            {employees.map((employee, index) => {
              const actionDropdownId = `action-${employee.id}`;

              return (
                <div
                  key={employee.id}
                  className={`flex items-center h-[60px] hover:bg-gray-50 transition-colors ${index !== employees.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                >
                  {/* ID - Display userCode */}
                  <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-emerald-600 leading-[20px]">
                      {employee.userCode}
                    </p>
                  </div>

                  {/* Full Name */}
                  <div className="flex-1 min-w-[180px] px-3 flex items-center">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                      {employee.fullName}
                    </p>
                  </div>

                  {/* Phone */}
                  <div className="w-[140px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {employee.phone || 'N/A'}
                    </p>
                  </div>

                  {/* Address */}
                  <div className="flex-1 min-w-[200px] px-3 flex items-center">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate" title={employee.address}>
                      {employee.address || 'N/A'}
                    </p>
                  </div>

                  {/* Department */}
                  <div className="w-[150px] px-3 flex items-center flex-shrink-0">
                    {employee.departmentName ? (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[11px] font-medium font-['Poppins',sans-serif]">
                        {employee.departmentName}
                      </span>
                    ) : (
                      <span className="text-[13px] font-normal font-['Poppins',sans-serif] text-gray-400">
                        No Department
                      </span>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatDate(employee.dateOfBirth)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="w-[100px] px-3 flex items-center justify-center flex-shrink-0">
                    <button
                      onClick={(e) => toggleDropdown(actionDropdownId, e)}
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
          {employees.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif]">
                No employees found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Position Dropdown Menu */}
      {activeDropdown && (() => {
        const employee = employees.find(e => activeDropdown === `action-${e.id}`);

        if (!employee) return null;

        return (
          <div
            ref={dropdownRef}
            className="fixed min-w-[150px] bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`
            }}
          >
            <button
              onClick={() => {
                onEdit && onEdit(employee);
                setActiveDropdown(null);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.3333 2.00004C11.5084 1.82494 11.7163 1.68605 11.9451 1.59129C12.1739 1.49653 12.4191 1.44775 12.6666 1.44775C12.9142 1.44775 13.1594 1.49653 13.3882 1.59129C13.617 1.68605 13.8249 1.82494 14 2.00004C14.1751 2.17513 14.314 2.383 14.4087 2.61178C14.5035 2.84055 14.5523 3.08575 14.5523 3.33337C14.5523 3.58099 14.5035 3.82619 14.4087 4.05497C14.314 4.28374 14.1751 4.49161 14 4.66671L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00004Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[12px] font-['Poppins',sans-serif] text-[#212529]">
                Edit Employee
              </span>
            </button>

            <div className="border-t border-gray-200 my-1"></div>

            <button
              onClick={() => {
                console.log('View Details:', employee);
                setActiveDropdown(null);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 8C1 8 3.5 3 8 3C12.5 3 15 8 15 8C15 8 12.5 13 8 13C3.5 13 1 8 1 8Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[12px] font-['Poppins',sans-serif] text-[#212529]">
                View Details
              </span>
            </button>

            <div className="border-t border-gray-200 my-1"></div>

            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete ${employee.fullName}?`)) {
                  onDelete && onDelete(employee.id);
                }
                setActiveDropdown(null);
              }}
              className="w-full px-4 py-2 text-left hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4H3.33333H14" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.33334 4.00001V2.66668C5.33334 2.31305 5.47381 1.97392 5.72386 1.72387C5.97391 1.47382 6.31305 1.33334 6.66668 1.33334H9.33334C9.68697 1.33334 10.0261 1.47382 10.2761 1.72387C10.5262 1.97392 10.6667 2.31305 10.6667 2.66668V4.00001M12.6667 4.00001V13.3333C12.6667 13.687 12.5262 14.0261 12.2761 14.2761C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66668C4.31305 14.6667 3.97391 14.5262 3.72386 14.2761C3.47381 14.0261 3.33334 13.687 3.33334 13.3333V4.00001H12.6667Z" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[12px] font-['Poppins',sans-serif] text-red-600">
                Delete Employee
              </span>
            </button>
          </div>
        );
      })()}
    </div>
  );
};
