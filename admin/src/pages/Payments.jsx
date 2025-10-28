import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { PaymentList, PaymentListHeader } from '../components/PaymentList';
// import paymentService from '../services/paymentService';

const Payments = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Payments', href: null },
  ];

  // State management
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0
  });

  // Filters - Backend uses 'limit' not 'per_page'
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    sort: '-paymentDate' // Backend format: '-field' for desc, 'field' for asc
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch payments from API
  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[Payments] Fetching with filters:', filters);
      // const response = await paymentService.getPayments(filters);
      console.log('[Payments] API Response:', response);

      // Backend returns { payments, pagination } directly
      if (response && response.payments) {
        console.log('[Payments] Raw payments:', response.payments);
        const formattedPayments = paymentService.formatPaymentsForDisplay(response.payments);
        console.log('[Payments] Formatted payments:', formattedPayments);
        setPayments(formattedPayments);

        if (response.pagination) {
          setPagination({
            current_page: response.pagination.page || 1,
            per_page: response.pagination.limit || 20,
            total: response.pagination.total || 0,
            total_pages: response.pagination.pages || 0
          });
        }
      } else {
        console.warn('[Payments] Unexpected response format:', response);
        setPayments([]);
      }
    } catch (err) {
      console.error('[Payments] Error fetching payments:', err);
      setError(err.error || err.message || 'Failed to fetch payments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch payments on component mount and when filters change
  useEffect(() => {
    fetchPayments();
  }, [filters]);

  // Apply search and sorting when data or filters change (Auto-filter like Categories)
  useEffect(() => {
    let result = [...payments];

    // Apply search filter - search by Payment Number, Payment ID, Order Number, Customer/Supplier
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(payment => {
        const paymentId = (payment.id || '').toString().toLowerCase();
        const paymentNumber = (payment.paymentNumber || '').toLowerCase();
        const relatedOrderNumber = (payment.relatedOrderNumber || '').toLowerCase();
        const customer = (payment.customer || '').toLowerCase();
        const supplier = (payment.supplier || '').toLowerCase();
        const reference = (payment.reference || '').toLowerCase();

        return paymentId.includes(query) ||
          paymentNumber.includes(query) ||
          relatedOrderNumber.includes(query) ||
          customer.includes(query) ||
          supplier.includes(query) ||
          reference.includes(query);
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
      if (sortField === 'amount') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (sortField === 'date' || sortField === 'paymentDate' || sortField === 'createdAt') {
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

    setFilteredPayments(result);
  }, [payments, searchQuery, sortField, sortOrder]);

  // Handle status change
  const handleStatusChange = async (paymentId, newStatus) => {
    try {
      console.log('[Payments] Updating status:', paymentId, newStatus);
      // Use the new status update endpoint with inventory management
      // const response = await paymentService.updatePaymentStatus(paymentId, newStatus);
      console.log('[Payments] Update response:', response);

      if (response) {
        await fetchPayments();
        console.log('Payment status updated successfully');
        // Show success message
        alert(response.message || 'Payment status updated successfully');
      }
    } catch (err) {
      console.error('Error updating payment status:', err);
      alert(err.error || 'Failed to update status. Please try again.');
    }
  };

  // Handle refund
  const handleRefund = async (paymentId, amount, reason) => {
    try {
      console.log('[Payments] Processing refund:', paymentId, amount, reason);
      // const response = await paymentService.processRefund(paymentId, amount, reason);
      console.log('[Payments] Refund response:', response);

      if (response) {
        await fetchPayments();
        console.log('Refund processed successfully');
        alert(response.message || 'Refund processed successfully');
      }
    } catch (err) {
      console.error('Error processing refund:', err);
      alert(err.error || 'Failed to process refund. Please try again.');
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newLimit) => {
    console.log('[Payments] Changing limit to:', newLimit);
    setFilters(prev => ({
      ...prev,
      limit: newLimit,
      page: 1
    }));
  };

  // Handle search change - auto-filter (no need to click search button)
  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  // Handle search button click (optional - mainly for UX consistency)
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Handle sort
  const handleSort = (field) => {
    const newSortOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(newSortOrder);
  };

  // Handle add payment
  const handleAddPayment = () => {
    console.log('Record new payment');
    // TODO: Open record payment modal
  };

  if (loading && payments.length === 0) {
    return (
      <Layout>
        <Breadcrumb items={breadcrumbItems} />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Breadcrumb items={breadcrumbItems} />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchPayments}
            className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Breadcrumb items={breadcrumbItems} />

      <div className="space-y-4">
        <PaymentListHeader
          itemsPerPage={filters.limit}
          onItemsPerPageChange={handleItemsPerPageChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearch={handleSearch}
          onAddPayment={handleAddPayment}
        />

        <PaymentList
          payments={filteredPayments}
          onStatusChange={handleStatusChange}
          onRefund={handleRefund}
          onSort={handleSort}
          sortField={sortField}
          sortOrder={sortOrder}
        />

        {/* Empty State - No Results from Search */}
        {!loading && !error && filteredPayments.length === 0 && payments.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-sm">No payments found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-emerald-600 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Results Summary */}
        {filteredPayments.length > 0 && (
          <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
            Showing {filteredPayments.length} of {payments.length} payments
            {searchQuery && ` (filtered)`}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Payments;
