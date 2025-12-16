import { useState, useCallback } from 'react';
import productService from '../../services/productService';

/**
 * Custom hook for managing batch selection (FRESH products)
 * @param {Function} showToast - Function to show toast notifications
 * @param {Function} addProductWithBatch - Function to add product with batch to cart
 * @returns {Object} Batch selection state and functions
 */
export const useBatchSelection = (showToast, addProductWithBatch) => {
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);
  const [scanning, setScanning] = useState(false);

  /**
   * Check if product requires batch selection (FRESH products)
   */
  const requiresBatchSelection = useCallback((product) => {
    return product.categoryName?.toLowerCase().includes('fresh') ||
      product.category?.name?.toLowerCase().includes('fresh');
  }, []);

  /**
   * Open batch selection modal for product
   */
  const openBatchSelection = useCallback(async (product) => {
    setScanning(true);
    try {
      const response = await productService.getProductByCode(product.productCode, {
        withInventory: true,
        withBatches: true,
        isActive: true
      });

      if (!response.success) {
        showToast('error', 'Failed to load product batches.');
        return;
      }

      const { batches, outOfStock } = response.data;

      if (outOfStock || !batches || batches.length === 0) {
        showToast('error', `${product.name} is currently out of stock!`);
        return;
      }

      // Filter batches with quantity > 0
      const availableBatches = batches.filter(batch => {
        const qty = batch.detailInventory?.quantityOnShelf || batch.quantityOnShelf || batch.quantity || 0;
        return qty > 0;
      });

      console.log('📦 Total batches:', batches.length, '→ Available on shelf:', availableBatches.length);

      if (availableBatches.length === 0) {
        showToast('error', `${product.name} has no batches available on shelf!`);
        return;
      }

      setSelectedProductData({
        ...response.data,
        batches: availableBatches
      });
      setShowBatchModal(true);
    } catch (error) {
      console.error('Error loading batches:', error);
      showToast('error', 'Failed to load product batches.');
    } finally {
      setScanning(false);
    }
  }, [showToast]);

  /**
   * Handle batch selected from modal
   */
  const handleBatchSelected = useCallback((selectedBatch, quantity) => {
    if (selectedProductData && addProductWithBatch) {
      addProductWithBatch(selectedProductData, selectedBatch, quantity);
    }
    setShowBatchModal(false);
    setSelectedProductData(null);
  }, [selectedProductData, addProductWithBatch]);

  /**
   * Close batch selection modal
   */
  const closeBatchSelection = useCallback(() => {
    setShowBatchModal(false);
    setSelectedProductData(null);
  }, []);

  return {
    showBatchModal,
    selectedProductData,
    scanning,
    setScanning,
    requiresBatchSelection,
    openBatchSelection,
    handleBatchSelected,
    closeBatchSelection
  };
};
