import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { OrderListHeader, OrderList } from '../components/OrderList';
import { AddOrderModal, EditOrderModal } from '../components/OrderModals';
import orderService from '../services/orderService';

const Orders = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders', href: null },
  ];

  // State management
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    page: 1,
    per_page: 20,
    status: '',
    payment_status: ''
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modal state
  const [addOrderModal, setAddOrderModal] = useState(false);
  const [editOrderModal, setEditOrderModal] = useState(null);

  // Fetch orders from API
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await orderService.getOrders(filters);

      if (response.success) {
        const formattedOrders = orderService.formatOrdersForDisplay(response.data.orders);
        setOrders(formattedOrders);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.error || 'Failed to fetch orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders on component mount and when filters change
  useEffect(() => {
    fetchOrders();
  }, [filters]);

  // Apply search and sorting when data or filters change (Auto-filter like Categories)
  useEffect(() => {
    let result = [...orders];

    // Apply search filter - search by ID, order number, or customer name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(order => {
        const orderNumber = (order.orderNumber || '').toLowerCase();
        const customerName = (order.customerName || '').toLowerCase();
        const orderId = (order.id || '').toString().toLowerCase();

        return orderNumber.includes(query) ||
          customerName.includes(query) ||
          orderId.includes(query);
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
      if (sortField === 'total') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (sortField === 'date' || sortField === 'createdAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
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

    setFilteredOrders(result);
  }, [orders, searchQuery, sortField, sortOrder]);

  // Handle status change
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const response = await orderService.updateOrderStatus(orderId, newStatus);

      if (response.success) {
        // Refresh orders list
        await fetchOrders();

        // Show success message (you can add toast notification here)
        console.log('Order status updated successfully');
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      alert(err.error || 'Failed to update order status');
    }
  };

  // Handle delete order
  const handleDeleteOrder = async (order) => {
    // Validation: Check payment status
    const allowedPaymentStatuses = ['paid', 'failed', 'refunded'];
    const paymentStatus = order.paymentStatus.toLowerCase();

    if (!allowedPaymentStatuses.includes(paymentStatus)) {
      alert(`Cannot delete order with payment status '${order.paymentStatus}'. Only orders with payment status 'Paid', 'Failed', or 'Refunded' can be deleted.`);
      return;
    }

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete order ${order.orderNumber}?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const response = await orderService.deleteOrder(order.id);

      if (response.success) {
        // Refresh orders list
        await fetchOrders();
        console.log('Order deleted successfully');
      }
    } catch (err) {
      console.error('Error deleting order:', err);
      alert(err.error || 'Failed to delete order');
    }
  };

  // Handle filter changes
  const handleItemsPerPageChange = (newPerPage) => {
    setFilters({ ...filters, per_page: newPerPage, page: 1 });
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

  // Handle add order
  const handleAddOrder = () => {
    setAddOrderModal(true);
  };

  // Handle order created successfully
  const handleOrderSuccess = (data) => {
    console.log('Order created successfully:', data);
    fetchOrders(); // Refresh list
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Order List Header */}
        <OrderListHeader
          itemsPerPage={filters.per_page}
          onItemsPerPageChange={handleItemsPerPageChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearch={handleSearch}
          onAddOrder={handleAddOrder}
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
            <p className="font-medium">Error loading orders</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Order List Table */}
        {!loading && !error && (
          <>
            <OrderList
              orders={filteredOrders}
              onStatusChange={handleStatusChange}
              onEdit={(order) => setEditOrderModal(order)}
              onDelete={handleDeleteOrder}
              onSort={handleColumnSort}
              sortField={sortField}
              sortOrder={sortOrder}
            />

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-center mt-6">
                <div className="flex items-center gap-2">
                  {/* Previous button */}
                  <button
                    onClick={() => setFilters({ ...filters, page: pagination.current_page - 1 })}
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
                    onClick={() => setFilters({ ...filters, page: pagination.current_page + 1 })}
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
            {filteredOrders.length > 0 && (
              <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
                Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of {pagination.total} orders
                {searchQuery && ` (filtered from ${orders.length} total)`}
              </div>
            )}
          </>
        )}

        {/* Empty State - No Results from Search */}
        {!loading && !error && filteredOrders.length === 0 && orders.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-sm">No orders found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-emerald-600 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      {/* Add Order Modal */}
      <AddOrderModal
        isOpen={addOrderModal}
        onClose={() => setAddOrderModal(false)}
        onSuccess={handleOrderSuccess}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={!!editOrderModal}
        onClose={() => setEditOrderModal(null)}
        onSuccess={handleOrderSuccess}
        order={editOrderModal}
      />
    </Layout>
  );
};

export default Orders;
