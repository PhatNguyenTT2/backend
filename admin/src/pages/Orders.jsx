import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { OrderList, OrderListHeader, AddOrderModal, EditOrderModal, InvoiceOrderModal } from '../components/OrderList';
import orderService from '../services/orderService';

export const Orders = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders', href: '/orders' },
  ];

  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [paginatedOrders, setPaginatedOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Filters and sorting
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('');
  const [sortField, setSortField] = useState('orderDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 20,
  });

  // Fetch orders on component mount
  useEffect(() => {
    fetchOrders();
  }, []);

  // Apply search, filter and sorting when data or filters change
  useEffect(() => {
    let result = [...orders];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(order =>
        order.orderNumber?.toLowerCase().includes(query) ||
        order.customer?.fullName?.toLowerCase().includes(query) ||
        order.customer?.phone?.includes(query)
      );
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter(order => order.status === statusFilter);
    }

    // Apply payment status filter
    if (paymentStatusFilter) {
      result = result.filter(order => order.paymentStatus === paymentStatusFilter);
    }

    // Apply delivery status filter
    if (deliveryStatusFilter) {
      // Logic: Delivery status is derived from order status for now, or if there is a specific field
      // Assuming mapped from order status or specific delivery tracking. 
      // Checking if there is a specific delivery field on order object.
      // Based on OrderList, deliveryType exists. If user meant 'Delivery Status' as in 'Shipping Status', it's usually part of order status.
      // However, let's assume filtering by deliveryType or check if there's a specific need. 
      // User request said "update filter according to payment, delivery". 
      // The OrderList has a "Delivery Type" column (Delivery/Pickup). Let's filter by that if the value matches 'delivery' or 'pickup'.
      // If the filter expects 'shipping' status, it overlaps with order status.
      // Let's assume user wants to filter by Delivery Type (Delivery vs Pickup) OR status.
      // Given the context "filter according to payment, delivery", it often means Payment Status and Delivery Status (Order Status).
      // But Order Status is already there. So maybe "Delivery" means Delivery Type?
      // Let's look at available data. Order has `deliveryType`.
      if (['delivery', 'pickup'].includes(deliveryStatusFilter)) {
        result = result.filter(order => order.deliveryType === deliveryStatusFilter);
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle nested customer name
      if (sortField === 'customer') {
        aVal = a.customer?.fullName || '';
        bVal = b.customer?.fullName || '';
      }

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle different data types
      if (sortField === 'total') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortField === 'orderDate') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredOrders(result);

    // Update pagination
    const totalPages = Math.ceil(result.length / itemsPerPage);
    setPagination(prev => ({
      ...prev,
      currentPage: 1, // Reset to first page on filter change
      totalPages,
      itemsPerPage,
    }));
  }, [orders, searchQuery, statusFilter, paymentStatusFilter, deliveryStatusFilter, sortField, sortOrder, itemsPerPage]);

  // Paginate filtered orders
  useEffect(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    setPaginatedOrders(filteredOrders.slice(startIndex, endIndex));
  }, [filteredOrders, pagination.currentPage, pagination.itemsPerPage]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch orders with populated customer and createdBy
      const response = await orderService.getAllOrders({
        withDetails: false, // Don't need full details for list view
        limit: 1000 // Get more orders for client-side filtering
      });

      console.log('📥 Orders API response:', response);

      // Extract orders from response.data.orders
      const ordersArray = response?.data?.orders || response?.orders || [];
      console.log('📦 Orders array:', ordersArray.length, 'orders');

      // Map response to include id field for consistency
      const ordersData = ordersArray.map(order => ({
        ...order,
        id: order._id || order.id
      }));

      console.log('✅ Mapped orders data:', ordersData.length, 'orders');
      setOrders(ordersData);
    } catch (err) {
      console.error('❌ Error fetching orders:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load orders');
      setOrders([]);
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

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddOrder = () => {
    setShowAddModal(true);
  };

  const handleView = (order) => {
    // Open edit modal in view mode
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleEdit = (order) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleViewInvoice = (order) => {
    setSelectedOrder(order);
    setShowInvoiceModal(true);
  };

  const handleAddSuccess = () => {
    console.log('Order created successfully');
    fetchOrders(); // Refresh the list
  };

  const handleEditSuccess = () => {
    console.log('Order updated successfully');
    fetchOrders(); // Refresh the list
    setSelectedOrder(null);
  };

  const handleUpdateStatus = async (order, newStatus) => {
    try {
      // Validation: Cannot mark as delivered if payment is not completed
      if (newStatus === 'delivered' && order.paymentStatus !== 'paid') {
        alert('Cannot mark order as delivered without payment being completed.');
        return;
      }

      await orderService.updateOrder(order.id, { status: newStatus });
      fetchOrders(); // Refresh the list
    } catch (err) {
      console.error('Error updating order status:', err);
      alert(err.response?.data?.message || 'Failed to update order status');
    }
  };

  const handleUpdatePayment = async (order, newPaymentStatus) => {
    try {
      await orderService.updateOrder(order.id, { paymentStatus: newPaymentStatus });
      fetchOrders(); // Refresh the list
    } catch (err) {
      console.error('Error updating payment status:', err);
      alert(err.response?.data?.message || 'Failed to update payment status');
    }
  };

  const handleRefund = async (order) => {
    // Validation: Can only refund delivered orders that are fully paid
    if (order.status !== 'delivered' || order.paymentStatus !== 'paid') {
      alert('Can only refund delivered orders that are fully paid.');
      return;
    }

    if (!window.confirm(`Are you sure you want to refund order ${order.orderNumber}? This will restore inventory to shelf.`)) {
      return;
    }

    const reason = window.prompt('Enter refund reason (optional):', 'Customer request');

    try {
      const response = await orderService.refundOrder(order.id, { reason });

      if (response.success) {
        alert(`✅ Order ${order.orderNumber} refunded successfully!\n${response.message}`);
        fetchOrders(); // Refresh the list
      }
    } catch (err) {
      console.error('Error refunding order:', err);
      alert(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to refund order');
    }
  };

  const handleDelete = async (order) => {
    // Validation: Can only delete draft or pending orders with pending payment
    if (!['draft', 'pending'].includes(order.status) || order.paymentStatus !== 'pending') {
      alert('Can only delete draft or pending orders with pending payment.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete order ${order.orderNumber}?`)) {
      return;
    }

    try {
      await orderService.deleteOrder(order.id);
      alert('Order deleted successfully!');
      fetchOrders(); // Refresh the list
    } catch (err) {
      console.error('Error deleting order:', err);
      alert(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const handleDeleteAllDrafts = async () => {
    const draftCount = orders.filter(o => o.status === 'draft').length;

    if (draftCount === 0) {
      alert('No draft orders to delete.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete all ${draftCount} draft order(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await orderService.deleteAllDrafts();
      alert(`Successfully deleted ${response.deletedCount} draft order(s)!`);
      fetchOrders(); // Refresh the list
    } catch (err) {
      console.error('Error deleting draft orders:', err);
      alert(err.response?.data?.error?.message || 'Failed to delete draft orders');
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Order List Header */}
      {/* OrderListHeader - Updated with new filters */}
      <OrderListHeader
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        searchTerm={searchQuery}
        onSearch={handleSearch}
        onAddOrder={handleAddOrder}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        paymentStatusFilter={paymentStatusFilter}
        onPaymentStatusFilterChange={setPaymentStatusFilter}
        deliveryStatusFilter={deliveryStatusFilter}
        onDeliveryStatusFilterChange={setDeliveryStatusFilter}
        onDeleteAllDrafts={handleDeleteAllDrafts}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
      {!isLoading && !error && (
        <>
          <OrderList
            orders={paginatedOrders}
            onSort={handleColumnSort}
            sortField={sortField}
            sortOrder={sortOrder}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdateStatus={handleUpdateStatus}
            onUpdatePayment={handleUpdatePayment}
            onViewInvoice={handleViewInvoice}
            onRefund={handleRefund}
            onRefresh={fetchOrders}
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
          {paginatedOrders.length > 0 && (
            <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.itemsPerPage, filteredOrders.length)} of{' '}
              {filteredOrders.length} orders
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
          <p className="text-gray-500 text-sm">No orders found</p>
          {(searchQuery || statusFilter || paymentStatusFilter || deliveryStatusFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('');
                setPaymentStatusFilter('');
                setDeliveryStatusFilter('');
              }}
              className="mt-2 text-sm text-emerald-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Add Order Modal */}
      <AddOrderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedOrder(null);
        }}
        onSuccess={handleEditSuccess}
        order={selectedOrder}
      />

      {/* Invoice Order Modal */}
      <InvoiceOrderModal
        order={showInvoiceModal ? selectedOrder : null}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedOrder(null);
        }}
        onViewItems={handleView}
      />
    </div>
  );
};

export default Orders;
