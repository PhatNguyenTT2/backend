import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { EmployeeList, EmployeeListHeader, AddEmployeeModal, EditEmployeeModal, UserAccountModal, ViewAccountModal, AdminResetPasswordModal } from '../components/EmployeeList';
import employeeService from '../services/employeeService';

export const Employees = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Employees', href: null },
  ];

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('userCode');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Fetch employees from API
  const fetchEmployees = async (params = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await employeeService.getAllEmployees(params);

      if (response.success) {
        // Transform data to match component format - preserve full employee object
        const transformedEmployees = response.data.employees.map(emp => ({
          id: emp.id,
          userCode: emp.userAccount?.userCode || 'N/A',
          fullName: emp.fullName,
          phone: emp.phone,
          address: emp.address,
          dateOfBirth: emp.dateOfBirth,
          // Preserve full data for editing
          userAccount: emp.userAccount,
          email: emp.userAccount?.email,
          role: emp.userAccount?.role,
          isActive: emp.userAccount?.isActive
        }));

        // Sort by userCode ascending (default)
        const sortedEmployees = transformedEmployees.sort((a, b) => {
          const aVal = (a.userCode || '').toLowerCase();
          const bVal = (b.userCode || '').toLowerCase();
          return aVal > bVal ? 1 : -1;
        });

        setEmployees(sortedEmployees);
      } else {
        setError(response.error || 'Failed to fetch employees');
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  // Handle sort (client-side)
  const handleSort = (field) => {
    const newSortOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(newSortOrder);

    const sortedEmployees = [...employees].sort((a, b) => {
      let aVal = a[field] || '';
      let bVal = b[field] || '';

      // Handle null values
      if (!aVal && bVal) return 1;
      if (aVal && !bVal) return -1;
      if (!aVal && !bVal) return 0;

      // Convert to lowercase for string comparison
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (newSortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setEmployees(sortedEmployees);
  };

  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      fetchEmployees();
      return;
    }

    // Search via API
    fetchEmployees({ search: query });
  };

  // Handle add employee
  const handleAddEmployee = () => {
    setShowAddModal(true);
  };

  // Handle add success
  const handleAddSuccess = (newEmployee) => {
    console.log('Employee added successfully:', newEmployee);
    // Refresh the list
    fetchEmployees();
  };

  // Handle edit employee
  const handleEditEmployee = (employee) => {
    console.log('Edit employee:', employee);
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  // Handle edit success
  const handleEditSuccess = (updatedEmployee) => {
    console.log('Employee updated successfully:', updatedEmployee);
    // Refresh the list
    fetchEmployees();
  };

  // Handle manage account
  const handleManageAccount = (employee) => {
    console.log('Manage account:', employee);
    setSelectedEmployee(employee);
    setShowAccountModal(true);
  };

  // Handle account update success
  const handleAccountUpdateSuccess = (updatedAccount) => {
    console.log('Account updated successfully:', updatedAccount);
    // Refresh the list
    fetchEmployees();
  };

  // Handle view details
  const handleViewDetails = (employee) => {
    console.log('View details:', employee);
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  // Handle reset password
  const handleResetPassword = (employee) => {
    console.log('Reset password:', employee);
    setSelectedEmployee(employee);
    setShowResetPasswordModal(true);
  };

  // Handle reset password success
  const handleResetPasswordSuccess = () => {
    console.log('Password reset successfully');
    // Optionally refresh the list
    fetchEmployees();
  };

  // Handle delete employee
  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      const response = await employeeService.deleteEmployee(employeeId);

      if (response.success) {
        // Remove from local state
        setEmployees(employees.filter(emp => emp.id !== employeeId));
        alert('Employee deleted successfully');
      } else {
        alert(response.error || 'Failed to delete employee');
      }
    } catch (err) {
      console.error('Error deleting employee:', err);
      alert(err.response?.data?.error?.message || err.message || 'Failed to delete employee');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
            {error}
          </div>
        )}

        {/* Employee List Header */}
        <EmployeeListHeader
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
          onAddEmployee={handleAddEmployee}
        />

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-600 text-[14px] font-['Poppins',sans-serif]">
                Loading employees...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Employee List */}
            <EmployeeList
              employees={employees}
              onEdit={handleEditEmployee}
              onDelete={handleDeleteEmployee}
              onManageAccount={handleManageAccount}
              onViewDetails={handleViewDetails}
              onResetPassword={handleResetPassword}
              onSort={handleSort}
              sortField={sortField}
              sortOrder={sortOrder}
            />

            {/* Results Summary */}
            {employees.length > 0 && (
              <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif]">
                Showing {employees.length} employee{employees.length !== 1 ? 's' : ''}
              </div>
            )}

            {/* Empty State */}
            {employees.length === 0 && !loading && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-[14px] font-['Poppins',sans-serif]">
                  No employees found
                </p>
              </div>
            )}
          </>
        )}

        {/* Add Employee Modal */}
        <AddEmployeeModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />

        {/* Edit Employee Modal */}
        <EditEmployeeModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
          employee={selectedEmployee}
        />

        {/* User Account Modal */}
        <UserAccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          onSuccess={handleAccountUpdateSuccess}
          employee={selectedEmployee}
        />

        {/* View Account Modal */}
        <ViewAccountModal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          employee={selectedEmployee}
        />

        {/* Admin Reset Password Modal */}
        <AdminResetPasswordModal
          isOpen={showResetPasswordModal}
          onClose={() => setShowResetPasswordModal(false)}
          onSuccess={handleResetPasswordSuccess}
          employee={selectedEmployee}
        />
      </div>
    </Layout>
  );
};

export default Employees;
