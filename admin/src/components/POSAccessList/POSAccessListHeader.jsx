import React, { useState } from 'react';

export const POSListHeader = ({
  totalPOS = 0,
  activePOS = 0,
  lockedPOS = 0,
  deniedPOS = 0,
  onSearch,
  onFilterStatus,
  onRefresh,
  onGrantAccess,
  statusFilter = 'all'
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleFilterChange = (status) => {
    if (onFilterStatus) {
      onFilterStatus(status);
    }
  };

  return (
    <div className="space-y-4">
      {/* Title and Grant Access Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold font-['Poppins',sans-serif] text-[#212529] leading-[32px]">
            POS Access Management
          </h1>
          <p className="text-[13px] font-normal font-['Poppins',sans-serif] text-gray-600 mt-1">
            Manage employee POS authentication and access control
          </p>
        </div>

        <button
          onClick={onGrantAccess}
          className="h-[36px] px-4 bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[13px] font-medium font-['Poppins',sans-serif] text-white">
            Grant POS Access
          </span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-gray-500 uppercase tracking-[0.5px]">
                Total Access
              </p>
              <p className="text-[24px] font-semibold font-['Poppins',sans-serif] text-[#212529] mt-1">
                {totalPOS}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7ZM20 8V14M23 11H17" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Active */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-gray-500 uppercase tracking-[0.5px]">
                Active
              </p>
              <p className="text-[24px] font-semibold font-['Poppins',sans-serif] text-emerald-600 mt-1">
                {activePOS}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#10B981" strokeWidth="2" />
                <path d="M7 12L10.5 15.5L17 9" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Locked */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-gray-500 uppercase tracking-[0.5px]">
                Locked
              </p>
              <p className="text-[24px] font-semibold font-['Poppins',sans-serif] text-red-600 mt-1">
                {lockedPOS}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Denied */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium font-['Poppins',sans-serif] text-gray-500 uppercase tracking-[0.5px]">
                Access Denied
              </p>
              <p className="text-[24px] font-semibold font-['Poppins',sans-serif] text-gray-600 mt-1">
                {deniedPOS}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#6B7280" strokeWidth="2" />
                <path d="M15 9L9 15M9 9L15 15" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Search Input */}
          <div className="flex-1 max-w-md relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 14L11.1 11.1" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by employee name or user code..."
              className="w-full h-[36px] pl-10 pr-4 bg-white border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] text-[#212529] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterChange('all')}
              className={`h-[36px] px-4 rounded-lg text-[13px] font-medium font-['Poppins',sans-serif] transition-all ${statusFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
              All ({totalPOS})
            </button>

            <button
              onClick={() => handleFilterChange('active')}
              className={`h-[36px] px-4 rounded-lg text-[13px] font-medium font-['Poppins',sans-serif] transition-all ${statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
              Active ({activePOS})
            </button>

            <button
              onClick={() => handleFilterChange('locked')}
              className={`h-[36px] px-4 rounded-lg text-[13px] font-medium font-['Poppins',sans-serif] transition-all ${statusFilter === 'locked'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
              Locked ({lockedPOS})
            </button>

            <button
              onClick={() => handleFilterChange('denied')}
              className={`h-[36px] px-4 rounded-lg text-[13px] font-medium font-['Poppins',sans-serif] transition-all ${statusFilter === 'denied'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
              Denied ({deniedPOS})
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="h-[36px] w-[36px] bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.65 2.35C12.2 0.9 10.21 0 8 0C3.58 0 0.01 3.58 0.01 8C0.01 12.42 3.58 16 8 16C11.73 16 14.84 13.45 15.73 10H13.65C12.83 12.33 10.61 14 8 14C4.69 14 2 11.31 2 8C2 4.69 4.69 2 8 2C9.66 2 11.14 2.69 12.22 3.78L9 7H16V0L13.65 2.35Z" fill="#6B7280" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
