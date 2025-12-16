import { useState, useCallback } from 'react';

/**
 * Custom hook for managing shopping cart
 * @param {Function} showToast - Function to show toast notifications
 * @param {Object} selectedCustomer - Currently selected customer
 * @param {Object} customerDiscounts - Customer discount configuration
 * @returns {Object} Cart state and functions
 */
export const useCart = (showToast, selectedCustomer, customerDiscounts) => {
  const [cart, setCart] = useState([]);

  /**
   * Add product to cart (REGULAR products only)
   * FRESH products should use batch selection
   */
  const addToCart = useCallback((product) => {
    const existingItem = cart.find(item => item.id === product.id);
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
    const availableStock = product.stock || product.inventory?.quantityAvailable || 0;

    // Check if product has stock on shelf
    const onShelfQuantity = product.inventory?.quantityOnShelf || 0;
    if (onShelfQuantity <= 0) {
      showToast('error', `${product.name} is not available on shelf!`);
      return;
    }

    if (currentQuantityInCart >= availableStock) {
      showToast('error', `Not enough stock. Available: ${availableStock}`);
      return;
    }

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
      showToast('success', `Updated ${product.name} quantity`);
    } else {
      // Calculate final price with discount
      const basePrice = product.unitPrice || product.price || 0;
      const discountPercentage = product.discountPercentage || 0;
      const finalPrice = discountPercentage > 0
        ? basePrice * (1 - discountPercentage / 100)
        : basePrice;

      setCart([...cart, {
        ...product,
        quantity: 1,
        basePrice: basePrice,
        discountPercentage: discountPercentage,
        price: finalPrice
      }]);
      showToast('success', `Added ${product.name} to cart`);
    }
  }, [cart, showToast]);

  /**
   * Add product with batch to cart (FRESH products)
   */
  const addProductWithBatch = useCallback((productData, batch, quantity) => {
    const { product } = productData;

    // Helper: Get batch unit price
    const getBatchPrice = (batch) => {
      if (!batch) return 0;
      const price = batch.unitPrice;
      if (price === null || price === undefined) return 0;
      if (typeof price === 'object' && price !== null) {
        return parseFloat(price.$numberDecimal || price.toString()) || 0;
      }
      const parsed = parseFloat(price);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Helper: Get batch discount percentage
    const getBatchDiscountPercentage = (batch) => {
      if (!batch) return 0;
      return batch.discountPercentage || 0;
    };

    // Helper: Get current batch price after discount
    const getCurrentBatchPrice = (batch) => {
      if (!batch) return 0;
      const basePrice = getBatchPrice(batch);
      const discountPercentage = getBatchDiscountPercentage(batch);
      if (discountPercentage > 0) {
        return basePrice * (1 - discountPercentage / 100);
      }
      return basePrice;
    };

    const batchId = batch.id || batch._id;
    const cartItemId = `${product.id}-${batchId}`;
    const batchPrice = getCurrentBatchPrice(batch);

    const cartItem = {
      id: cartItemId,
      productId: product.id,
      productCode: product.productCode,
      name: product.name,
      image: product.image,
      price: batchPrice,
      quantity: quantity,
      stock: batch.quantity || 0,
      categoryName: product.category?.name || 'Uncategorized',
      batch: {
        id: batchId,
        batchCode: batch.batchCode,
        expiryDate: batch.expiryDate,
        availableQty: batch.quantity,
        daysUntilExpiry: batch.daysUntilExpiry,
        unitPrice: getBatchPrice(batch),
        discountPercentage: getBatchDiscountPercentage(batch)
      }
    };

    const existingItem = cart.find(item => item.id === cartItemId);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      const maxQty = batch.quantity;

      if (newQuantity > maxQty) {
        showToast('error', `Cannot add ${newQuantity}. Only ${maxQty} available for batch ${batch.batchCode}`);
        return;
      }

      setCart(cart.map(item =>
        item.id === cartItemId
          ? { ...item, quantity: newQuantity }
          : item
      ));
      showToast('success', `Updated ${product.name} (${batch.batchCode}) quantity to ${newQuantity}`);
    } else {
      setCart([...cart, cartItem]);
      showToast('success', `Added ${quantity}x ${product.name} (${batch.batchCode}) to cart`);
    }
  }, [cart, showToast]);

  /**
   * Update quantity of cart item
   */
  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const cartItem = cart.find(item => item.id === productId);
    if (!cartItem) return;

    const availableStock = cartItem.batch?.availableQty || cartItem.stock || 0;

    if (newQuantity > availableStock) {
      showToast('error', `Not enough stock. Available: ${availableStock}`);
      return;
    }

    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  }, [cart, showToast]);

  /**
   * Remove item from cart
   */
  const removeFromCart = useCallback((productId) => {
    setCart(cart.filter(item => item.id !== productId));
  }, [cart]);

  /**
   * Clear entire cart
   */
  const clearCart = useCallback(() => {
    if (window.confirm('Clear all items from cart?')) {
      setCart([]);
      return true;
    }
    return false;
  }, []);

  /**
   * Calculate cart totals
   */
  const calculateTotals = useCallback(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount based on customer type
    const discountPercentage = selectedCustomer
      ? (customerDiscounts[selectedCustomer.customerType] || 0)
      : 0;
    const discount = subtotal * (discountPercentage / 100);

    const shippingFee = 0; // POS always pickup = no shipping
    const total = subtotal - discount + shippingFee;

    return {
      subtotal,
      discount,
      discountPercentage,
      shippingFee,
      total
    };
  }, [cart, selectedCustomer, customerDiscounts]);

  const totals = calculateTotals();

  return {
    cart,
    setCart,
    totals,
    addToCart,
    addProductWithBatch,
    updateQuantity,
    removeFromCart,
    clearCart
  };
};
