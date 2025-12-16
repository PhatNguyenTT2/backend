import { useState, useCallback } from 'react';

/**
 * Custom hook for managing orders (hold, load, existing order state)
 * @param {Function} showToast - Function to show toast notifications
 * @param {Function} setCart - Function to set cart state
 * @param {Function} setSelectedCustomer - Function to set selected customer
 * @returns {Object} Orders state and functions
 */
export const useOrders = (showToast, setCart, setSelectedCustomer) => {
  const [existingOrder, setExistingOrder] = useState(null);
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);

  /**
   * Hold current order (save as draft)
   */
  const handleHoldOrder = useCallback(async (cart, selectedCustomer, currentEmployee) => {
    if (cart.length === 0) {
      showToast('error', 'Cart is empty!');
      return;
    }

    if (!currentEmployee) {
      showToast('error', 'Employee information not found!');
      return;
    }

    try {
      console.log('🔄 Hold Order - Processing cart:', cart);

      // Prepare order items from cart
      const orderItems = cart.map(item => {
        const orderItem = {
          product: item.productId || item.id,
          productCode: item.productCode,
          quantity: item.quantity,
          unitPrice: item.price
        };

        // Include batch info for FRESH products
        if (item.batch) {
          orderItem.batch = item.batch.id;
          orderItem.batchCode = item.batch.batchCode;
        }

        return orderItem;
      });

      // Get customer ID
      const customerId = selectedCustomer?.id === 'virtual-guest'
        ? 'virtual-guest'
        : selectedCustomer?.id || 'virtual-guest';

      console.log('👤 Customer:', customerId);

      // Prepare order data
      const orderData = {
        customer: customerId,
        items: orderItems,
        deliveryType: 'pickup',
        shippingFee: 0,
        status: 'draft',
        paymentStatus: 'pending'
      };

      console.log('📝 Creating hold order:', JSON.stringify(orderData, null, 2));

      // Get POS token
      const posToken = localStorage.getItem('posToken');
      if (!posToken) {
        throw new Error('POS token not found. Please login again.');
      }

      // Call POS API
      const response = await fetch('/api/pos-login/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${posToken}`
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to hold order');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to hold order');
      }

      console.log('✅ Hold order created:', result.data.order);

      // Clear cart and show success
      setCart([]);
      setSelectedCustomer(null);
      showToast('success', `Order ${result.data.order.orderNumber} saved as draft!`);

      return result.data.order;
    } catch (error) {
      console.error('❌ Error holding order:', error);
      showToast('error', error.message || 'Failed to hold order');
      throw error;
    }
  }, [showToast, setCart, setSelectedCustomer]);

  /**
   * Load held order to cart
   */
  const handleLoadHeldOrder = useCallback(async (order, currentCart) => {
    try {
      console.log('📥 Loading held order:', order.orderNumber);

      // Check if current cart has items
      if (currentCart.length > 0) {
        if (!window.confirm('Current cart will be replaced. Continue?')) {
          return;
        }
      }

      // Clear current cart
      setCart([]);

      // Set customer from order
      if (order.customer) {
        setSelectedCustomer({
          id: order.customer._id || order.customer.id,
          name: order.customer.name || 'Guest',
          customerType: order.customer.customerType || 'guest'
        });
      }

      // Helper: Parse price
      const parsePrice = (price) => {
        if (price === null || price === undefined) return 0;
        if (typeof price === 'object' && price !== null) {
          return parseFloat(price.$numberDecimal || price.toString()) || 0;
        }
        const parsed = parseFloat(price);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Convert order details to cart items
      const cartItems = [];

      for (const detail of order.details || []) {
        const product = detail.product;
        const unitPrice = parsePrice(detail.unitPrice);

        const cartItem = {
          id: detail.batch ? `${product._id || product.id}-${detail.batch._id || detail.batch.id}` : (product._id || product.id),
          productId: product._id || product.id,
          productCode: product.productCode || detail.productCode,
          name: product.name,
          image: product.image,
          price: unitPrice,
          quantity: detail.quantity,
          stock: detail.batch?.quantity || product.inventory?.quantityAvailable || 0,
          categoryName: product.category?.name || 'Uncategorized'
        };

        // Include batch info if present
        if (detail.batch) {
          cartItem.batch = {
            id: detail.batch._id || detail.batch.id,
            batchCode: detail.batch.batchCode || detail.batchCode,
            expiryDate: detail.batch.expiryDate,
            availableQty: detail.batch.quantity || 0,
            unitPrice: unitPrice
          };
        }

        cartItems.push(cartItem);
      }

      setCart(cartItems);

      // Store existing order
      setExistingOrder({
        ...order,
        id: order._id || order.id
      });

      showToast('success', `Loaded order ${order.orderNumber} to cart`);
      console.log('✅ Order loaded to cart:', cartItems);
    } catch (error) {
      console.error('❌ Error loading held order:', error);
      showToast('error', 'Failed to load order');
    }
  }, [showToast, setCart, setSelectedCustomer]);

  return {
    existingOrder,
    setExistingOrder,
    showHeldOrdersModal,
    setShowHeldOrdersModal,
    handleHoldOrder,
    handleLoadHeldOrder
  };
};
