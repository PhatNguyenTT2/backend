import { useState, useCallback } from 'react';
import productService from '../../services/productService';

/**
 * Custom hook for managing QR code scanning
 * @param {Function} showToast - Function to show toast notifications
 * @param {Function} addToCart - Function to add product to cart
 * @param {Function} openBatchSelection - Function to open batch selection modal
 * @param {Function} requiresBatchSelection - Function to check if product requires batch selection
 * @param {Function} setSearchTerm - Function to clear search term
 * @returns {Object} QR scanner state and functions
 */
export const useQRScanner = (showToast, addToCart, openBatchSelection, requiresBatchSelection, setSearchTerm) => {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanning, setScanning] = useState(false);

  /**
   * Handle product code scanned (from QR or keyboard)
   */
  const handleProductScanned = useCallback(async (productCode) => {
    console.log('ProductCode scanned:', productCode);
    setScanning(true);

    try {
      // Get product by productCode with inventory and batches
      const response = await productService.getProductByCode(productCode, {
        withInventory: true,
        withBatches: true,
        isActive: true
      });

      if (!response.success) {
        showToast('error', 'Failed to scan product. Please try again.');
        return;
      }

      const { product, batches, outOfStock } = response.data;

      // Check if out of stock
      if (outOfStock || !batches || batches.length === 0) {
        showToast('error', `${product.name} is currently out of stock!`);
        return;
      }

      // Check if product is FRESH (requires batch selection)
      const isFresh = requiresBatchSelection(product);

      if (isFresh) {
        // FRESH PRODUCT: Show batch selection modal
        const availableBatches = batches.filter(batch => {
          const qty = batch.detailInventory?.quantityOnShelf || batch.quantityOnShelf || batch.quantity || 0;
          return qty > 0;
        });

        console.log('📦 Scanned FRESH product - Total batches:', batches.length, '→ Available on shelf:', availableBatches.length);

        if (availableBatches.length === 0) {
          showToast('error', `${product.name} has no batches available on shelf!`);
          return;
        }

        // Open batch selection with the product data
        await openBatchSelection(product);
      } else {
        // REGULAR PRODUCT: Add directly to cart
        const existingItem = null; // Will be checked in addToCart
        const availableStock = product.inventory?.quantityAvailable || 0;
        const onShelfQuantity = product.inventory?.quantityOnShelf || 0;

        if (onShelfQuantity <= 0) {
          showToast('error', `${product.name} is not available on shelf!`);
          return;
        }

        if (availableStock <= 0) {
          showToast('error', `${product.name} is out of stock!`);
          return;
        }

        // Transform product data for cart
        const cartProduct = {
          ...product,
          id: product._id || product.id,
          price: product.unitPrice || 0,
          stock: availableStock,
          categoryName: product.category?.name || 'Uncategorized'
        };

        addToCart(cartProduct);
      }

      // Reset search term after successful scan
      setSearchTerm('');

    } catch (error) {
      console.error('Error scanning product:', error);
      if (error.response?.status === 404) {
        showToast('error', 'Product not found!');
      } else {
        showToast('error', 'Failed to scan product. Please try again.');
      }
    } finally {
      setScanning(false);
    }
  }, [showToast, addToCart, openBatchSelection, requiresBatchSelection, setSearchTerm]);

  /**
   * Handle QR scan success
   */
  const handleQRScanSuccess = useCallback((productCode) => {
    console.log('✅ QR Code scanned:', productCode);
    // Don't close scanner - allow continuous scanning
    // Use existing handler (same flow as keyboard scanning)
    handleProductScanned(productCode);
  }, [handleProductScanned]);

  /**
   * Handle QR scan error
   */
  const handleQRScanError = useCallback((error) => {
    console.error('❌ QR Scan error:', error);
    showToast('error', error);
  }, [showToast]);

  return {
    showQRScanner,
    setShowQRScanner,
    scanning,
    handleProductScanned,
    handleQRScanSuccess,
    handleQRScanError
  };
};
