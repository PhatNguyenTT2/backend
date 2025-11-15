import React, { useState } from 'react';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { ProductGrid, ProductListHeader, SortBy } from '../../components/ViewProduct';
import { FilterProduct } from '../../components/FilterProduct';

/**
 * ViewProduct Page - Example Usage
 * Trang hiển thị danh sách sản phẩm dạng grid
 * 
 * Sử dụng ViewProduct components mới với dữ liệu từ Product model:
 * - productCode, name, image, category, unitPrice, vendor, isActive
 */
const ViewProductPage = () => {
  const [sortBy, setSortBy] = useState('newest');
  const [filters, setFilters] = useState({
    category: null,
    minPrice: null,
    maxPrice: null,
    search: '',
    isActive: true
  });

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Products', path: '/products' },
    { label: 'View Products', path: '/products/view' }
  ];

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex gap-6 mt-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Header with Sort */}
            <div className="flex items-center justify-between mb-4">
              <ProductListHeader />
              <SortBy value={sortBy} onChange={handleSortChange} />
            </div>

            {/* Product Grid */}
            <ProductGrid filters={filters} sortBy={sortBy} />
          </div>

          {/* Sidebar Filter */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-6">
              <FilterProduct
                onFilterChange={handleFilterChange}
                currentFilters={filters}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ViewProductPage;
