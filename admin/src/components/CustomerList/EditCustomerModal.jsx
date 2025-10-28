import React, { useState, useEffect } from 'react';
import customerService from '../../services/customerService';

export const EditCustomerModal = ({ isOpen, onClose, onSuccess, customer }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    dob: '',
    gender: '',
    customerType: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill form when modal opens with customer data
  useEffect(() => {
    if (isOpen && customer) {
      setFormData({
        fullName: customer.fullName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        street: customer.address?.street || '',
        city: customer.address?.city || '',
        dob: customer.dateOfBirth ? new Date(customer.dateOfBirth).toISOString().split('T')[0] : '',
        gender: customer.gender || '',
        customerType: customer.customerType || '',
        notes: customer.notes || ''
      });
      setError(null);
    }
  }, [isOpen, customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.fullName.trim()) {
      setError('Customer name is required');
      return;
    }

    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    // Validate phone format (basic)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('Invalid phone number format');
      return;
    }

    // Email validation (if provided)
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Invalid email format');
        return;
      }
    }

    if (!formData.gender) {
      setError('Gender is required');
      return;
    }

    if (!formData.customerType) {
      setError('Customer type is required');
      return;
    }

    if (!customer?.id) {
      setError('Invalid customer');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare data
      const customerData = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        gender: formData.gender,
        customerType: formData.customerType
      };

      // Add email if provided
      if (formData.email.trim()) {
        customerData.email = formData.email.trim();
      }

      // Add address if street or city provided
      if (formData.street.trim() || formData.city.trim()) {
        customerData.address = {
          street: formData.street.trim() || '',
          city: formData.city.trim() || ''
        };
      }

      // Add date of birth if provided
      if (formData.dob) {
        customerData.dateOfBirth = formData.dob;
      }

      // Add notes if provided
      if (formData.notes.trim()) {
        customerData.notes = formData.notes.trim();
      }

      const response = await customerService.updateCustomer(customer.id, customerData);

      if (onSuccess) {
        onSuccess(response);
      }
      onClose();
    } catch (err) {
      console.error('Error updating customer:', err);
      setError(err.response?.data?.error || err.error || err.message || 'Failed to update customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Edit Customer
            </h2>
            <p className="text-[12px] text-gray-500 font-['Poppins',sans-serif] mt-1">
              Customer Code: {customer.customerCode || customer.id}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {error}
            </div>
          )}

          {/* Row 1: Name & Customer Code (read-only) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Customer Name */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="Enter customer full name"
                required
                maxLength={255}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Customer Code (Read-only) */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Customer Code
              </label>
              <input
                type="text"
                value={customer?.customerCode || customer?.id || 'N/A'}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-['Poppins',sans-serif] bg-gray-50 text-gray-600 cursor-not-allowed uppercase"
              />
              <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                Customer code cannot be modified
              </p>
            </div>
          </div>

          {/* Row 2: Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Email (Optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                For walk-in customers, email can be empty
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(123) 456-7890"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 3: Address (Street & City) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Street */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Street Address (Optional)
              </label>
              <input
                type="text"
                value={formData.street}
                onChange={(e) => handleChange('street', e.target.value)}
                placeholder="123 Main Street"
                maxLength={255}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                City (Optional)
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Ho Chi Minh"
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 4: DOB & Gender */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date of Birth */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Date of Birth (Optional)
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => handleChange('dob', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Row 5: Customer Type & Total Spent */}
          <div className="grid grid-cols-2 gap-4">
            {/* Customer Type */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Customer Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.customerType}
                onChange={(e) => handleChange('customerType', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select type</option>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="vip">VIP</option>
              </select>
            </div>

            {/* Total Spent (Read-only) */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Total Spent
              </label>
              <input
                type="text"
                value={`$${(customer?.totalSpent || 0).toFixed(2)}`}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-['Poppins',sans-serif] bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                Updated automatically with purchases
              </p>
            </div>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes about the customer (optional)"
              rows={4}
              maxLength={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                Maximum 1000 characters
              </p>
              <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                {formData.notes.length}/1000
              </p>
            </div>
          </div>

          {/* Actions */}
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
              disabled={loading}
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
                'Update Customer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
