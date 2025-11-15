import React, { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard';
import productService from '../../services/productService';

/**
 * ProductGrid Component
 * Hiển thị danh sách sản phẩm dạng grid layout
 * Tự động fetch data từ API và handle pagination
 */
export const ProductGrid = ({ filters = {}, sortBy = 'newest', onPaginationChange }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    perPage: 12
  });

  useEffect(() => {
    fetchProducts();
  }, [filters, sortBy, pagination.currentPage]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);

    // Notify parent about loading state
    if (onPaginationChange) {
      onPaginationChange({ isLoading: true });
    }

    try {
      // Build query parameters
      const params = {
        page: pagination.currentPage,
        per_page: pagination.perPage,
        ...filters
      };

      // Add sort parameter
      if (sortBy === 'price-low') {
        params.sort = 'unitPrice';
        params.order = 'asc';
      } else if (sortBy === 'price-high') {
        params.sort = 'unitPrice';
        params.order = 'desc';
      } else if (sortBy === 'name') {
        params.sort = 'name';
        params.order = 'asc';
      } else {
        // newest - sort by createdAt descending
        params.sort = 'createdAt';
        params.order = 'desc';
      }

      const response = await productService.getAllProducts(params);

      if (response.success) {
        setProducts(response.data.products || []);

        // Update pagination info if available
        if (response.data.pagination) {
          const newPagination = {
            ...pagination,
            totalPages: response.data.pagination.pages || 1,
            totalItems: response.data.pagination.total || 0
          };
          setPagination(newPagination);

          // Notify parent component about pagination changes
          if (onPaginationChange) {
            onPaginationChange({
              totalItems: newPagination.totalItems,
              currentCount: response.data.products?.length || 0,
              isLoading: false
            });
          }
        }
      } else {
        throw new Error(response.message || 'Failed to fetch products');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(pagination.perPage)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 h-48 rounded-t-lg"></div>
            <div className="bg-white border border-gray-200 p-4 rounded-b-lg">
              <div className="h-3 bg-gray-200 rounded mb-2 w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <svg className="w-16 h-16 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Error Loading Products</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchProducts}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Products Found</h3>
        <p className="text-gray-600">Try adjusting your filters or search criteria</p>
      </div>
    );
  }

  return (
    <div>
      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map(product => (
          <ProductCard key={product.id || product._id} product={product} />
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col items-center mt-8 gap-4">
          {/* Page info */}
          <div className="text-sm text-gray-600">
            Showing page {pagination.currentPage} of {pagination.totalPages}
            {pagination.totalItems > 0 && ` (${pagination.totalItems} total items)`}
          </div>

          {/* Page buttons */}
          <div className="flex items-center gap-2">
            {/* Previous button */}
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Page numbers */}
            {(() => {
              const pages = [];
              const maxVisible = 5;
              let startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisible / 2));
              let endPage = Math.min(pagination.totalPages, startPage + maxVisible - 1);

              if (endPage - startPage < maxVisible - 1) {
                startPage = Math.max(1, endPage - maxVisible + 1);
              }

              // First page
              if (startPage > 1) {
                pages.push(
                  <button
                    key={1}
                    onClick={() => handlePageChange(1)}
                    className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    1
                  </button>
                );
                if (startPage > 2) {
                  pages.push(<span key="dots1" className="px-2">...</span>);
                }
              }

              // Visible pages
              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={`px-4 py-2 rounded-lg transition-colors ${pagination.currentPage === i
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    {i}
                  </button>
                );
              }

              // Last page
              if (endPage < pagination.totalPages) {
                if (endPage < pagination.totalPages - 1) {
                  pages.push(<span key="dots2" className="px-2">...</span>);
                }
                pages.push(
                  <button
                    key={pagination.totalPages}
                    onClick={() => handlePageChange(pagination.totalPages)}
                    className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    {pagination.totalPages}
                  </button>
                );
              }

              return pages;
            })()}

            {/* Next button */}
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
