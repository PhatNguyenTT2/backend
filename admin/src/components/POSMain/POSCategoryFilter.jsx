import React from 'react';

export const POSCategoryFilter = ({ categories, selectedCategory, onCategoryChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {categories.map(category => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={`px-4 py-2 rounded-lg font-['Poppins',sans-serif] text-[13px] font-medium whitespace-nowrap transition-all ${selectedCategory === category.id
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
        >
          {category.name}
          {category.categoryCode && category.categoryCode !== 'ALL' && (
            <span className="ml-1.5 text-[10px] opacity-75">
              ({category.categoryCode})
            </span>
          )}
        </button>
      ))}
    </div>
  );
};
