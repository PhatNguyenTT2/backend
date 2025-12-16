import { useState } from 'react';

/**
 * Custom hook for managing toast notifications
 * @returns {Object} Toast state and control functions
 */
export const useToast = () => {
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

  /**
   * Show toast notification
   * @param {string} type - 'success' or 'error'
   * @param {string} message - Toast message
   */
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  return {
    toast,
    showToast
  };
};
