import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { UserListHeader, UserList, AddUserModal, EditUserModal, ResetPasswordModal } from '../components/UserList';
// import userService from '../services/userService';

const Users = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Users', href: null },
  ];

  // State management
  const [users, setUsers] = useState([]);
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
  const [sortField, setSortField] = useState('userCode');
  const [sortOrder, setSortOrder] = useState('asc');

  // Add user modal state
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);

  // Edit user modal state
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);

  // Reset password modal state
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching users with filters:', filters);

      const response = await userService.getUsers(filters);
      console.log('API Response:', response);

      if (response.success) {
        const formattedUsers = userService.formatUsersForDisplay(response.data.users);
        console.log('Formatted users:', formattedUsers);
        setUsers(formattedUsers);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.error || err.message || 'Failed to fetch users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch users on component mount and when filters change
  useEffect(() => {
    console.log('🔄 Users component mounted or filters changed');
    console.log('📊 Current filters:', filters);
    console.log('📋 Current users state:', users);
    console.log('⏳ Loading state:', loading);
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.per_page]);

  // Handle active status change
  const handleActiveStatusChange = async (userId, newStatus) => {
    try {
      const response = await userService.updateActiveStatus(userId, newStatus);

      if (response.success) {
        // Refresh users list
        await fetchUsers();
        console.log('User active status updated successfully');
      }
    } catch (err) {
      console.error('Error updating user active status:', err);
      alert(err.error || 'Failed to update user active status');
    }
  };

  // Handle filter changes
  const handleItemsPerPageChange = (newPerPage) => {
    setFilters({ ...filters, per_page: newPerPage, page: 1 });
  };

  // Handle search
  const handleSearch = (query) => {
    const searchLower = query.toLowerCase().trim();

    if (!searchLower) {
      // If search is empty, reset to original data
      fetchUsers();
      return;
    }

    // Filter users locally
    const allUsers = [...users];
    const filtered = allUsers.filter(user => {
      const userCode = (user.userCode || '').toLowerCase();
      const fullName = (user.fullName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const username = (user.username || '').toLowerCase();

      return userCode.includes(searchLower) ||
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        username.includes(searchLower);
    });

    setUsers(filtered);
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

    // Sort users locally
    const sorted = [...users].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Handle different data types
      if (field === 'lastLogin' || field === 'createdAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (typeof aVal === 'boolean') {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
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

    setUsers(sorted);
  };

  // Handle add user
  const handleAddUser = () => {
    console.log('Opening add user modal');
    setAddUserModalOpen(true);
  };

  // Handle user created successfully
  const handleUserCreated = (newUser) => {
    console.log('New user created:', newUser);
    setAddUserModalOpen(false);
    // Refresh users list
    fetchUsers();
  };

  // Handle edit user
  const handleEditUser = (user) => {
    console.log('Opening edit user modal for user:', user);
    setSelectedUserForEdit(user);
    setEditUserModalOpen(true);
  };

  // Handle user updated successfully
  const handleUserUpdated = () => {
    console.log('User updated successfully');
    setEditUserModalOpen(false);
    setSelectedUserForEdit(null);
    // Refresh users list
    fetchUsers();
  };

  // Handle reset password
  const handleResetPassword = (user) => {
    console.log('Opening reset password modal for user:', user);
    setSelectedUserForReset(user);
    setResetPasswordModalOpen(true);
  };

  // Handle password reset successfully
  const handlePasswordResetSuccess = () => {
    console.log('Password reset successfully');
    setResetPasswordModalOpen(false);
    setSelectedUserForReset(null);
    // Optionally refresh users list
    fetchUsers();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* User List Header */}
        <UserListHeader
          itemsPerPage={filters.per_page}
          onItemsPerPageChange={handleItemsPerPageChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
          onAddUser={handleAddUser}
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
            <p className="font-medium">Error loading users</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchUsers}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* User List Table */}
        {!loading && !error && (
          <>
            <UserList
              users={users}
              onActiveChange={handleActiveStatusChange}
              onSort={handleColumnSort}
              sortField={sortField}
              sortOrder={sortOrder}
              onResetPassword={handleResetPassword}
              onEditUser={handleEditUser}
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
            {users.length > 0 && (
              <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif] mt-4">
                Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to{' '}
                {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{' '}
                {pagination.total} users
              </div>
            )}

            {/* Empty State */}
            {users.length === 0 && !loading && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-[14px] font-['Poppins',sans-serif]">
                  No users found
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={addUserModalOpen}
        onClose={() => setAddUserModalOpen(false)}
        onSuccess={handleUserCreated}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={editUserModalOpen}
        onClose={() => {
          setEditUserModalOpen(false);
          setSelectedUserForEdit(null);
        }}
        user={selectedUserForEdit}
        onSuccess={handleUserUpdated}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={resetPasswordModalOpen}
        onClose={() => {
          setResetPasswordModalOpen(false);
          setSelectedUserForReset(null);
        }}
        user={selectedUserForReset}
        onPasswordReset={handlePasswordResetSuccess}
      />
    </Layout>
  );
};

export default Users;
