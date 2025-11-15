import React, { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import categoryService from '../../services/categoryService';

export const FilterProduct = ({ onFilterChange, currentFilters = {} }) => {
  // Helper function to format VND currency
  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState(currentFilters.categories || []);
  const [priceRange, setPriceRange] = useState([
    currentFilters.minPrice || 0,
    currentFilters.maxPrice || 1000000
  ]);
  const [isDragging, setIsDragging] = useState(null); // null | 'min' | 'max'

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Request categories with product count
        const result = await categoryService.getAllCategories({
          withProducts: true,
          isActive: true
        });
        if (result.success) {
          setCategories(result.data.categories);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const handleCategoryClick = (categoryId) => {
    if (categoryId === null) {
      // Click "All Products" - clear all categories
      setSelectedCategories([]);
    } else {
      // Toggle category selection
      setSelectedCategories(prev => {
        if (prev.includes(categoryId)) {
          return prev.filter(id => id !== categoryId);
        } else {
          return [...prev, categoryId];
        }
      });
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    if (onFilterChange) {
      const filterParams = {};

      // Chỉ gửi category nếu có selection (backend expects single category ID)
      if (selectedCategories.length > 0) {
        filterParams.category = selectedCategories[0]; // Backend chỉ hỗ trợ 1 category
      }

      // Gửi price range nếu khác giá trị mặc định
      if (priceRange[0] !== 0) {
        filterParams.minPrice = priceRange[0];
      }
      if (priceRange[1] !== 1000000) {
        filterParams.maxPrice = priceRange[1];
      }

      onFilterChange(filterParams);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, 1000000]);
    if (onFilterChange) {
      onFilterChange({});
    }
  };

  const handleMouseDown = (type) => {
    setIsDragging(type);
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  // Add global mouse event listeners for price slider
  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const slider = document.querySelector('.price-slider-track');
      if (!slider) return;

      const rect = slider.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const value = Math.round((percentage / 100) * 1000000);

      setPriceRange(prev => {
        if (isDragging === 'min') {
          return [Math.min(value, prev[1] - 10000), prev[1]];
        } else {
          return [prev[0], Math.max(value, prev[0] + 10000)];
        }
      });
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);

  // Check if any filters are active
  const hasActiveFilters = selectedCategories.length > 0 ||
    priceRange[0] !== 0 ||
    priceRange[1] !== 1000000;

  return (
    <div className="w-72 space-y-4 overflow-y-auto h-full">
      {/* Filter Header with Clear Button */}
      {hasActiveFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <button
            onClick={handleClearFilters}
            className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-semibold">Clear All Filters</span>
          </button>
        </div>
      )}

      {/* Category Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        {/* Header */}
        <div className="border-b border-gray-200 pb-2 mb-4">
          <h3 className="text-lg font-bold text-gray-800">Category</h3>
          <div className="w-16 h-0.5 bg-emerald-400 mt-1.5"></div>
        </div>

        {/* Loading State */}
        {loadingCategories ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
            <p className="text-xs text-gray-500 mt-2">Loading categories...</p>
          </div>
        ) : (
          <>
            {/* "All" Option */}
            <button
              onClick={() => handleCategoryClick(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded border transition-all mb-2 ${selectedCategories.length === 0
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded">
                  <Filter className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-xs text-gray-800 font-semibold">All Products</span>
              </div>
            </button>

            {/* Category List from API - Multiple Selection */}
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded border transition-all ${selectedCategories.includes(category.id)
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {/* {category.image ? (
                      <img
                        src={category.image}
                        alt={category.name}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded">
                        <span className="text-xs">📦</span>
                      </div>
                    )} */}
                    <span className="text-xs text-gray-800">{category.name}</span>
                  </div>
                  <div className="bg-emerald-200 rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    <span className="text-[10px] text-gray-800 font-medium">{category.productCount || 0}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Filter by Price Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden">
        {/* Decorative image in bottom right */}
        <div className="absolute bottom-0 right-0 w-16 h-16 opacity-10 pointer-events-none">
          <div className="text-4xl">💰</div>
        </div>

        {/* Header */}
        <div className="border-b border-gray-200 pb-2 mb-4 relative z-10">
          <h3 className="text-lg font-bold text-gray-800">Filter by Price</h3>
          <div className="w-16 h-0.5 bg-emerald-400 mt-1.5"></div>
        </div>

        {/* Price Range Slider */}
        <div className="mb-4 relative z-10">
          <div className="flex justify-between mb-3 text-xs">
            <span className="text-gray-500">
              Từ: <span className="text-emerald-600 font-semibold">{formatVND(priceRange[0])}</span>
            </span>
            <span className="text-gray-500">
              Đến: <span className="text-emerald-600 font-semibold">{formatVND(priceRange[1])}</span>
            </span>
          </div>

          {/* Slider Track */}
          <div className="relative h-1 mb-6">
            <div
              className="price-slider-track absolute inset-0 bg-gray-300 rounded cursor-pointer"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = (x / rect.width) * 100;
                const clickValue = Math.round((percentage / 100) * 1000000);

                const distToMin = Math.abs(clickValue - priceRange[0]);
                const distToMax = Math.abs(clickValue - priceRange[1]);

                if (distToMin < distToMax) {
                  setPriceRange([Math.min(clickValue, priceRange[1] - 10000), priceRange[1]]);
                  handleMouseDown('min');
                } else {
                  setPriceRange([priceRange[0], Math.max(clickValue, priceRange[0] + 10000)]);
                  handleMouseDown('max');
                }
              }}
            >
              {/* Active range */}
              <div
                className="absolute h-1 bg-emerald-500 rounded"
                style={{
                  left: `${(priceRange[0] / 1000000) * 100}%`,
                  right: `${100 - (priceRange[1] / 1000000) * 100}%`
                }}
              />

              {/* Min thumb */}
              <div
                className="absolute w-4 h-4 bg-emerald-500 rounded-full -top-1.5 transform -translate-x-1/2 cursor-grab active:cursor-grabbing z-10"
                style={{ left: `${(priceRange[0] / 1000000) * 100}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown('min');
                }}
              />

              {/* Max thumb */}
              <div
                className="absolute w-4 h-4 bg-emerald-500 rounded-full -top-1.5 transform -translate-x-1/2 cursor-grab active:cursor-grabbing z-10"
                style={{ left: `${(priceRange[1] / 1000000) * 100}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown('max');
                }}
              />
            </div>
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex gap-2 relative z-10">
          <button
            onClick={handleApplyFilters}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Filter className="w-4 h-4" />
            <span className="text-xs tracking-wider">APPLY FILTER</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              title="Clear filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-gray-800 mb-3">Active Filters ({selectedCategories.length + (priceRange[0] !== 0 || priceRange[1] !== 1000000 ? 1 : 0)})</h4>
          <div className="space-y-2">
            {selectedCategories.map(catId => {
              const cat = categories.find(c => c.id === catId);
              return cat ? (
                <div key={catId} className="flex items-center justify-between bg-emerald-50 px-3 py-1.5 rounded">
                  <span className="text-xs text-emerald-700">
                    {cat.name}
                  </span>
                  <button
                    onClick={() => handleCategoryClick(catId)}
                    className="text-emerald-700 hover:text-emerald-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : null;
            })}
            {(priceRange[0] !== 0 || priceRange[1] !== 1000000) && (
              <div className="flex items-center justify-between bg-emerald-50 px-3 py-1.5 rounded">
                <span className="text-xs text-emerald-700">
                  {formatVND(priceRange[0])} - {formatVND(priceRange[1])}
                </span>
                <button
                  onClick={() => setPriceRange([0, 1000000])}
                  className="text-emerald-700 hover:text-emerald-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
