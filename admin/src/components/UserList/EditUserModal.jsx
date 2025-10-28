import React, { useEffect, useState } from 'react';
import userService from '../../services/userService';
import roleService from '../../services/roleService';
import departmentService from '../../services/departmentService';

export const EditUserModal = ({ isOpen, onClose, user, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    role: '',
    department: ''
  });

  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  // Load roles, departments and populate form when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadRolesAndDepartments();
      setError(null);
    }
  }, [isOpen, user]);

  // Populate form after roles and departments are loaded
  useEffect(() => {
    if (isOpen && user && !loadingData && roles.length > 0) {
      console.log('Populating form with user data:', user);
      console.log('Available roles:', roles);
      console.log('Available departments:', departments);

      // Find the role ID by matching roleName
      let roleId = '';
      if (user.roleName) {
        const matchedRole = roles.find(r => r.roleName === user.roleName);
        roleId = matchedRole?.id || '';
        console.log('Matched role:', matchedRole);
      }

      // Find the department ID by matching departmentName
      let departmentId = '';
      if (user.departmentName && user.departmentName !== 'N/A') {
        const matchedDept = departments.find(d => d.departmentName === user.departmentName);
        departmentId = matchedDept?.id || '';
        console.log('Matched department:', matchedDept);
      }

      setFormData({
        email: user.email || '',
        fullName: user.fullName || '',
        role: roleId,
        department: departmentId
      });
    }
  }, [isOpen, user, loadingData, roles, departments]);

  const loadRolesAndDepartments = async () => {
    try {
      setLoadingData(true);
      const [rolesResponse, departmentsResponse] = await Promise.all([
        roleService.getRoles({ per_page: 100, is_active: true }),
        departmentService.getDepartments({ per_page: 100, is_active: true })
      ]);

      setRoles(rolesResponse.data?.roles || []);
      setDepartments(departmentsResponse.data?.departments || []);
    } catch (err) {
      console.error('Error loading roles and departments:', err);
      setError('Failed to load roles and departments');
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    // Email validation
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Invalid email format');
      return false;
    }

    // Full name validation
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return false;
    }
    if (formData.fullName.length < 3 || formData.fullName.length > 50) {
      setError('Full name must be between 3 and 50 characters');
      return false;
    }

    // Role validation
    if (!formData.role) {
      setError('Role is required');
      return false;
    }

    // Department validation (optional)
    // Department can be empty

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        email: formData.email.trim().toLowerCase(),
        fullName: formData.fullName.trim(),
        role: formData.role
      };

      // Only add department if selected
      if (formData.department) {
        payload.department = formData.department;
      } else {
        // Set to null to remove department
        payload.department = null;
      }

      const updated = await userService.updateUser(user.id, payload);
      if (onSuccess) onSuccess(updated);
      onClose && onClose();
    } catch (err) {
      console.error('Error updating user:', err);
      setError(
        err.error || err.message || 'Failed to update user. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Edit User
            </h2>
            <p className="text-[12px] font-normal font-['Poppins',sans-serif] text-gray-500 mt-1">
              Update information for: <span className="font-medium text-emerald-600">{user.username}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loadingData && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="mt-2 text-[13px] text-gray-500 font-['Poppins',sans-serif]">
                Loading...
              </p>
            </div>
          )}

          {!loadingData && (
            <>
              {/* User Information (Read-only) */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-[11px] font-medium font-['Poppins',sans-serif] text-gray-600 mb-1">
                    User Code
                  </label>
                  <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-emerald-600">
                    {user.userCode}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-medium font-['Poppins',sans-serif] text-gray-600 mb-1">
                    Username
                  </label>
                  <p className="text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529]">
                    {user.username}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="Enter full name (3-50 characters)"
                  required
                  minLength={3}
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Role and Department */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.roleName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                    Department (Optional)
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => handleChange('department', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.departmentName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info Note */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-[12px] font-medium font-['Poppins',sans-serif] text-blue-700">
                  ℹ️ Username and User Code cannot be changed. Use "Reset Password" to change the user's password.
                </p>
              </div>
            </>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.333 2.00004C11.5081 1.82494 11.716 1.68605 11.9447 1.59129C12.1735 1.49653 12.4187 1.44775 12.6663 1.44775C12.914 1.44775 13.1592 1.49653 13.3879 1.59129C13.6167 1.68605 13.8246 1.82494 13.9997 2.00004C14.1748 2.17513 14.3137 2.383 14.4084 2.61178C14.5032 2.84055 14.552 3.08575 14.552 3.33337C14.552 3.58099 14.5032 3.82619 14.4084 4.05497C14.3137 4.28374 14.1748 4.49161 13.9997 4.66671L5.33301 13.3334L1.33301 14.6667L2.66634 10.6667L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Update User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
