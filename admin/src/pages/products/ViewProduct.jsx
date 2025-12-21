import React, { useState } from 'react';
import { Breadcrumb } from '../../components/Breadcrumb';
import { FilterProduct } from '../../components/FilterProduct';
import { ProductGrid, ProductListHeader, SortBy } from '../../components/ViewProduct';

/**
 * ViewProduct Page
 * Hiển thị danh sách sản phẩm dạng grid với filter và sort
 */
const ViewProduct = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Product List', href: '/products/view' },
  ];

  // Filter state - shared between FilterProduct and ProductGrid
  const [filters, setFilters] = useState({
    categories: [],
    minPrice: null,
    maxPrice: null,
    search: '',
    isActive: true
  });

  // Sort state
  const [sortBy, setSortBy] = useState('newest');

  // Pagination state for ProductListHeader
  const [paginationInfo, setPaginationInfo] = useState({
    totalItems: 0,
    currentCount: 0,
    isLoading: true
  });

  // Handle pagination changes from ProductGrid
  const handlePaginationChange = (info) => {
    setPaginationInfo(prev => ({ ...prev, ...info }));
  };

  // Handle filter changes from FilterProduct
  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Handle sort change from SortBy dropdown
  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
  };

  return (
    <div className="flex gap-6 h-full -m-6 p-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Header with Sort */}
        <div className="flex items-center justify-between">
          <ProductListHeader
            totalItems={paginationInfo.totalItems}
            currentCount={paginationInfo.currentCount}
            isLoading={paginationInfo.isLoading}
          />
          <SortBy value={sortBy} onChange={handleSortChange} />
        </div>

        {/* Product Grid */}
        <ProductGrid
          filters={filters}
          sortBy={sortBy}
          onPaginationChange={handlePaginationChange}
        />
      </div>

      {/* Right Sidebar - Filter */}
      <div className="flex-shrink-0">
        <FilterProduct
          onFilterChange={handleFilterChange}
          currentFilters={filters}
        />
      </div>
    </div>
  );
};

export default ViewProduct;
