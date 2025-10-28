import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { PurchaseOrderList, PurchaseOrderListHeader } from '../components/PurchaseOrderList';
import purchaseOrderService from '../services/purchaseOrderService';

const PurchaseOrders = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Inventory', href: null },
    { label: 'Purchase Orders', href: null },
  ];

  // State management
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [filteredPurchaseOrders, setFilteredPurchaseOrders] = useState([]);
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
    sort: '-orderDate' // Backend format: '-field' for desc, 'field' for asc
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortField, setSortField] = useState('orderDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch purchase orders from API
  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[PurchaseOrders] Fetching with filters:', filters);
      const response = await purchaseOrderService.getPurchaseOrders(filters);
      console.log('[PurchaseOrders] API Response:', response);

      // Backend returns { purchaseOrders, pagination } directly
      if (response && response.purchaseOrders) {
        console.log('[PurchaseOrders] Raw purchase orders:', response.purchaseOrders);
        const formattedPOs = purchaseOrderService.formatPurchaseOrdersForDisplay(response.purchaseOrders);
        console.log('[PurchaseOrders] Formatted purchase orders:', formattedPOs);
        setPurchaseOrders(formattedPOs);

        if (response.pagination) {
          setPagination({
            current_page: response.pagination.page || 1,
            per_page: response.pagination.limit || 20,
            total: response.pagination.total || 0,
            total_pages: response.pagination.pages || 0
          });
        }
      } else {
        console.warn('[PurchaseOrders] Unexpected response format:', response);
        setPurchaseOrders([]);
      }
    } catch (err) {
      console.error('[PurchaseOrders] Error fetching purchase orders:', err);
      setError(err.error || err.message || 'Failed to fetch purchase orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchase orders on component mount and when filters change
  useEffect(() => {
    fetchPurchaseOrders();
  }, [filters]);

  // Apply search and sorting when data or filters change (Auto-filter like Categories)
  useEffect(() => {
    let result = [...purchaseOrders];

    // Apply search filter - search by PO Number, Supplier Name, or Supplier Code
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(po => {
        const poNumber = (po.poNumber || '').toLowerCase();
        const supplierName = (po.supplierName || '').toLowerCase();
        const supplierCode = (po.supplierCode || '').toLowerCase();
        const poId = (po.id || '').toString().toLowerCase();

        return poNumber.includes(query) ||
          supplierName.includes(query) ||
          supplierCode.includes(query) ||
          poId.includes(query);
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
      if (sortField === 'totalAmount' || sortField === 'quantity') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (sortField === 'orderDate' || sortField === 'expectedDelivery' || sortField === 'createdAt') {
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

    setFilteredPurchaseOrders(result);
  }, [purchaseOrders, searchQuery, sortField, sortOrder]);

  // Handle items per page change
  const handleItemsPerPageChange = (newLimit) => {
    console.log('[PurchaseOrders] Changing limit to:', newLimit);
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

  // Handle add purchase order
  const handleAddPurchaseOrder = () => {
    console.log('Add new purchase order');
    // TODO: Open create modal
  };

  if (loading && purchaseOrders.length === 0) {
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
            onClick={fetchPurchaseOrders}
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
        <PurchaseOrderListHeader
          itemsPerPage={filters.limit}
          onItemsPerPageChange={handleItemsPerPageChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearch={handleSearch}
          onAddPurchaseOrder={handleAddPurchaseOrder}
        />

        <PurchaseOrderList
          purchaseOrders={filteredPurchaseOrders}
          onSort={handleSort}
          sortField={sortField}
          sortOrder={sortOrder}
          onRefresh={fetchPurchaseOrders}
        />

        {/* Empty State - No Results from Search */}
        {!loading && !error && filteredPurchaseOrders.length === 0 && purchaseOrders.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-sm">No purchase orders found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-emerald-600 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Results Summary */}
        {filteredPurchaseOrders.length > 0 && (
          <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
            Showing {filteredPurchaseOrders.length} of {purchaseOrders.length} purchase orders
            {searchQuery && ` (filtered)`}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PurchaseOrders;