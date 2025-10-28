import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { InventoryListHeader, InventoryList } from '../components/InventoryList';
import { StockInModal, AdjustStockModal, MovementHistoryModal } from '../components/StockModals';
import inventoryService from '../services/inventoryService';

const Inventories = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Inventory', href: null },
  ];

  // State management
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortField, setSortField] = useState('sku');
  const [sortOrder, setSortOrder] = useState('asc');

  // Filter view state
  const [filterView, setFilterView] = useState('all'); // 'all', 'low-stock', 'out-of-stock'

  // Modal states
  const [stockInModal, setStockInModal] = useState({ isOpen: false, product: null });
  const [adjustStockModal, setAdjustStockModal] = useState({ isOpen: false, product: null });
  const [movementHistoryModal, setMovementHistoryModal] = useState({
    isOpen: false,
    productId: null,
    productName: null,
    productSku: null
  });

  // Fetch inventory from API
  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching inventory with filters:', filters);
      console.log('Filter view:', filterView);

      const params = { ...filters };

      // Add filter view params
      if (filterView === 'low-stock') {
        params.lowStock = 'true';
      } else if (filterView === 'out-of-stock') {
        params.outOfStock = 'true';
      }

      console.log('Request params:', params);

      const response = await inventoryService.getInventory(params);
      console.log('API Response:', response);

      if (response && response.success && response.data) {
        const inventoryData = response.data.inventory || [];
        console.log('Raw inventory data:', inventoryData);

        // Ensure inventoryData is an array
        if (!Array.isArray(inventoryData)) {
          console.error('Inventory data is not an array:', inventoryData);
          setError('Invalid data format received from server');
          setInventory([]);
          return;
        }

        const formattedInventory = inventoryService.formatInventoryForDisplay(inventoryData);
        console.log('Formatted inventory:', formattedInventory);

        setInventory(formattedInventory || []);

        // Map pagination to match expected format with safe access
        if (response.data.pagination) {
          setPagination({
            page: response.data.pagination.current_page || 1,
            limit: response.data.pagination.per_page || 20,
            total: response.data.pagination.total || 0,
            pages: response.data.pagination.total_pages || 1
          });
        }
      } else {
        console.warn('Response format unexpected:', response);
        setError('Unexpected response format from server');
        setInventory([]);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.error || err.error || err.message || 'Failed to fetch inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch inventory on component mount and when filters change
  useEffect(() => {
    console.log('Inventories component mounted or filters changed');
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filterView]);

  // Apply search and sorting when data or filters change (Auto-filter like Categories)
  useEffect(() => {
    let result = [...inventory];

    // Apply search filter - search by SKU or product name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const sku = (item.sku || '').toLowerCase();
        const productName = (item.productName || '').toLowerCase();

        return sku.includes(query) || productName.includes(query);
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle different data types
      if (sortField === 'quantityOnHand' || sortField === 'quantityReserved' ||
        sortField === 'quantityAvailable' || sortField === 'reorderPoint') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortField === 'lastRestocked' || sortField === 'createdAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredInventory(result);
  }, [inventory, searchQuery, sortField, sortOrder]);

  // Handle filter changes
  const handleItemsPerPageChange = (newLimit) => {
    setFilters({ ...filters, limit: newLimit, page: 1 });
  };

  // Handle filter view change
  const handleFilterViewChange = (view) => {
    setFilterView(view);
    setFilters({ ...filters, page: 1 });
  };

  // Handle search change - auto-filter (no need to click search button)
  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  // Handle search button click (optional - mainly for UX consistency)
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Handle column sort
  const handleColumnSort = (field) => {
    let newSortOrder = 'asc';

    // Toggle sort order if clicking the same field
    if (sortField === field) {
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }

    setSortField(field);
    setSortOrder(newSortOrder);
  };

  // Handle stock in
  const handleStockIn = (productId = null) => {
    setStockInModal({ isOpen: true, product: productId });
  };

  // Handle adjust stock
  const handleAdjust = (productId = null) => {
    setAdjustStockModal({ isOpen: true, product: productId });
  };

  // Handle view movement history
  const handleViewHistory = (item) => {
    setMovementHistoryModal({
      isOpen: true,
      productId: item.productId,
      productName: item.productName,
      productSku: item.sku
    });
  };

  // Handle stock operation success
  const handleStockSuccess = (data) => {
    console.log('Stock operation successful:', data);
    // Refresh inventory list
    fetchInventory();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Inventory List Header */}
        <InventoryListHeader
          itemsPerPage={filters.limit}
          onItemsPerPageChange={handleItemsPerPageChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearch={handleSearch}
          onStockIn={handleStockIn}
          onAdjust={handleAdjust}
          filterView={filterView}
          onFilterViewChange={handleFilterViewChange}
        />

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Error loading inventory</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchInventory}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Inventory List Table */}
        {!loading && !error && (
          <>
            <InventoryList
              inventory={filteredInventory}
              onSort={handleColumnSort}
              sortField={sortField}
              sortOrder={sortOrder}
              onViewHistory={handleViewHistory}
              onStockIn={handleStockIn}
              onAdjust={handleAdjust}
            />

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center mt-6">
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className={`px-3 py-2 rounded transition-colors text-[12px] font-['Poppins',sans-serif] ${pagination.page === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-[#3bb77e] hover:bg-[#def9ec]'
                      }`}
                  >
                    ‹ Previous
                  </button>

                  {/* Page numbers */}
                  {(() => {
                    const maxPagesToShow = 5;
                    const totalPages = pagination.pages;
                    const currentPage = pagination.page;

                    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

                    if (endPage - startPage < maxPagesToShow - 1) {
                      startPage = Math.max(1, endPage - maxPagesToShow + 1);
                    }

                    const pages = [];

                    // First page + ellipsis
                    if (startPage > 1) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => setFilters({ ...filters, page: 1 })}
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
                          onClick={() => setFilters({ ...filters, page })}
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
                          onClick={() => setFilters({ ...filters, page: totalPages })}
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
                    onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.pages}
                    className={`px-3 py-2 rounded transition-colors text-[12px] font-['Poppins',sans-serif] ${pagination.page === pagination.pages
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
            {filteredInventory.length > 0 && (
              <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} items
                {searchQuery && ` (filtered from ${inventory.length} total)`}
              </div>
            )}

            {/* Empty State - No Results from Search */}
            {filteredInventory.length === 0 && inventory.length > 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
                <p className="text-gray-500 text-sm">No inventory items found matching "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-sm text-emerald-600 hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Empty State - No Data */}
            {inventory.length === 0 && !loading && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-[14px] font-['Poppins',sans-serif]">
                  No inventory items found
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <StockInModal
        isOpen={stockInModal.isOpen}
        onClose={() => setStockInModal({ isOpen: false, product: null })}
        onSuccess={handleStockSuccess}
        preSelectedProduct={stockInModal.product}
      />

      <AdjustStockModal
        isOpen={adjustStockModal.isOpen}
        onClose={() => setAdjustStockModal({ isOpen: false, product: null })}
        onSuccess={handleStockSuccess}
        preSelectedProduct={adjustStockModal.product}
      />

      <MovementHistoryModal
        isOpen={movementHistoryModal.isOpen}
        onClose={() => setMovementHistoryModal({ isOpen: false, productId: null, productName: null, productSku: null })}
        productId={movementHistoryModal.productId}
        productName={movementHistoryModal.productName}
        productSku={movementHistoryModal.productSku}
      />
    </Layout>
  );
};

export default Inventories;

