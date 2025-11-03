import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { EmployeeList, EmployeeListHeader } from '../components/EmployeeList';

// Mock data for demo
const mockEmployees = [
  {
    id: '1',
    userCode: 'EMP001',
    fullName: 'Nguyễn Văn An',
    phone: '0901234567',
    address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
    departmentName: 'IT Department',
    dateOfBirth: '1990-05-15'
  },
  {
    id: '2',
    userCode: 'EMP002',
    fullName: 'Trần Thị Bình',
    phone: '0912345678',
    address: '456 Lê Lợi, Quận 3, TP.HCM',
    departmentName: 'Sales',
    dateOfBirth: '1992-08-20'
  },
  {
    id: '3',
    userCode: 'EMP003',
    fullName: 'Lê Văn Cường',
    phone: '0923456789',
    address: '789 Trần Hưng Đạo, Quận 5, TP.HCM',
    departmentName: 'Marketing',
    dateOfBirth: '1988-03-10'
  },
  {
    id: '4',
    userCode: 'EMP004',
    fullName: 'Phạm Thị Dung',
    phone: '0934567890',
    address: '321 Võ Văn Tần, Quận 3, TP.HCM',
    departmentName: null,
    dateOfBirth: '1995-11-25'
  },
  {
    id: '5',
    userCode: 'EMP005',
    fullName: 'Hoàng Văn Đức',
    phone: '0945678901',
    address: '654 Pasteur, Quận 1, TP.HCM',
    departmentName: 'IT Department',
    dateOfBirth: '1991-07-18'
  },
  {
    id: '6',
    userCode: 'EMP006',
    fullName: 'Vũ Thị Hoa',
    phone: '0956789012',
    address: '987 Hai Bà Trưng, Quận 1, TP.HCM',
    departmentName: 'HR',
    dateOfBirth: '1993-09-05'
  },
  {
    id: '7',
    userCode: 'EMP007',
    fullName: 'Đặng Văn Khoa',
    phone: '0967890123',
    address: '147 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM',
    departmentName: 'Sales',
    dateOfBirth: '1989-12-30'
  },
  {
    id: '8',
    userCode: 'EMP008',
    fullName: 'Ngô Thị Lan',
    phone: '0978901234',
    address: '258 Cộng Hòa, Quận Tân Bình, TP.HCM',
    departmentName: 'Finance',
    dateOfBirth: '1994-04-22'
  }
];

const mockDepartments = [
  { id: 'dept1', departmentName: 'IT Department' },
  { id: 'dept2', departmentName: 'Sales' },
  { id: 'dept3', departmentName: 'Marketing' },
  { id: 'dept4', departmentName: 'HR' },
  { id: 'dept5', departmentName: 'Finance' }
];

export const Employees = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Employees', href: null },
  ];

  const [employees, setEmployees] = useState(mockEmployees);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('userCode');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Handle sort
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
    console.log('Search query:', query);
    if (!query.trim()) {
      setEmployees(mockEmployees);
      return;
    }

    const filtered = mockEmployees.filter(emp =>
      emp.fullName.toLowerCase().includes(query.toLowerCase()) ||
      emp.userCode.toLowerCase().includes(query.toLowerCase()) ||
      emp.phone.includes(query)
    );
    setEmployees(filtered);
  };

  // Handle department filter
  const handleFilterByDepartment = (deptId) => {
    setSelectedDepartment(deptId);

    if (deptId === 'all') {
      setEmployees(mockEmployees);
    } else if (deptId === 'none') {
      setEmployees(mockEmployees.filter(emp => !emp.departmentName));
    } else {
      const dept = mockDepartments.find(d => d.id === deptId);
      if (dept) {
        setEmployees(mockEmployees.filter(emp => emp.departmentName === dept.departmentName));
      }
    }
  };

  // Handle add employee
  const handleAddEmployee = () => {
    console.log('Add employee clicked');
    // TODO: Open add employee modal
  };

  // Handle edit employee
  const handleEditEmployee = (employee) => {
    console.log('Edit employee:', employee);
    // TODO: Open edit employee modal
  };

  // Handle delete employee
  const handleDeleteEmployee = (employeeId) => {
    console.log('Delete employee:', employeeId);
    setEmployees(employees.filter(emp => emp.id !== employeeId));
    // TODO: Call API to delete employee
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Employee List Header */}
        <EmployeeListHeader
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearch}
          onAddEmployee={handleAddEmployee}
          onFilterByDepartment={handleFilterByDepartment}
          departments={mockDepartments}
        />

        {/* Employee List */}
        <EmployeeList
          employees={employees}
          onEdit={handleEditEmployee}
          onDelete={handleDeleteEmployee}
          onSort={handleSort}
          sortField={sortField}
          sortOrder={sortOrder}
        />

        {/* Results Summary */}
        {employees.length > 0 && (
          <div className="text-center text-sm text-gray-600 font-['Poppins',sans-serif]">
            Showing {employees.length} of {mockEmployees.length} employees
          </div>
        )}

        {/* Empty State */}
        {employees.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 text-[14px] font-['Poppins',sans-serif]">
              No employees found
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Employees;
