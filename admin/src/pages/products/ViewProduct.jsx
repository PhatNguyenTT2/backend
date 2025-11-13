import React, { useState } from 'react';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { FilterProduct } from '../../components/FilterProduct';
import { ProductList } from '../../components/ViewProduct';

const ViewProduct = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Product List', href: '/products/view' },
  ];

  // Filter state - shared between FilterProduct and ProductList
  const [filters, setFilters] = useState({
    categories: [],
    minPrice: null,
    maxPrice: null,
    sortBy: 'newest'
  });

  // Handle filter changes from FilterProduct
  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Handle sort change from ProductList
  const handleSortChange = (sortBy) => {
    setFilters(prev => ({ ...prev, sortBy }));
  };

  return (
    <Layout>
      <div className="flex gap-6 h-full -m-6 p-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Breadcrumb */}
          <Breadcrumb items={breadcrumbItems} />

          {/* Product List with Grid */}
          <ProductList
            filters={filters}
            onSortChange={handleSortChange}
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
    </Layout>
  );
};

export default ViewProduct;
