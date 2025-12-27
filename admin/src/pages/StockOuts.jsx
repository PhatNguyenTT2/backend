import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import {
  StockOutList,
  StockOutListHeader,
  CreateStockOutOrderModal
} from '../components/StockOutList';
import stockOutOrderService from '../services/stockOutOrderService';
import detailInventoryService from '../services/detailInventoryService';

export const StockOuts = () => {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Inventory', href: '/inventories' },
    { label: 'Stock Out Orders', href: '/inventories/stock-outs' },
  ];

  const [stockOutOrders, setStockOutOrders] = useState([]);
  const [filteredStockOutOrders, setFilteredStockOutOrders] = useState([]);
  const [paginatedStockOutOrders, setPaginatedStockOutOrders] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);

  // Filters and sorting
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('soNumber');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 10,
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchStockOutOrders();
    fetchInventoryList();
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...stockOutOrders];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(wo =>
        wo.soNumber?.toLowerCase().includes(query) ||
        wo.destination?.toLowerCase().includes(query) ||
        wo.notes?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(wo => wo.status === statusFilter);
    }

    // Apply reason filter
    if (reasonFilter !== 'all') {
      result = result.filter(wo => wo.reason === reasonFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (sortField === 'orderDate' || sortField === 'completedDate') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredStockOutOrders(result);

    // Update pagination
    const totalPages = Math.ceil(result.length / itemsPerPage);
    setPagination(prev => ({
      ...prev,
      currentPage: 1,
      totalPages,
      itemsPerPage,
    }));
  }, [stockOutOrders, searchQuery, sortField, sortOrder, itemsPerPage, statusFilter, reasonFilter]);

  // Paginate filtered stock out orders
  useEffect(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    setPaginatedStockOutOrders(filteredStockOutOrders.slice(startIndex, endIndex));
  }, [filteredStockOutOrders, pagination.currentPage, pagination.itemsPerPage]);

  const fetchStockOutOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await stockOutOrderService.getAllStockOutOrders();

      if (response.success && response.data) {
        setStockOutOrders(response.data.stockOutOrders || response.data);
      } else if (Array.isArray(response)) {
        setStockOutOrders(response);
      } else {
        console.error('Unexpected response structure:', response);
        setStockOutOrders([]);
      }
    } catch (err) {
      console.error('Error fetching stock out orders:', err);
      setError(err.message || 'Failed to load stock out orders');
      setStockOutOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventoryList = async () => {
    try {
      // Stock out operates on warehouse inventory (onHand), not shelf stock
      // So we only filter by hasWarehouseStock to get all batches with inventory in warehouse
      const response = await detailInventoryService.getAllDetailInventories({
        hasWarehouseStock: true
        // Removed hasShelfStock filter - stock out can process batches regardless of shelf stock
      });

      console.log('DEBUG: fetchInventoryList response:', response);

      if (response.success && response.data) {
        const inventory = response.data.detailInventories || response.data;
        console.log('DEBUG: inventory count:', inventory.length);
        setInventoryList(inventory);
      } else if (Array.isArray(response)) {
        console.log('DEBUG: inventory array count:', response.length);
        setInventoryList(response);
      } else {
        console.warn('DEBUG: No inventory data');
        setInventoryList([]);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setInventoryList([]);
    }
  };

  const handleColumnSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleRefresh = async () => {
    await fetchStockOutOrders();
    await fetchInventoryList();
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    handleRefresh();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Stock Out List Header */}
      <StockOutListHeader
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        reasonFilter={reasonFilter}
        onReasonFilterChange={setReasonFilter}
        onAddClick={() => setShowAddModal(true)}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading stock out orders</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Stock Out List Table */}
      {!isLoading && !error && (
        <>
          <StockOutList
            stockOutOrders={paginatedStockOutOrders}
            onSort={handleColumnSort}
            sortField={sortField}
            sortOrder={sortOrder}
            onRefresh={handleRefresh}
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
                    : 'text-red-600 hover:bg-red-50'
                    }`}
                >
                  ‹ Previous
                </button>

                {/* Page numbers */}
                {(() => {
                  const maxPagesToShow = 5;
                  const { totalPages, currentPage } = pagination;

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
                        onClick={() => handlePageChange(1)}
                        className="px-3 py-2 rounded bg-white border border-gray-300 hover:bg-gray-50 text-[12px] font-['Poppins',sans-serif]"
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
                          ? 'bg-red-600 text-white'
                          : 'bg-white border border-gray-300 hover:bg-gray-50'
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
                        className="px-3 py-2 rounded bg-white border border-gray-300 hover:bg-gray-50 text-[12px] font-['Poppins',sans-serif]"
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
                    : 'text-red-600 hover:bg-red-50'
                    }`}
                >
                  Next ›
                </button>
              </div>
            </div>
          )}

          {/* Results Summary */}
          {paginatedStockOutOrders.length > 0 && (
            <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.itemsPerPage, filteredStockOutOrders.length)} of {filteredStockOutOrders.length} stock out orders
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredStockOutOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 text-sm">No stock out orders found</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-red-600 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <CreateStockOutOrderModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
          inventoryList={inventoryList}
        />
      )}
    </div>
  );
};
