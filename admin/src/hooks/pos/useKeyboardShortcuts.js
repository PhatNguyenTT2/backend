import { useEffect } from 'react';

/**
 * Custom hook for managing keyboard shortcuts in POS
 * @param {Object} handlers - Object containing handler functions
 * @param {number} cartLength - Current cart items count
 * @param {boolean} showPaymentModal - Payment modal visibility state
 */
export const useKeyboardShortcuts = ({
  onLogout,
  onClearCart,
  onHoldOrder,
  onCheckout,
  cartLength = 0,
  showPaymentModal = false
}) => {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('product-search')?.focus();
      }

      // Ctrl/Cmd + L: Logout
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        onLogout?.();
      }

      // Ctrl/Cmd + Delete: Clear cart
      if ((e.ctrlKey || e.metaKey) && e.key === 'Delete' && cartLength > 0) {
        e.preventDefault();
        onClearCart?.();
      }

      // F2: Focus search
      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('product-search')?.focus();
      }

      // F8: Hold order
      if (e.key === 'F8' && cartLength > 0) {
        e.preventDefault();
        onHoldOrder?.();
      }

      // F9: Checkout
      if (e.key === 'F9' && cartLength > 0) {
        e.preventDefault();
        onCheckout?.();
      }

      // Escape: Close payment modal
      if (e.key === 'Escape' && showPaymentModal) {
        e.preventDefault();
        // Payment modal will handle its own close
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onLogout, onClearCart, onHoldOrder, onCheckout, cartLength, showPaymentModal]);
};
