import { useState, useCallback } from 'react';

/**
 * Custom hook for managing payment processing
 * @param {Function} showToast - Function to show toast notifications
 * @param {Function} setCart - Function to set cart state
 * @param {Function} setSelectedCustomer - Function to set selected customer
 * @param {Function} setExistingOrder - Function to clear existing order
 * @returns {Object} Payment state and functions
 */
export const usePayment = (showToast, setCart, setSelectedCustomer, setExistingOrder) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  /**
   * Handle payment method selection and processing
   */
  const handlePaymentMethodSelect = useCallback(async (paymentMethod, cart, selectedCustomer, existingOrder, totals) => {
    console.log('💳 Payment method selected:', paymentMethod);
    console.log('📦 Existing order:', existingOrder ? existingOrder.orderNumber : 'None');
    console.log('🛒 Cart:', cart.length, 'items');

    try {
      // Validate cart
      if (!cart || cart.length === 0) {
        showToast('error', 'Cart is empty!');
        return;
      }

      // Validate customer
      if (!selectedCustomer) {
        showToast('error', 'Please select a customer!');
        return;
      }

      // FLOW 1: HELD ORDER (Order Already Exists)
      if (existingOrder) {
        console.log('💰 Processing payment for HELD order:', existingOrder.orderNumber);

        const posToken = localStorage.getItem('posToken');
        if (!posToken) {
          throw new Error('POS token not found. Please login again.');
        }

        const paymentData = {
          orderId: existingOrder.id || existingOrder._id,
          paymentMethod: paymentMethod,
          amountPaid: totals.total
        };

        const response = await fetch('/api/pos-login/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${posToken}`
          },
          body: JSON.stringify(paymentData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Payment failed');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || 'Payment failed');
        }

        console.log('✅ Payment successful:', result.data);

        // Close payment modal
        setShowPaymentModal(false);

        // Show invoice
        setInvoiceOrder(result.data.order);
        setShowInvoiceModal(true);

        showToast('success', 'Payment completed successfully!');
      }
      // FLOW 2: NEW ORDER
      else {
        console.log('💰 Processing payment for NEW order');

        // Prepare order items
        const orderItems = cart.map(item => {
          const orderItem = {
            product: item.productId || item.id,
            productCode: item.productCode,
            quantity: item.quantity,
            unitPrice: item.price
          };

          if (item.batch) {
            orderItem.batch = item.batch.id;
            orderItem.batchCode = item.batch.batchCode;
          }

          return orderItem;
        });

        const customerId = selectedCustomer?.id === 'virtual-guest'
          ? 'virtual-guest'
          : selectedCustomer?.id || 'virtual-guest';

        const orderData = {
          customer: customerId,
          items: orderItems,
          deliveryType: 'pickup',
          shippingFee: 0,
          paymentMethod: paymentMethod,
          amountPaid: totals.total
        };

        const posToken = localStorage.getItem('posToken');
        if (!posToken) {
          throw new Error('POS token not found. Please login again.');
        }

        const response = await fetch('/api/pos-login/order-with-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${posToken}`
          },
          body: JSON.stringify(orderData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Order creation failed');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || 'Order creation failed');
        }

        console.log('✅ Order created with payment:', result.data);

        // Close payment modal
        setShowPaymentModal(false);

        // Show invoice
        setInvoiceOrder(result.data.order);
        setShowInvoiceModal(true);

        showToast('success', 'Order created successfully!');
      }
    } catch (error) {
      console.error('❌ Payment error:', error);
      setShowPaymentModal(false);

      const errorMessage = error.response?.data?.error?.message
        || error.error?.message
        || error.message
        || 'Failed to process payment';

      showToast('error', errorMessage);
      alert(`Payment failed: ${errorMessage}`);
    }
  }, [showToast, setShowPaymentModal, setShowInvoiceModal, setInvoiceOrder]);

  /**
   * Handle invoice completion
   */
  const handleInvoiceComplete = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setExistingOrder(null);
    setShowInvoiceModal(false);
    setInvoiceOrder(null);
    showToast('success', 'Order completed successfully!');
  }, [setCart, setSelectedCustomer, setExistingOrder, showToast]);

  return {
    showPaymentModal,
    setShowPaymentModal,
    showInvoiceModal,
    setShowInvoiceModal,
    invoiceOrder,
    setInvoiceOrder,
    handlePaymentMethodSelect,
    handleInvoiceComplete
  };
};
