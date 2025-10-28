import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { CustomerListHeader, CustomerList, AddCustomerModal, EditCustomerModal } from '../components/CustomerList';
import customerService from '../services/customerService';

const Customers = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Customers', href: null },
  ];

  // State management
  const [customers, setCustomers] = useState([]);
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
    per_page: 20
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortField, setSortField] = useState('customerCode');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modal states
  const [addCustomerModal, setAddCustomerModal] = useState(false);
  const [editCustomerModal, setEditCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Fetch customers from API
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching customers with filters:', filters);

      const response = await customerService.getCustomers(filters);
      console.log('API Response:', response);

      if (response.success) {
        const formattedCustomers = customerService.formatCustomersForDisplay(response.data.customers);
        console.log('Formatted customers:', formattedCustomers);
        setCustomers(formattedCustomers);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err.error || err.message || 'Failed to fetch customers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers on component mount and when filters change
  useEffect(() => {
    console.log('Customers component mounted or filters changed');
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.per_page]);

  // Handle filter changes
  const handleItemsPerPageChange = (newPerPage) => {
    setFilters({ ...filters, per_page: newPerPage, page: 1 });
  };

  // Handle search
  const handleSearch = (query) => {
    const searchLower = query.toLowerCase().trim();

    if (!searchLower) {
      // If search is empty, reset to original data
      fetchCustomers();
      return;
    }

    // Filter customers locally
    const allCustomers = [...customers];
    const filtered = allCustomers.filter(customer => {
      const customerCode = (customer.customerCode || '').toLowerCase();
      const fullName = (customer.fullName || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();

      return customerCode.includes(searchLower) ||
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower);
    });

    setCustomers(filtered);
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

    // Sort customers locally
    const sorted = [...customers].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Handle different data types
      if (field === 'dob' || field === 'createdAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (newSortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setCustomers(sorted);
  };

  // Handle toggle active status
  const handleToggleActive = async (customer) => {
    const newStatus = !customer.isActive;

    try {
      const response = await customerService.toggleCustomerStatus(customer.id, newStatus);

      if (response) {
        // Refresh customer list
        await fetchCustomers();
        console.log(`Customer ${customer.customerCode} status updated to ${newStatus ? 'active' : 'inactive'}`);
      }
    } catch (err) {
      console.error('Error toggling customer status:', err);
      alert(err.error || 'Failed to update customer status');
    }
  };

  // Handle add customer
  const handleAddCustomer = () => {
    setAddCustomerModal(true);
  };

  // Handle edit customer
  const handleEditCustomer = (customer) => {
    setSelectedCustomer(customer);
    setEditCustomerModal(true);
  };

  // Handle customer created successfully
  const handleCustomerSuccess = (data) => {
    console.log('Customer created successfully:', data);
    fetchCustomers(); // Refresh list
  };

  // Handle customer updated successfully
  const handleCustomerUpdateSuccess = (data) => {
    console.log('Customer updated successfully:', data);
    fetchCustomers(); // Refresh list
    setSelectedCustomer(null);
  };

  // Handle delete customer
  const handleDeleteCustomer = async (customer) => {
    // Validate on client-side: Only inactive customers can be deleted
    if (customer.isActive) {
      alert('Cannot delete active customer. Please deactivate the customer first.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete customer ${customer.customerCode}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await customerService.deleteCustomer(customer.id);
      console.log('Customer deleted successfully');
      fetchCustomers(); // Refresh list
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert(error.response?.data?.error || error.message || 'Failed to delete customer');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Customer List Header */}
        <CustomerListHeader
          itemsPerPage={filters.per_page}
          onItemsPerPageChange={handleItemsPerPageChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
          onAddCustomer={handleAddCustomer}
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
            <p className="font-medium">Error loading customers</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchCustomers}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Customer List Table */}
        {!loading && !error && (
          <>
            <CustomerList
              customers={customers}
              onSort={handleColumnSort}
              sortField={sortField}
              sortOrder={sortOrder}
              onToggleActive={handleToggleActive}
              onEdit={handleEditCustomer}
              onDelete={handleDeleteCustomer}
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
            {customers.length > 0 && (
              <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
                Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to{' '}
                {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{' '}
                {pagination.total} customers
              </div>
            )}

            {/* Empty State */}
            {customers.length === 0 && !loading && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-[14px] font-['Poppins',sans-serif]">
                  No customers found
                </p>
              </div>
            )}
          </>
        )}

        {/* Add Customer Modal */}
        <AddCustomerModal
          isOpen={addCustomerModal}
          onClose={() => setAddCustomerModal(false)}
          onSuccess={handleCustomerSuccess}
        />

        {/* Edit Customer Modal */}
        <EditCustomerModal
          isOpen={editCustomerModal}
          onClose={() => {
            setEditCustomerModal(false);
            setSelectedCustomer(null);
          }}
          onSuccess={handleCustomerUpdateSuccess}
          customer={selectedCustomer}
        />
      </div>
    </Layout>
  );
};

export default Customers;
