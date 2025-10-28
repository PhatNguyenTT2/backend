import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { ProductList, ProductListHeader, AddProductModal, EditProductModal } from '../../components/ListProduct';

import productService from '../../services/productService';

const ListProduct = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Products', href: '/products/list' },
  ];

  // State management
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [paginatedProducts, setPaginatedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Filter & sort state
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('sku');
  const [sortOrder, setSortOrder] = useState('asc');

  // Pagination state
  const [pagination, setPagination] = useState({
    total: 0,
    total_pages: 0,
    current_page: 1,
    per_page: 10,
    has_prev: false,
    has_next: false
  });

  // Fetch products from backend
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Fetch all products including inactive ones for admin panel
      const response = await productService.getProducts({ per_page: 1000, include_inactive: true });

      // Handle different response structures
      let productData = [];
      if (response.success && response.data) {
        productData = response.data.products || response.data;
      } else if (Array.isArray(response)) {
        productData = response;
      }

      console.log('Fetched products:', productData.length);
      setProducts(productData);
      setFilteredProducts(productData);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, []);

  // Filter and sort products
  useEffect(() => {
    let result = [...products];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (product) =>
          product.sku?.toLowerCase().includes(query) ||
          product.name?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle special cases
      if (sortField === 'category') {
        aValue = a.category?.name || '';
        bValue = b.category?.name || '';
      }

      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string values
      const aStr = String(aValue || '').toLowerCase();
      const bStr = String(bValue || '').toLowerCase();

      if (sortOrder === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    setFilteredProducts(result);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [products, searchQuery, sortField, sortOrder]);

  // Apply pagination to filtered products
  useEffect(() => {
    const total = filteredProducts.length;
    const totalPages = Math.ceil(total / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    const paginated = filteredProducts.slice(start, end);
    setPaginatedProducts(paginated);

    // Update pagination info
    setPagination({
      total,
      total_pages: totalPages,
      current_page: currentPage,
      per_page: itemsPerPage,
      has_prev: currentPage > 1,
      has_next: currentPage < totalPages
    });
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Handler functions
  const handleSort = (field) => {
    // Toggle sort order if clicking same field
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const handleToggleActive = async (product) => {
    const isCurrentlyActive = product.isActive !== false;

    // If trying to deactivate (active -> inactive)
    if (isCurrentlyActive) {
      // Check if product has stock
      if (product.stock > 0) {
        alert(`Cannot deactivate "${product.name}" because it has ${product.stock} units in stock.\n\nPlease reduce the stock to 0 before deactivating this product.`);
        return;
      }

      if (window.confirm(`Are you sure you want to deactivate "${product.name}"?\n\nThe product will no longer be available.`)) {
        try {
          await productService.updateProduct(product.id, { isActive: false });
          fetchProducts();
        } catch (err) {
          console.error('Error deactivating product:', err);
          const errorMessage = err.response?.data?.error || err.message || 'Failed to deactivate product.';
          alert(errorMessage);
        }
      }
    } else {
      // Activating (inactive -> active)
      if (window.confirm(`Are you sure you want to activate "${product.name}"?`)) {
        try {
          await productService.updateProduct(product.id, { isActive: true });
          fetchProducts();
        } catch (err) {
          console.error('Error activating product:', err);
          const errorMessage = err.response?.data?.error || err.message || 'Failed to activate product.';
          alert(errorMessage);
        }
      }
    }
  };

  const handleDelete = async (product) => {
    // Check if product is active
    if (product.isActive !== false) {
      alert(`Cannot delete "${product.name}" because it is still active.\n\nPlease deactivate the product first before deleting.`);
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${product.name}"?\n\nThis action cannot be undone.`)) {
      try {
        await productService.deleteProduct(product.id);
        // Refresh the list
        fetchProducts();
      } catch (err) {
        console.error('Error deleting product:', err);
        const errorMessage = err.response?.data?.error || err.message || 'Failed to delete product. Please try again.';
        alert(errorMessage);
      }
    }
  };

  const handleAdd = () => {
    setShowAddModal(true);
  };

  const handleAddSuccess = (response) => {
    console.log('Product created:', response);
    fetchProducts(); // Refresh the list
  };

  const handleEditSuccess = (response) => {
    console.log('Product updated:', response);
    fetchProducts(); // Refresh the list
    setSelectedProduct(null);
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    console.log('Export products to CSV');
    alert('Export functionality coming soon!');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Header */}
        <ProductListHeader
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={(query) => setSearchQuery(query)}
          onExport={handleExport}
          onPrint={handlePrint}
          onAdd={handleAdd}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
              <p className="text-gray-600 font-['Poppins',sans-serif]">Loading products...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <svg
                className="w-16 h-16 text-red-500 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 font-['Poppins',sans-serif]">
                Error Loading Products
              </h3>
              <p className="text-gray-600 mb-4 font-['Poppins',sans-serif]">{error}</p>
              <button
                onClick={fetchProducts}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-['Poppins',sans-serif]"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredProducts.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <svg
                className="w-16 h-16 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2 font-['Poppins',sans-serif]">
                No Products Found
              </h3>
              <p className="text-gray-600 mb-4 font-['Poppins',sans-serif]">
                {searchQuery
                  ? `No products match "${searchQuery}"`
                  : 'Start by adding your first product'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleAdd}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-['Poppins',sans-serif]"
                >
                  Add Product
                </button>
              )}
            </div>
          </div>
        )}

        {/* Products List */}
        {!isLoading && !error && filteredProducts.length > 0 && (
          <>
            <ProductList
              products={paginatedProducts}
              onSort={handleSort}
              sortField={sortField}
              sortOrder={sortOrder}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-center mt-6">
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    onClick={() => handlePageChange(pagination.current_page - 1)}
                    disabled={!pagination.has_prev}
                    className={`px-3 py-2 rounded transition-colors text-[12px] font-['Poppins',sans-serif] ${!pagination.has_prev
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-[#3bb77e] hover:bg-[#def9ec]'
                      }`}
                  >
                    ‹ Previous
                  </button>

                  {/* Page numbers */}
                  {(() => {
                    const maxPagesToShow = 5;
                    const totalPages = pagination.total_pages;
                    const currentPage = pagination.current_page;

                    // Calculate start and end page numbers to display
                    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

                    // Adjust start if we're near the end
                    if (endPage - startPage < maxPagesToShow - 1) {
                      startPage = Math.max(1, endPage - maxPagesToShow + 1);
                    }

                    const pages = [];

                    // First page + ellipsis
                    if (startPage > 1) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => handlePageChange(1)}
                          className="px-3 py-2 rounded text-[#3bb77e] hover:bg-[#def9ec] transition-colors text-[12px] font-['Poppins',sans-serif]"
                        >
                          1
                        </button>
                      );
                      if (startPage > 2) {
                        pages.push(
                          <span key="ellipsis-start" className="px-2 text-gray-400">
                            ...
                          </span>
                        );
                      }
                    }

                    // Page numbers
                    for (let page = startPage; page <= endPage; page++) {
                      pages.push(
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-2 rounded transition-colors text-[12px] font-['Poppins',sans-serif] ${currentPage === page
                            ? 'bg-[#3bb77e] text-white'
                            : 'text-[#3bb77e] hover:bg-[#def9ec]'
                            }`}
                        >
                          {page}
                        </button>
                      );
                    }

                    // Ellipsis + last page
                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) {
                        pages.push(
                          <span key="ellipsis-end" className="px-2 text-gray-400">
                            ...
                          </span>
                        );
                      }
                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => handlePageChange(totalPages)}
                          className="px-3 py-2 rounded text-[#3bb77e] hover:bg-[#def9ec] transition-colors text-[12px] font-['Poppins',sans-serif]"
                        >
                          {totalPages}
                        </button>
                      );
                    }

                    return pages;
                  })()}

                  {/* Next button */}
                  <button
                    onClick={() => handlePageChange(pagination.current_page + 1)}
                    disabled={!pagination.has_next}
                    className={`px-3 py-2 rounded transition-colors text-[12px] font-['Poppins',sans-serif] ${!pagination.has_next
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-[#3bb77e] hover:bg-[#def9ec]'
                      }`}
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}

            {/* Results Summary */}
            <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} products
            </div>
          </>
        )}
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedProduct(null);
        }}
        onSuccess={handleEditSuccess}
        product={selectedProduct}
      />
    </Layout>
  );
};

export default ListProduct;
