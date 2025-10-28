import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, ChevronDown } from 'lucide-react';

export const SortBy = ({ value = 'newest', onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Map display names to API values
  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
    { label: 'Name: A to Z', value: 'name_asc' },
    { label: 'Name: Z to A', value: 'name_desc' },
    { label: 'Highest Rated', value: 'rating' }
  ];

  const currentOption = sortOptions.find(opt => opt.value === value) || sortOptions[0];

  const handleSelect = (option) => {
    console.log('Sort selected:', option.label, '→', option.value);
    if (onChange) {
      onChange(option.value);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-2 hover:border-emerald-300 transition-colors"
      >
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-sm font-medium text-gray-500">Sort by:</span>
        <span className="text-sm font-medium text-gray-600 min-w-[130px] text-left">{currentOption.label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-full">
          {sortOptions.map((option, index) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option)}
              className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${index !== sortOptions.length - 1 ? 'border-b border-gray-100' : ''
                } ${index === 0 ? 'rounded-t-lg' : ''
                } ${index === sortOptions.length - 1 ? 'rounded-b-lg' : ''
                } ${value === option.value
                  ? 'text-emerald-600 font-semibold bg-emerald-50'
                  : 'text-gray-700 hover:bg-gray-50'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
