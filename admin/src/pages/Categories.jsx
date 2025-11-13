import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { CategoryList, CategoryListHeader, AddCategoryModal, EditCategoryModal } from '../components/CategoryList';
import categoryService from '../services/categoryService';

export const Categories = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Categories', href: '/categories' },
  ];
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [paginatedCategories, setPaginatedCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Filters and sorting
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('categoryCode');
  const [sortOrder, setSortOrder] = useState('asc');

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 10,
  });

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Apply search and sorting when data or filters change
  useEffect(() => {
    let result = [...categories];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(category =>
        category.name?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle different data types
      if (sortField === 'productCount' || sortField === 'order') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortField === 'name' || sortField === 'categoryCode') {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredCategories(result);

    // Update pagination
    const totalPages = Math.ceil(result.length / itemsPerPage);
    setPagination(prev => ({
      ...prev,
      currentPage: 1, // Reset to first page on filter change
      totalPages,
      itemsPerPage,
    }));
  }, [categories, searchQuery, sortField, sortOrder, itemsPerPage]);

  // Paginate filtered categories
  useEffect(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    setPaginatedCategories(filteredCategories.slice(startIndex, endIndex));
  }, [filteredCategories, pagination.currentPage, pagination.itemsPerPage]);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Include inactive categories for admin panel and get product count
      const response = await categoryService.getAllCategories({
        withProducts: true
      });

      // Handle response structure: { success: true, data: { categories: [...] } }
      if (response.success && response.data && response.data.categories) {
        setCategories(response.data.categories);
      } else if (Array.isArray(response)) {
        // Fallback if response is directly an array
        setCategories(response);
      } else {
        console.error('Unexpected response structure:', response);
        setCategories([]);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(err.message || 'Failed to load categories');
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleColumnSort = (field, order) => {
    setSortField(field);
    setSortOrder(order);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddCategory = () => {
    setShowAddModal(true);
  };

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setShowEditModal(true);
  };

  const handleAddSuccess = (response) => {
    console.log('Category created:', response);
    fetchCategories(); // Refresh the list
    // Optional: Show success toast notification
  };

  const handleEditSuccess = (response) => {
    console.log('Category updated:', response);
    fetchCategories(); // Refresh the list
    setSelectedCategory(null);
    // Optional: Show success toast notification
  };

  const handleToggleActive = async (category, newStatus) => {
    const isCurrentlyActive = category.isActive !== false;

    // If newStatus is not provided, toggle it
    if (newStatus === undefined) {
      newStatus = !isCurrentlyActive;
    }

    // Validation: Cannot deactivate if category has active products
    if (isCurrentlyActive && !newStatus && category.productCount > 0) {
      alert(`Cannot deactivate category with ${category.productCount} active product(s). Please deactivate all products in this category first.`);
      return;
    }

    try {
      await categoryService.updateCategory(category.id, {
        isActive: newStatus
      });
      fetchCategories(); // Refresh the list
    } catch (err) {
      console.error('Error toggling category status:', err);
      alert(err.response?.data?.error?.message || err.message || 'Failed to update category status');
    }
  };

  const handleDelete = async (category) => {
    // Validation checks
    if (category.isActive !== false) {
      alert('Cannot delete active category. Please deactivate it first.');
      return;
    }

    if (category.productCount > 0) {
      alert(`Cannot delete category with ${category.productCount} product(s). Please reassign or delete all products first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      await categoryService.deleteCategory(category.id);
      alert('Category deleted successfully!');
      fetchCategories(); // Refresh the list
    } catch (err) {
      console.error('Error deleting category:', err);
      alert(err.response?.data?.error?.message || err.message || 'Failed to delete category');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Category List Header */}
        <CategoryListHeader
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearch={handleSearch}
          onAddCategory={handleAddCategory}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Error loading categories</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchCategories}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Category List Table */}
        {!isLoading && !error && (
          <>
            <CategoryList
              categories={paginatedCategories}
              onSort={handleColumnSort}
              sortField={sortField}
              sortOrder={sortOrder}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center mt-6">
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    className={`px-3 py-2 rounded transition-colors text-[12px] font-['Poppins',sans-serif] ${pagination.currentPage === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-[#3bb77e] hover:bg-[#def9ec]'
                      }`}
                  >
                    ‹ Previous
                  </button>

                  {/* Page numbers */}
                  {(() => {
                    const maxPagesToShow = 5;
                    const { totalPages, currentPage } = pagination;

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
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className={`px-3 py-2 rounded transition-colors text-[12px] font-['Poppins',sans-serif] ${pagination.currentPage === pagination.totalPages
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
            {paginatedCategories.length > 0 && (
              <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
                Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.itemsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-sm">No categories found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm text-emerald-600 hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      <AddCategoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Edit Category Modal */}
      <EditCategoryModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCategory(null);
        }}
        onSuccess={handleEditSuccess}
        category={selectedCategory}
      />
    </Layout>
  );
};

export default Categories;