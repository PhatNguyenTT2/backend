import React, { useState, useRef, useEffect } from 'react';

export const UserList = ({ users = [], onActiveChange, onSort, sortField, sortOrder, onResetPassword, onEditUser }) => {
  const [activeDropdown, setActiveDropdown] = useState(null); // Format: 'active-{userId}', 'action-{userId}'
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

      // Determine position based on dropdown type
      let leftPosition;
      if (dropdownId.startsWith('active-')) {
        // For Active Status: show dropdown to the right of button
        leftPosition = buttonRect.left;
      } else {
        // For Actions: show dropdown aligned to the right
        leftPosition = buttonRect.right - 160; // 160px is dropdown width
      }

      setDropdownPosition({
        top: buttonRect.bottom + 4,
        left: leftPosition
      });
      setActiveDropdown(dropdownId);
    }
  };

  // Handle active status change
  const handleActiveStatusChange = (userId, newStatus) => {
    if (onActiveChange) {
      onActiveChange(userId, newStatus);
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

  // Get active status badge styling
  const getActiveStatusStyles = (isActive) => {
    return isActive ? 'bg-[#10b981]' : 'bg-[#ef4444]';
  };

  // Get role badge styling
  const getRoleBadgeStyles = (role) => {
    const roleMap = {
      admin: 'bg-[#8b5cf6] text-white',        // Purple
      manager: 'bg-[#3b82f6] text-white',      // Blue
      staff: 'bg-[#10b981] text-white',        // Green
      customer: 'bg-[#6b7280] text-white',     // Gray
    };
    return roleMap[role?.toLowerCase()] || 'bg-gray-500 text-white';
  };

  // Active status options for dropdown
  const activeStatusOptions = [
    { value: true, label: 'Active', color: 'bg-[#10b981]' },
    { value: false, label: 'Inactive', color: 'bg-[#ef4444]' },
  ];

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Scrollable Container - overflow-x-auto allows horizontal scroll */}
      <div className="overflow-x-auto rounded-lg">
        <div className="min-w-[1200px]">
          {/* Table Header */}
          <div className="flex items-center h-[34px] bg-gray-50 border-b border-gray-200">
            {/* ID Column - Sortable */}
            <div
              className="w-[100px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('userCode')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                ID
                {getSortIcon('userCode')}
              </p>
            </div>

            {/* Role Column */}
            <div className="w-[100px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                Role
              </p>
            </div>

            {/* Name Column - Sortable */}
            <div
              className="flex-1 min-w-[150px] px-3 flex items-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('fullName')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                Name
                {getSortIcon('fullName')}
              </p>
            </div>

            {/* Department Column - Sortable */}
            <div
              className="w-[120px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('departmentName')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                Department
                {getSortIcon('departmentName')}
              </p>
            </div>

            {/* Email Column - Sortable */}
            <div
              className="flex-1 min-w-[180px] px-3 flex items-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('email')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                Email
                {getSortIcon('email')}
              </p>
            </div>

            {/* Username Column - Sortable */}
            <div
              className="w-[120px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('username')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                Username
                {getSortIcon('username')}
              </p>
            </div>

            {/* Active Column */}
            <div className="w-[100px] px-3 flex items-center flex-shrink-0">
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px]">
                Active
              </p>
            </div>

            {/* Last Login Column - Sortable */}
            <div
              className="w-[150px] px-3 flex items-center flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSortClick('lastLogin')}
            >
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-[#212529] uppercase tracking-[0.5px] leading-[18px] flex items-center">
                Last Login
                {getSortIcon('lastLogin')}
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
            {users.map((user, index) => {
              const activeDropdownId = `active-${user.id}`;

              return (
                <div
                  key={user.id}
                  className={`flex items-center h-[60px] hover:bg-gray-50 transition-colors ${index !== users.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                >
                  {/* ID - Display userCode */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-emerald-600 leading-[20px]">
                      {user.userCode}
                    </p>
                  </div>

                  {/* Role Badge */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    <span className={`${getRoleBadgeStyles(user.roleName)} px-2 py-1 rounded text-[9px] font-bold font-['Poppins',sans-serif] uppercase`}>
                      {user.roleName}
                    </span>
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-[150px] px-3 flex items-center">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                      {user.fullName}
                    </p>
                  </div>

                  {/* Department */}
                  <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                      {user.departmentName || 'N/A'}
                    </p>
                  </div>

                  {/* Email */}
                  <div className="flex-1 min-w-[180px] px-3 flex items-center">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                      {user.email}
                    </p>
                  </div>

                  {/* Username */}
                  <div className="w-[120px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px] truncate">
                      {user.username}
                    </p>
                  </div>

                  {/* Active Status Badge with Dropdown */}
                  <div className="w-[100px] px-3 flex items-center flex-shrink-0">
                    <button
                      onClick={(e) => toggleDropdown(activeDropdownId, e)}
                      className={`${getActiveStatusStyles(user.isActive)} px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity`}
                    >
                      <span className="text-[9px] font-bold font-['Poppins',sans-serif] text-white leading-[10px] uppercase">
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L4 4L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>

                  {/* Last Login */}
                  <div className="w-[150px] px-3 flex items-center flex-shrink-0">
                    <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-[#212529] leading-[20px]">
                      {formatDate(user.lastLogin)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="w-[100px] px-3 flex items-center justify-center flex-shrink-0">
                    <button
                      onClick={(e) => toggleDropdown(`action-${user.id}`, e)}
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
          {users.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif]">
                No users found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Position Dropdown Menus - Rendered outside table container */}
      {activeDropdown && (() => {
        // Find the user based on activeDropdown ID
        const user = users.find(u =>
          activeDropdown === `active-${u.id}` ||
          activeDropdown === `action-${u.id}`
        );

        if (!user) return null;

        // Determine dropdown type
        const isActiveStatus = activeDropdown === `active-${user.id}`;
        const isAction = activeDropdown === `action-${user.id}`;

        // Render Active Status Dropdown
        if (isActiveStatus) {
          return (
            <div
              ref={dropdownRef}
              className="fixed min-w-[120px] bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`
              }}
            >
              {activeStatusOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => handleActiveStatusChange(user.id, option.value)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <span className={`${option.color} w-2 h-2 rounded-full`}></span>
                  <span className="text-[12px] font-['Poppins',sans-serif] text-[#212529]">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          );
        }

        // Render Actions Dropdown
        if (isAction) {
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
                onClick={() => {
                  if (onEditUser) {
                    onEditUser(user);
                  }
                  setActiveDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.333 2.00004C11.5081 1.82494 11.716 1.68605 11.9447 1.59129C12.1735 1.49653 12.4187 1.44775 12.6663 1.44775C12.914 1.44775 13.1592 1.49653 13.3879 1.59129C13.6167 1.68605 13.8246 1.82494 13.9997 2.00004C14.1748 2.17513 14.3137 2.383 14.4084 2.61178C14.5032 2.84055 14.552 3.08575 14.552 3.33337C14.552 3.58099 14.5032 3.82619 14.4084 4.05497C14.3137 4.28374 14.1748 4.49161 13.9997 4.66671L5.33301 13.3334L1.33301 14.6667L2.66634 10.6667L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Edit
              </button>

              <button
                onClick={() => {
                  if (onResetPassword) {
                    onResetPassword(user);
                  }
                  setActiveDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.3337 7.33329H4.66699C3.92661 7.33329 3.33366 7.92625 3.33366 8.66663V13.3333C3.33366 14.0737 3.92661 14.6666 4.66699 14.6666H11.3337C12.074 14.6666 12.667 14.0737 12.667 13.3333V8.66663C12.667 7.92625 12.074 7.33329 11.3337 7.33329Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.33301 7.33329V4.66663C5.33301 3.78253 5.68419 2.93472 6.30931 2.3096C6.93444 1.68448 7.78225 1.33329 8.66634 1.33329C9.55044 1.33329 10.3982 1.68448 11.0234 2.3096C11.6485 2.93472 11.9997 3.78253 11.9997 4.66663V7.33329" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Reset Password
              </button>

              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete user ${user.fullName}?`)) {
                    console.log('Delete user:', user.id);
                  }
                  setActiveDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-[12px] font-['Poppins',sans-serif] text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
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
    </div>
  );
};
