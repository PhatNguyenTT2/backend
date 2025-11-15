import React from 'react';

export const POSSearchBar = ({ searchTerm, onSearchChange }) => {
  return (
    <div className="relative">
      <input
        id="product-search"
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search products... (Ctrl+K or F2)"
        className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-lg text-[15px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3"
      />
      <svg
        className="absolute left-3 top-3.5 text-gray-400"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
        <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};
