import { useState, useEffect } from 'react';
import customerDiscountSettingsService from '../../services/customerDiscountSettingsService';

/**
 * Custom hook for managing customer selection and discounts
 * @returns {Object} Customer state and functions
 */
export const useCustomer = () => {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDiscounts, setCustomerDiscounts] = useState({
    guest: 0,      // Walk-in customers: 0% discount (loaded from backend)
    retail: 10,    // Default: 10% (will be overwritten by backend config)
    wholesale: 15, // Default: 15% (will be overwritten by backend config)
    vip: 20        // Default: 20% (will be overwritten by backend config)
  });

  // Load discount configuration from backend
  useEffect(() => {
    const fetchDiscountConfig = async () => {
      try {
        const response = await customerDiscountSettingsService.getActiveDiscounts();
        if (response.success && response.data) {
          const discountConfig = {
            guest: response.data.guestDiscount || 0,
            retail: response.data.retailDiscount || 10,
            wholesale: response.data.wholesaleDiscount || 15,
            vip: response.data.vipDiscount || 20
          };
          console.log('✅ Customer discount configuration loaded:', discountConfig);
          setCustomerDiscounts(discountConfig);
        }
      } catch (error) {
        console.error('❌ Error fetching discount configuration:', error);
        // Keep default values if fetch fails
      }
    };

    fetchDiscountConfig();
  }, []);

  return {
    selectedCustomer,
    setSelectedCustomer,
    customerDiscounts
  };
};
