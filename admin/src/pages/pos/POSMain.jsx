import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import posLoginService from '../../services/posLoginService';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import customerDiscountSettingsService from '../../services/customerDiscountSettingsService';
import {
  POSHeader,
  POSSearchBar,
  POSCategoryFilter,
  POSProductGrid,
  POSCart,
  POSPaymentModal,
  POSLoadingScreen,
  POSCustomerSelector,
  POSInvoiceModal,
  POSStoreMapModal
} from '../../components/POSMain';
import { POSBatchSelectModal } from '../../components/POSMain/POSBatchSelectModal';
import { POSHeldOrdersModal } from '../../components/POSMain/POSHeldOrdersModal';
import { QRCodeScannerModal } from '../../components/POSMain/QRCodeScannerModal';
import { VNPayReturnHandler } from '../../components/VNPayReturnHandler';
import orderService from '../../services/orderService';
import orderDetailService from '../../services/orderDetailService';
import paymentService from '../../services/paymentService';
import vnpayService from '../../services/vnpayService';

export const POSMain = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Customer state
  // Note: selectedCustomer can be:
  // 1. Virtual guest (id: 'virtual-guest', customerType: 'guest') - for walk-in customers
  // 2. Real customer from database (customerType: 'retail'/'wholesale'/'vip')
  // When creating order, backend will handle guest customer creation if needed
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDiscounts, setCustomerDiscounts] = useState({
    guest: 0,      // Walk-in customers: 0% discount (loaded from backend)
    retail: 10,    // Default: 10% (will be overwritten by backend config)
    wholesale: 15, // Default: 15% (will be overwritten by backend config)
    vip: 20        // Default: 20% (will be overwritten by backend config)
  });

  // Batch selection modal state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);
  const [scanning, setScanning] = useState(false);

  // QR Scanner modal state
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Held orders modal state
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);

  // Invoice modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  // Existing order state (from held order)
  const [existingOrder, setExistingOrder] = useState(null);

  // VNPay state
  const [vnpayProcessing, setVnpayProcessing] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

  // Store Map modal state
  const [showStoreMap, setShowStoreMap] = useState(false);

  // Handle batch selection from Map
  const handleMapBatchSelect = async (batch) => {
    // We need to fetch full product details to add to cart properly
    // batch object from map might be partial (populated from StoreLocation)
    // format from map: { batchCode, product: { _id, name, productCode }, quantity, ... }

    // Check if we have productCode
    const productCode = batch.product?.productCode;
    if (!productCode) {
      showToast('error', 'Invalid product data on map');
      return;
    }

    try {
      // Re-use logic to fetch full product data
      const response = await productService.getProductByCode(productCode, {
        withInventory: true,
        withBatches: true,
        isActive: true
      });

      if (!response.success) {
        showToast('error', 'Failed to load product details');
        return;
      }

      const { product, inventory } = response.data;

      // Ensure specific batch data is complete
      // We might need to find the specific batch from response.data.batches to get price/expiry etc if map data is missing it
      // But let's assume map data has what we need or we find it.

      // The batch from map (batch) has: batchCode, product, expiryDate, quantity
      // We need price info which might be on ProductBatch model, but StoreLocation population might be partial.
      // Safest is to find this batch in response.data.batches
      const fullBatch = response.data.batches?.find(b => b.batchCode === batch.batchCode);

      if (!fullBatch) {
        showToast('error', 'Batch details not found');
        return;
      }

      // Add 1 item
      handleAddProductWithBatch(response.data, fullBatch, 1);

    } catch (err) {
      console.error('Error adding from map:', err);
      showToast('error', 'Failed to add item');
    }
  };

  // Load employee and verify session
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);

      if (!posLoginService.isLoggedIn()) {
        navigate('/pos-login');
        return;
      }

      try {
        const result = await posLoginService.verifySession();

        if (!result.success) {
          console.error('Session verification failed:', result.error);
          navigate('/pos-login');
          return;
        }

        const employee = posLoginService.getCurrentEmployee();
        setCurrentEmployee(employee);
      } catch (error) {
        console.error('Session verification error:', error);
        navigate('/pos-login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // Load categories and discount configuration from backend
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoryService.getActiveCategories();

        // Backend returns: { success: true, data: { categories: [...], pagination: {...} } }
        const categoriesData = response.data?.categories || [];

        const allCategories = [
          { _id: 'all', id: 'all', name: 'All Products', categoryCode: 'ALL' },
          ...categoriesData.map(cat => ({
            ...cat,
            id: cat._id || cat.id
          }))
        ];

        setCategories(allCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories([{ _id: 'all', id: 'all', name: 'All Products', categoryCode: 'ALL' }]);
      }
    };

    const fetchDiscountConfig = async () => {
      try {
        const response = await customerDiscountSettingsService.getActiveDiscounts();
        if (response.success && response.data) {
          setCustomerDiscounts({
            guest: 0, // Guest customers always 0% discount
            retail: response.data.retail || 10,
            wholesale: response.data.wholesale || 15,
            vip: response.data.vip || 20
          });
          console.log('✅ Loaded customer discount configuration:', response.data);
        }
      } catch (error) {
        console.error('❌ Error fetching discount configuration:', error);
        // Keep default values if fetch fails
      }
    };

    fetchCategories();
    fetchDiscountConfig();
  }, []);

  // Load products from backend (with filters)
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const filters = {
          isActive: true,
          withInventory: true  // Request inventory data
        };

        if (selectedCategory !== 'all') {
          filters.category = selectedCategory;
        }

        if (searchTerm.trim()) {
          filters.search = searchTerm.trim();
        }

        const response = await productService.getAllProducts(filters);

        // Backend returns: { success: true, data: { products: [...], pagination: {...} } }
        const productsData = response.data?.products || [];

        const transformedProducts = productsData.map(product => ({
          ...product,
          id: product._id || product.id,
          price: product.unitPrice || 0,
          stock: product.inventory?.quantityAvailable || 0,
          categoryName: product.category?.name || 'Uncategorized'
        }));

        setProducts(transformedProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, searchTerm]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Periodic session verification (every 5 minutes)
  useEffect(() => {
    const verifyInterval = setInterval(async () => {
      if (posLoginService.isLoggedIn()) {
        const result = await posLoginService.verifySession();
        if (!result.success) {
          console.error('Session expired or revoked');
          alert('Your session has expired. Please login again.');
          navigate('/pos-login');
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(verifyInterval);
  }, [navigate]);

  // ========================================
  // KEYBOARD SHORTCUTS
  // ========================================
  // Ctrl+K     - Focus search field
  // Ctrl+L     - Logout
  // Ctrl+Del   - Clear cart
  // F2         - Open QR Code Scanner
  // F4         - Open Held Orders Modal
  // F8         - Hold Order (save as draft)
  // F9         - Payment (checkout flow)
  // Escape     - Close modals
  // ========================================
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl+K: Focus search field
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('product-search')?.focus();
      }

      // Ctrl+L: Logout
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        handleLogout();
      }

      // Ctrl+Delete: Clear cart
      if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
        e.preventDefault();
        document.getElementById('pos-clear-cart-btn')?.click();
      }

      // F2: Open QR Code Scanner
      if (e.key === 'F2') {
        e.preventDefault();
        setShowQRScanner(true);
      }

      // F4: Open Held Orders Modal
      if (e.key === 'F4') {
        e.preventDefault();
        setShowHeldOrdersModal(true);
      }

      // F8: Hold Order (save as draft) - Click button to ensure same logic
      if (e.key === 'F8') {
        e.preventDefault();
        document.getElementById('pos-hold-order-btn')?.click();
      }

      // F9: Payment (checkout flow) - Click button to ensure same logic
      if (e.key === 'F9') {
        e.preventDefault();
        document.getElementById('pos-checkout-btn')?.click();
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showPaymentModal) setShowPaymentModal(false);
        if (showQRScanner) setShowQRScanner(false);
        if (showHeldOrdersModal) setShowHeldOrdersModal(false);
        if (showBatchModal) setShowBatchModal(false);
        if (showInvoiceModal) setShowInvoiceModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showPaymentModal, showQRScanner, showHeldOrdersModal, showBatchModal, showInvoiceModal]);

  // Add to cart with stock validation
  const addToCart = async (product) => {
    // Check if product is FRESH (requires batch selection)
    const isFresh = product.categoryName?.toLowerCase().includes('fresh') ||
      product.category?.name?.toLowerCase().includes('fresh');

    if (isFresh) {
      // FRESH PRODUCT: Fetch batches and show selection modal
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

        // Filter batches with quantity > 0 (ProductBatch.quantity field)
        // Note: /api/products/code/:productCode returns batches with quantity field, not detailInventory
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
          batches: availableBatches // Only pass batches with stock on shelf
        });
        setShowBatchModal(true);
      } catch (error) {
        console.error('Error loading batches:', error);
        showToast('error', 'Failed to load product batches.');
      } finally {
        setScanning(false);
      }
    } else {
      // REGULAR PRODUCT: Add directly to cart (simple increment logic)
      // Backend will handle FEFO batch selection when creating order
      const availableStock = product.stock || product.inventory?.quantityAvailable || 0;

      // Check if product has stock on shelf (same check as ProductGrid filter)
      const onShelfQuantity = product.inventory?.quantityOnShelf || 0;
      if (onShelfQuantity <= 0) {
        showToast('error', `${product.name} is not available on shelf!`);
        return;
      }

      // Calculate final price with discount (outside cart update)
      const basePrice = product.unitPrice || product.price || 0;
      const discountPercentage = product.discountPercentage || 0;
      const finalPrice = discountPercentage > 0
        ? basePrice * (1 - discountPercentage / 100)
        : basePrice;

      // Use functional update to avoid stale closure issue
      setCart(prevCart => {
        // ⚠️ CRITICAL: Normalize ID early to ensure consistent cart item matching
        const normalizedId = product._id || product.id;

        const existingItem = prevCart.find(item => item.id === normalizedId);
        const currentQuantityInCart = existingItem ? existingItem.quantity : 0;

        // Check stock availability
        if (currentQuantityInCart >= availableStock) {
          showToast('error', `Not enough stock. Available: ${availableStock}`);
          return prevCart; // Return unchanged cart
        }

        if (existingItem) {
          // Update existing item quantity
          showToast('success', `Updated ${product.name} quantity`);
          return prevCart.map(item =>
            item.id === normalizedId
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          // Add new item to cart
          showToast('success', `Added ${product.name} to cart`);
          return [...prevCart, {
            ...product,
            id: normalizedId,          // Ensure id is normalized
            productId: normalizedId,   // ⭐ Explicitly set productId for checkout
            quantity: 1,
            basePrice: basePrice, // Store original price
            discountPercentage: discountPercentage, // Store discount percentage
            price: finalPrice // Store final price after discount
          }];
        }
      });
    }
  };

  // Handle productCode scanned
  const handleProductScanned = async (productCode) => {
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

      const { product, inventory, batches, outOfStock } = response.data;

      // Check if out of stock
      if (outOfStock || !batches || batches.length === 0) {
        showToast('error', `${product.name} is currently out of stock!`);
        return;
      }

      // Check if product is FRESH (only category name contains 'fresh')
      // Fresh products require manual batch selection at POS
      const isFresh = product.category?.name?.toLowerCase().includes('fresh');

      if (isFresh) {
        // FRESH PRODUCT: Show batch selection modal for manual selection
        // Staff can choose any batch and see different prices if there are promotions

        // Filter batches with quantity > 0 (ProductBatch.quantity field)
        // Note: /api/products/code/:productCode returns batches with quantity field, not detailInventory
        const availableBatches = batches.filter(batch => {
          const qty = batch.detailInventory?.quantityOnShelf || batch.quantityOnShelf || batch.quantity || 0;
          return qty > 0;
        });

        console.log('📦 Scanned FRESH product - Total batches:', batches.length, '→ Available on shelf:', availableBatches.length);

        if (availableBatches.length === 0) {
          showToast('error', `${product.name} has no batches available on shelf!`);
          return;
        }

        setSelectedProductData({
          ...response.data,
          batches: availableBatches // Only pass batches with stock on shelf
        });
        setShowBatchModal(true);
      } else {
        // REGULAR PRODUCT: Add directly to cart (NO batch selection)
        // Backend will handle FEFO (First Expired First Out) batch selection when creating order
        // This is same logic as clicking product card for regular products

        // Normalize product data (ensure id field exists)
        const productId = product._id || product.id;
        const availableStock = product.stock || inventory?.quantityAvailable || 0;

        // Check if product has stock on shelf
        const onShelfQuantity = inventory?.quantityOnShelf || 0;
        if (onShelfQuantity <= 0) {
          showToast('error', `${product.name} is not available on shelf!`);
          return;
        }

        // Calculate final price with discount (SAME logic as ProductGrid click)
        // Backend API now calculates discountPercentage from FEFO batch
        const basePrice = product.unitPrice || product.price || 0;
        const discountPercentage = product.discountPercentage || 0;
        const finalPrice = discountPercentage > 0
          ? basePrice * (1 - discountPercentage / 100)
          : basePrice;

        // Use functional update to avoid stale closure issue
        setCart(prevCart => {
          const existingItem = prevCart.find(item => item.id === productId);
          const currentQuantityInCart = existingItem ? existingItem.quantity : 0;

          // Check if enough stock for current quantity
          if (currentQuantityInCart >= availableStock) {
            showToast('error', `Not enough stock. Available: ${availableStock}`);
            return prevCart; // Return unchanged cart
          }

          if (existingItem) {
            // Update existing item quantity
            showToast('success', `Updated ${product.name} quantity`);
            return prevCart.map(item =>
              item.id === productId
                ? { ...item, quantity: item.quantity + 1 }
                : item
            );
          } else {
            // Add new item to cart (normalize structure)
            showToast('success', `Added ${product.name} to cart`);
            return [...prevCart, {
              id: productId,
              productId: productId,
              productCode: product.productCode,
              name: product.name,
              image: product.image,
              stock: availableStock,
              categoryName: product.category?.name || 'Uncategorized',
              quantity: 1,
              basePrice: basePrice, // Store original price
              discountPercentage: discountPercentage, // Store discount percentage
              price: finalPrice, // Store final price after discount
              inventory: inventory // Store full inventory data
            }];
          }
        });
      }

      // Reset search term after successful scan
      setSearchTerm('');

    } catch (error) {
      console.error('Error scanning product:', error);
      if (error.response?.status === 404) {
        showToast('error', `Product not found: ${productCode}`);
      } else {
        showToast('error', 'Failed to scan product. Please try again.');
      }
    } finally {
      setScanning(false);
    }
  };

  // Show toast notification
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Handle QR scan success
  const handleQRScanSuccess = (productCode) => {
    // setShowQRScanner(false); // ❌ REMOVED: Keep scanner open for continuous scanning

    // Note: Cooldown logic is now handled in QRCodeScannerModal component
    // This prevents continuous scanning at the camera level before reaching POSMain

    // Use existing handler (same flow as keyboard scanning)
    handleProductScanned(productCode);
  };

  // Handle QR scan error
  const handleQRScanError = (error) => {
    console.error('❌ QR Scan error:', error);
    showToast('error', error);
  };

  // Handle batch selected from modal
  const handleBatchSelected = (selectedBatch, quantity) => {
    handleAddProductWithBatch(selectedProductData, selectedBatch, quantity);
    setShowBatchModal(false);
    setSelectedProductData(null);
  };

  // Add product with batch info to cart
  const handleAddProductWithBatch = (productData, batch, quantity) => {
    const { product, inventory } = productData;


    // Helper: Get batch unit price (handle Decimal128)
    const getBatchPrice = (batch) => {
      if (!batch) return 0;
      const price = batch.unitPrice;
      if (price === null || price === undefined) return 0;
      if (typeof price === 'object' && price !== null) {
        if (price.$numberDecimal) return parseFloat(price.$numberDecimal);
        return parseFloat(price.toString());
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

    // Get batch ID (handle both id and _id)
    const batchId = batch.id || batch._id;

    // CRITICAL: For FRESH products with batch selection, ALWAYS use product-batch combo as ID
    // This ensures each batch creates a separate cart item
    const cartItemId = `${product.id}-${batchId}`;

    // Get current price from batch (with discount applied)
    const batchPrice = getCurrentBatchPrice(batch);



    const cartItem = {
      id: cartItemId,
      productId: product.id,
      productCode: product.productCode,
      name: product.name,
      image: product.image,
      price: batchPrice, // Use batch price after discount
      quantity: quantity,
      stock: batch.quantity || inventory?.quantityAvailable || 0, // Use batch quantity for stock
      categoryName: product.category?.name || 'Uncategorized',

      // Batch info (required for FRESH products)
      batch: {
        id: batchId, // Use normalized batch ID
        batchCode: batch.batchCode,
        expiryDate: batch.expiryDate,
        availableQty: batch.quantity,
        daysUntilExpiry: batch.daysUntilExpiry,
        unitPrice: getBatchPrice(batch), // Original price
        discountPercentage: getBatchDiscountPercentage(batch) // Discount if any
      }
    };

    // Use functional update to avoid stale closure issue
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === cartItemId);

      if (existingItem) {
        // Update quantity for existing batch
        const newQuantity = existingItem.quantity + quantity;
        const maxQty = batch.quantity;

        if (newQuantity > maxQty) {
          showToast('error', `Not enough stock for batch ${batch.batchCode}. Available: ${maxQty}`);
          return prevCart; // Return unchanged cart
        }

        showToast('success', `Updated ${product.name} (${batch.batchCode}) quantity to ${newQuantity}`);
        return prevCart.map(item =>
          item.id === cartItemId
            ? { ...item, quantity: newQuantity }
            : item
        );
      } else {
        // Add new cart item for this batch
        showToast('success', `Added ${quantity}x ${product.name} (${batch.batchCode}) to cart`);
        return [...prevCart, cartItem];
      }
    });
  };

  // Update quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const cartItem = cart.find(item => item.id === productId);
    if (!cartItem) return;

    const availableStock = cartItem.batch?.availableQty || cartItem.stock || cartItem.inventory?.quantityAvailable || 0;

    if (newQuantity > availableStock) {
      showToast('error', `Not enough stock. Available: ${availableStock}`);
      return;
    }

    setCart(prevCart => prevCart.map(item =>
      item.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  // Remove from cart
  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    if (window.confirm('Clear all items from cart?')) {
      setCart([]);
      setExistingOrder(null); // Clear existing order when clearing cart
    }
  };

  // Calculate totals
  const calculateTotals = () => {
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
  };

  // Handle logout
  const handleLogout = async () => {
    if (cart.length > 0) {
      if (!window.confirm('You have items in cart. Are you sure you want to logout?')) {
        return;
      }
    }

    try {
      await posLoginService.logout();
      navigate('/pos-login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/pos-login');
    }
  };

  // Handle hold order (save as draft)
  const handleHoldOrder = async () => {
    if (cart.length === 0) {
      showToast('error', 'Cart is empty!');
      return;
    }

    if (!currentEmployee) {
      showToast('error', 'Employee information not found!');
      return;
    }

    try {
      setLoading(true);

      // Prepare order items from cart
      // Include batch for fresh products, omit for regular (backend will use FEFO)
      const orderItems = cart.map(item => {
        const itemData = {
          product: item.productId || item.id,
          quantity: item.quantity,
          unitPrice: item.price // Price already calculated (with discount if applicable)
        };

        // Include batch for fresh products with manual selection
        if (item.batch && item.batch.id) {
          itemData.batch = item.batch.id;
          console.log(`🌿 Fresh product with manual batch:`, {
            product: item.name,
            batch: item.batch.batchCode,
            quantity: item.quantity,
            price: item.price
          });
        } else {
          console.log(`📦 Regular product (will use FEFO):`, {
            product: item.name,
            quantity: item.quantity,
            price: item.price
          });
        }

        return itemData;
      });

      // Get customer ID (use virtual-guest if no customer selected)
      const customerId = selectedCustomer?.id === 'virtual-guest'
        ? 'virtual-guest'
        : selectedCustomer?.id || 'virtual-guest';

      // Prepare order data
      const orderData = {
        customer: customerId,
        items: orderItems,
        deliveryType: 'pickup', // POS always pickup
        shippingFee: 0,
        status: 'draft', // Hold order = draft status
        paymentStatus: 'pending'
      };

      // Get POS token from localStorage
      const posToken = localStorage.getItem('posToken');

      if (!posToken) {
        throw new Error('POS authentication required');
      }

      // Call POS-specific API endpoint (no admin auth required)
      const response = await fetch('/api/pos-login/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${posToken}`
        },
        body: JSON.stringify(orderData)
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);

        // Try to parse as JSON if possible
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error?.message || `API Error: ${response.status}`);
        } catch {
          throw new Error(`Failed to hold order: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to hold order');
      }

      // Clear cart and show success
      setCart([]);
      setSelectedCustomer(null);
      showToast('success', `Order ${result.data.order.orderNumber} saved as draft!`);

    } catch (error) {
      console.error('❌ Error holding order:', error);
      showToast('error', error.message || 'Failed to hold order');
    } finally {
      setLoading(false);
    }
  };

  // ⭐ Helper: Check if cart has changed from existing order
  const hasCartChanged = () => {
    if (!existingOrder || !existingOrder.details) return true;

    const orderDetails = existingOrder.details;

    // Check if number of items changed
    if (cart.length !== orderDetails.length) {
      console.log('📊 Cart length changed:', cart.length, 'vs', orderDetails.length);
      return true;
    }

    // Check if any item changed (quantity, product, or batch)
    const changed = cart.some(cartItem => {
      const matchingDetail = orderDetails.find(detail => {
        const detailProductId = detail.product?._id || detail.product?.id || detail.product;
        const cartProductId = cartItem.productId || cartItem.id;

        // For fresh products with batch, also match batch
        if (cartItem.batch?.id) {
          const detailBatchId = detail.batch?._id || detail.batch?.id || detail.batch;
          return detailProductId === cartProductId && detailBatchId === cartItem.batch.id;
        }

        return detailProductId === cartProductId;
      });

      if (!matchingDetail) {
        console.log('📊 New item in cart:', cartItem.name);
        return true; // Item not found in order = changed
      }

      // Check if quantity changed
      if (matchingDetail.quantity !== cartItem.quantity) {
        console.log('📊 Quantity changed for', cartItem.name, ':', matchingDetail.quantity, '→', cartItem.quantity);
        return true;
      }

      return false;
    });

    return changed;
  };

  // ⭐ Helper: Check if customer has changed from existing order
  const hasCustomerChanged = () => {
    if (!existingOrder) return true;

    // Get current order customer ID
    // Note: older orders might have populated customer object or just ID
    const orderCustomerId = existingOrder.customer?._id || existingOrder.customer?.id || existingOrder.customer;

    // Get selected customer ID
    let selectedCustomerId = selectedCustomer?.id;

    // Handle virtual-guest special case
    if (!selectedCustomerId || selectedCustomerId === 'virtual-guest') {
      // If order has no customer or is already virtual-guest
      // Note: Backend might store virtual guest with specific ID, need careful check
      // For simplicity: if order has customer and current is virtual-guest, it changed (unless order customer is also virtual guest type)
      const orderCustomerType = existingOrder.customer?.customerType;
      if (orderCustomerType === 'guest') return false; // Both are guest => no change
      return true; // Order was registered customer, now guest => changed
    }

    // Compare IDs (handle both being populated or strings)
    if (orderCustomerId !== selectedCustomerId) {
      console.log('👤 Customer changed:', orderCustomerId, '→', selectedCustomerId);
      return true;
    }

    return false;
  };

  // ⭐ UNIFIED FLOW: Handle checkout - create draft order BEFORE showing payment modal
  const handleCheckout = async () => {
    // Step 1: Validate cart
    if (!cart || cart.length === 0) {
      showToast('error', 'Cart is empty!');
      return;
    }

    // Step 2: Validate customer
    if (!selectedCustomer) {
      showToast('error', 'Please select a customer!');
      return;
    }

    // Step 3: Check if order already exists (held order scenario)
    if (existingOrder) {
      // ⭐ NEW: Check if cart OR customer has changed
      const cartChanged = hasCartChanged();
      const customerChanged = hasCustomerChanged();

      if (cartChanged || customerChanged) {
        console.log(`📝 Order changed (Cart: ${cartChanged}, Customer: ${customerChanged}) - updating held order...`);
        console.log('📝 Cart changed - updating held order before payment...');

        try {
          setLoading(true);

          // Prepare updated items
          const items = cart.map(item => ({
            product: item.productId || item.id,
            batch: item.batch?.id || null,
            quantity: item.quantity,
            unitPrice: item.price
          }));

          // Update order via API
          const orderId = existingOrder._id || existingOrder.id;
          const updateResponse = await orderService.updateOrder(orderId, {
            items: items,
            customer: selectedCustomer.id === 'virtual-guest'
              ? 'virtual-guest'
              : selectedCustomer.id
          });

          if (!updateResponse.success) {
            throw new Error(updateResponse.error?.message || 'Failed to update order');
          }

          // ⭐ Update state with refreshed order data (customer, discount, etc.)
          setExistingOrder({
            ...updateResponse.data.order,
            id: updateResponse.data.order._id || updateResponse.data.order.id
          });

          // ⭐ CRITICAL: Update existingOrder with latest data
          const updatedOrder = updateResponse.data.order;
          updatedOrder.wasHeldOrder = existingOrder.wasHeldOrder; // Preserve flag
          updatedOrder.vnpayProcessing = existingOrder.vnpayProcessing; // Preserve VNPay flag
          setExistingOrder(updatedOrder);

          console.log('✅ Held order updated:', updatedOrder.orderNumber);
          showToast('success', 'Order updated successfully');

        } catch (error) {
          console.error('❌ Failed to update held order:', error);
          showToast('error', error.message || 'Failed to update order');
          setLoading(false);
          return; // Stop checkout if update failed
        } finally {
          setLoading(false);
        }
      } else {
        console.log('✅ Using existing held order without changes:', existingOrder.orderNumber);
      }

      // Show payment modal (order is up-to-date now)
      setShowPaymentModal(true);
      return;
    }

    // Step 4: NEW ORDER SCENARIO - Create draft order FIRST
    console.log('📝 Creating draft order before payment...');

    try {
      setLoading(true);

      const items = cart.map(item => ({
        product: item.productId || item.id,
        batch: item.batch?.id || null, // null for auto FEFO
        quantity: item.quantity,
        unitPrice: item.price
      }));

      const orderData = {
        customer: selectedCustomer.id === 'virtual-guest'
          ? 'virtual-guest'
          : selectedCustomer.id,
        items: items,
        deliveryType: 'pickup'
        // No payment info here - just create draft order
      };

      // Call /api/pos-login/order to create draft order
      const posToken = localStorage.getItem('posToken');
      if (!posToken) {
        throw new Error('POS authentication required');
      }

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
        throw new Error(errorData.error?.message || 'Failed to create order');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create order');
      }

      const draftOrder = result.data.order;
      console.log('✅ Draft order created:', draftOrder.orderNumber);

      // ⭐ KEY: Store draft order in state with flag
      draftOrder.wasHeldOrder = false; // Mark as new draft (not loaded from held orders)
      setExistingOrder(draftOrder);

      // Now show payment modal (order already exists)
      setShowPaymentModal(true);

    } catch (error) {
      console.error('❌ Failed to create draft order:', error);
      showToast('error', error.message);
      // Don't show payment modal if order creation failed
    } finally {
      setLoading(false);
    }
  };

  // ⭐ UNIFIED PAYMENT HANDLER - All scenarios have existingOrder at this point
  const handlePaymentMethodSelect = async (paymentMethod) => {
    // At this point, existingOrder ALWAYS exists
    // (either from held order or just created in handleCheckout)

    if (!existingOrder) {
      showToast('error', 'Order not found!');
      return;
    }

    const orderId = existingOrder._id || existingOrder.id;

    try {
      setShowPaymentModal(false);

      if (paymentMethod === 'bank_transfer') {
        // ⭐ VNPAY FLOW: Mark order with payment method before redirect
        console.log('🏦 VNPay flow selected - marking order');
        setExistingOrder(prev => ({
          ...prev,
          selectedPaymentMethod: 'bank_transfer',
          vnpayProcessing: true
        }));
        await handleVNPayPayment(orderId);
        return;
      }

      // Cash/Card flow
      await handleCashCardPayment(orderId, paymentMethod);

    } catch (error) {
      console.error('❌ Payment error:', error);

      const errorMessage = error.response?.data?.error?.message
        || error.error?.message
        || error.message
        || 'Failed to process payment';

      showToast('error', errorMessage);
      alert(`Payment failed: ${errorMessage}`);

      // Re-open payment modal to allow retry
      setShowPaymentModal(true);
    }
  };

  // ========== VNPAY HANDLER (UNIFIED) ==========
  const handleVNPayPayment = async (orderId) => {
    try {
      setVnpayProcessing(true);

      console.log('🏦 Creating VNPay payment URL for order:', existingOrder.orderNumber);

      // Create VNPay payment URL
      const { paymentUrl, vnp_TxnRef } = await vnpayService.createPaymentUrl(
        orderId,
        existingOrder.total,
        `Thanh toán ${existingOrder.orderNumber}`
      );

      console.log('✅ VNPay URL created:', vnp_TxnRef);
      showToast('success', 'Chuyển đến VNPay...');

      // Redirect to VNPay
      setTimeout(() => {
        window.location.href = paymentUrl;
      }, 1500);

    } catch (error) {
      console.error('❌ VNPay error:', error);
      setVnpayProcessing(false);
      throw error;
    }
  };

  // ========== CASH/CARD HANDLER (UNIFIED) ==========
  const handleCashCardPayment = async (orderId, paymentMethod) => {
    try {
      console.log(`💳 Processing ${paymentMethod} payment for order:`, existingOrder.orderNumber);

      // Step 1: Create payment
      const paymentResponse = await posLoginService.createPaymentForOrder(
        orderId,
        paymentMethod,
        `POS Payment - ${existingOrder.orderNumber}`
      );

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.error?.message || 'Failed to create payment');
      }

      console.log('✅ Payment created:', paymentResponse.data.payment.paymentNumber);

      // Step 2: Update order status
      const updateResponse = await orderService.updateOrder(orderId, {
        status: 'delivered',
        paymentStatus: 'paid'
      });

      if (!updateResponse.success) {
        console.warn('⚠️ Order update failed, but payment was created');
      }

      // Step 3: Fetch full order
      const fullOrderResponse = await orderService.getOrderById(orderId);
      if (!fullOrderResponse.success) {
        throw new Error('Failed to fetch order');
      }

      const fullOrder = fullOrderResponse.data.order;
      fullOrder.paymentMethod = paymentMethod;

      // Step 4: Show invoice
      setInvoiceOrder(fullOrder);
      setShowInvoiceModal(true);

      // Step 5: Clear cart
      setCart([]);
      setSelectedCustomer(null);
      setExistingOrder(null);

      showToast('success', `Payment completed! Order: ${existingOrder.orderNumber}`);

    } catch (error) {
      console.error('❌ Cash/Card error:', error);
      throw error;
    }
  };

  // ⭐ Handle VNPay payment complete
  const handleVNPayComplete = async (order) => {
    setVnpayProcessing(false);

    try {
      const orderId = order._id || order.id;
      console.log('🏦 VNPay return callback - Processing order:', order.orderNumber);

      // ⭐ NOTE: After VNPay redirect, page reloads and all React state is lost
      // So we cannot rely on existingOrder state here
      // VNPayReturnHandler only triggers when URL has VNPay params, so that's our flag

      // Fetch fresh order data from backend
      const fullOrderResponse = await orderService.getOrderById(orderId);
      if (!fullOrderResponse.success) {
        throw new Error('Failed to fetch order');
      }

      const completeOrder = fullOrderResponse.data.order;
      console.log('📦 Order status:', {
        orderNumber: completeOrder.orderNumber,
        paymentStatus: completeOrder.paymentStatus,
        status: completeOrder.status,
        hasPayments: completeOrder.payments?.length || 0
      });

      // ⭐ CHECK 1: If already paid, just show invoice (payment already created)
      if (completeOrder.paymentStatus === 'paid' || completeOrder.paymentStatus === 'completed') {
        console.log('✅ Payment already processed by IPN callback or previous call');

        // Update order status to delivered if needed
        if (completeOrder.status !== 'delivered') {
          await orderService.updateOrder(orderId, {
            status: 'delivered'
          });
          console.log('✅ Order status updated to delivered');
        }

        // Show invoice
        completeOrder.paymentMethod = 'bank_transfer';
        setInvoiceOrder(completeOrder);
        setShowInvoiceModal(true);

        // Clear state
        setShowPaymentModal(false);
        setCart([]);
        setSelectedCustomer(null);
        setExistingOrder(null);

        showToast('success', `Thanh toán VNPay thành công! Đơn hàng: ${order.orderNumber}`);
        return;
      }

      // ⭐ CHECK 2: Payment not created yet - create it now
      // This happens when IPN callback hasn't run yet (rare)
      console.log('📝 Creating payment record for VNPay transaction...');

      const paymentResponse = await posLoginService.createPaymentForOrder(
        orderId,
        'bank_transfer',
        `VNPay Payment - ${order.orderNumber}`
      );

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.error?.message || 'Failed to create payment');
      }

      console.log('✅ Payment created:', paymentResponse.data.payment.paymentNumber);

      // Update order status
      await orderService.updateOrder(orderId, {
        status: 'delivered',
        paymentStatus: 'paid'
      });

      console.log('✅ Order updated to delivered/paid');

      // Fetch final order state
      const finalOrderResponse = await orderService.getOrderById(orderId);
      const finalOrder = finalOrderResponse.data.order;
      finalOrder.paymentMethod = 'bank_transfer';

      // Show invoice
      setInvoiceOrder(finalOrder);
      setShowInvoiceModal(true);

      // Clear state
      setShowPaymentModal(false);
      setCart([]);
      setSelectedCustomer(null);
      setExistingOrder(null);

      showToast('success', `Thanh toán VNPay thành công! Đơn hàng: ${order.orderNumber}`);

    } catch (error) {
      console.error('❌ VNPay complete error:', error);

      // Clear VNPay processing flag
      if (existingOrder) {
        setExistingOrder(prev => ({
          ...prev,
          vnpayProcessing: false
        }));
      }

      showToast('error', error.message || 'Có lỗi xảy ra khi xử lý thanh toán VNPay');
    }
  };

  // ⭐ Handle VNPay payment failed
  const handleVNPayFailed = async (error) => {
    setVnpayProcessing(false);

    // Delete draft order if NEW order (not held)
    if (existingOrder && !existingOrder.wasHeldOrder) {
      console.log('❌ Deleting new draft order...');
      try {
        await orderService.deleteOrder(existingOrder._id);
        console.log('✅ Draft order deleted');
        setExistingOrder(null);
      } catch (deleteError) {
        console.error('Failed to delete draft:', deleteError);
      }
    } else if (existingOrder) {
      console.log('ℹ️ Keeping held order (can retry payment)');
      // Clear VNPay processing flag
      setExistingOrder(prev => ({
        ...prev,
        vnpayProcessing: false
      }));
    }

    showToast('error', error.message || 'Thanh toán VNPay thất bại');
  };
  // Handle payment modal close (cancel payment)
  const handlePaymentModalClose = () => {
    setShowPaymentModal(false);

    // If this was a NEW draft order (not held), keep it as held order
    if (existingOrder && !existingOrder.wasHeldOrder) {
      console.log(`📝 Payment cancelled - Order ${existingOrder.orderNumber} kept as draft`);
      showToast('info', `Order ${existingOrder.orderNumber} saved as held order`);
      // Order remains in existingOrder state - user can resume payment later
    }
  };

  // Handle load order from held orders
  const handleLoadHeldOrder = async (order) => {
    try {
      // Check if current cart has items
      if (cart.length > 0) {
        const confirm = window.confirm(
          'Current cart will be cleared. Do you want to continue?'
        );
        if (!confirm) return;
      }

      // Clear current cart
      setCart([]);

      // ⭐ FIX: Set customer from order with proper logging
      console.log('📋 Loading held order customer:', order.customer);

      if (order.customer) {
        const loadedCustomer = {
          id: order.customer._id || order.customer.id,
          customerCode: order.customer.customerCode,
          fullName: order.customer.fullName,
          phone: order.customer.phone,
          customerType: order.customer.customerType || 'guest'
        };

        console.log('✅ Setting selectedCustomer:', loadedCustomer);
        setSelectedCustomer(loadedCustomer);
      } else {
        // No customer in order - reset to null (will trigger guest auto-selection)
        console.log('⚠️ No customer in order, resetting to null');
        setSelectedCustomer(null);
      }

      // ⭐ Mark as held order (loaded from held orders, not newly created)
      order.wasHeldOrder = true;

      // Helper: Parse price (handle Decimal128 and other formats)
      const parsePrice = (price) => {
        if (!price && price !== 0) return 0;

        // Handle Decimal128 object
        if (typeof price === 'object' && price !== null) {
          if (price.$numberDecimal) return parseFloat(price.$numberDecimal);
          if (price.toString) return parseFloat(price.toString());
        }

        // Handle number or string
        const parsed = parseFloat(price);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Convert order details to cart items
      const cartItems = [];

      for (const detail of order.details || []) {
        const product = detail.product;
        const batch = detail.batch;

        // Get price info from detail (handle Decimal128)
        const unitPrice = parsePrice(detail.unitPrice);

        console.log(`📝 Processing detail:`, {
          product: product?.name,
          batch: batch?.batchCode,
          rawUnitPrice: detail.unitPrice,
          parsedUnitPrice: unitPrice,
          quantity: detail.quantity,
          categoryName: product.category?.name
        });

        // Check if product is FRESH (only fresh products show batch info in cart)
        const isFresh = product.category?.name?.toLowerCase().includes('fresh');

        // Create cart item
        const cartItem = {
          id: (isFresh && batch) ? `${product._id || product.id}-${batch._id || batch.id}` : (product._id || product.id),
          productId: product._id || product.id,
          productCode: product.productCode,
          name: product.name,
          image: product.image,
          price: unitPrice, // This is the final price (after discount if any)
          quantity: detail.quantity,
          stock: 999, // We don't have real-time stock from order
          categoryName: product.category?.name || 'Uncategorized'
        };

        // Only add batch info for FRESH products (user manually selected batch)
        // For regular products, batch is used by backend for FEFO but not displayed
        if (isFresh && batch) {
          // Fresh product: Show batch info
          const batchUnitPrice = parsePrice(batch.unitPrice) || parsePrice(product.unitPrice) || unitPrice;
          const batchDiscountPercentage = batch.discountPercentage || 0;

          cartItem.batch = {
            id: batch._id || batch.id,
            batchCode: batch.batchCode,
            expiryDate: batch.expiryDate,
            unitPrice: batchUnitPrice, // Original price
            discountPercentage: batchDiscountPercentage // Discount if any
          };

          console.log(`  🌿 FRESH product with batch:`, cartItem.batch);
        } else {
          // Regular product: Calculate basePrice and discount from batch or product
          // detail.unitPrice is the FINAL price (after batch discount applied by backend)
          // We need to reverse-calculate the base price if batch has discount

          let basePrice = unitPrice;
          let discountPercentage = 0;

          if (batch) {
            // Batch exists: Check if it has discount
            const batchUnitPrice = parsePrice(batch.unitPrice);
            const batchDiscountPercentage = batch.discountPercentage || 0;

            if (batchDiscountPercentage > 0 && batchUnitPrice > 0) {
              // Batch has discount: use batch price as base
              basePrice = batchUnitPrice;
              discountPercentage = batchDiscountPercentage;

              console.log(`  📦 Batch discount detected:`, {
                batchCode: batch.batchCode,
                batchUnitPrice,
                batchDiscount: batchDiscountPercentage,
                detailUnitPrice: unitPrice
              });
            } else if (batchUnitPrice > unitPrice) {
              // No explicit discount, but batch price > detail price
              // Calculate discount from difference
              basePrice = batchUnitPrice;
              discountPercentage = Math.round(((batchUnitPrice - unitPrice) / batchUnitPrice) * 100);
            }
          } else if (product.unitPrice) {
            // No batch: use product price as base
            const productUnitPrice = parsePrice(product.unitPrice);
            const productDiscountPercentage = product.discountPercentage || 0;

            if (productDiscountPercentage > 0 && productUnitPrice > 0) {
              basePrice = productUnitPrice;
              discountPercentage = productDiscountPercentage;
            } else if (productUnitPrice > unitPrice) {
              basePrice = productUnitPrice;
              discountPercentage = Math.round(((productUnitPrice - unitPrice) / productUnitPrice) * 100);
            }
          }

          // Only add basePrice and discount if discount exists
          if (discountPercentage > 0) {
            cartItem.basePrice = basePrice;
            cartItem.discountPercentage = discountPercentage;
          }

          console.log(`  📦 REGULAR product:`, {
            basePrice,
            finalPrice: unitPrice,
            discount: discountPercentage,
            hasDiscount: discountPercentage > 0
          });
        }

        cartItems.push(cartItem);
      }

      setCart(cartItems);

      // Store existing order so we don't create a new one
      // Add id alias for MongoDB _id compatibility
      setExistingOrder({
        ...order,
        id: order._id || order.id
      });

      showToast('success', `Loaded order ${order.orderNumber} to cart`);
    } catch (error) {
      console.error('❌ Error loading held order:', error);
      showToast('error', 'Failed to load order');
    }
  };

  const totals = calculateTotals();

  if (loading) {
    return <POSLoadingScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 animate-fade-in-smooth">
      <POSHeader
        currentEmployee={currentEmployee}
        currentTime={currentTime}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="mb-4">
            <POSSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onProductScanned={handleProductScanned}
              onScanClick={() => setShowQRScanner(true)}
              onMapClick={() => setShowStoreMap(true)}
              scanning={scanning}
            />

            <POSCategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            <POSProductGrid
              products={products}
              loading={loadingProducts}
              searchTerm={searchTerm}
              onProductClick={addToCart}
            />
          </div>
        </div>

        <POSCart
          cart={cart}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          onClearCart={clearCart}
          onCheckout={handleCheckout}
          onHoldOrder={handleHoldOrder}
          onOpenHeldOrders={() => setShowHeldOrdersModal(true)}
          totals={totals}
          selectedCustomer={selectedCustomer}
          onCustomerChange={setSelectedCustomer}
          customerDiscounts={customerDiscounts}
        />
      </div>

      <POSPaymentModal
        isOpen={showPaymentModal}
        totals={totals}
        onClose={handlePaymentModalClose}
        onPaymentMethodSelect={handlePaymentMethodSelect}
        existingOrder={existingOrder}
      />

      {/* Batch Selection Modal */}
      <POSBatchSelectModal
        isOpen={showBatchModal}
        productData={selectedProductData}
        onClose={() => {
          setShowBatchModal(false);
          setSelectedProductData(null);
        }}
        onBatchSelected={handleBatchSelected}
      />

      {/* Held Orders Modal */}
      <POSHeldOrdersModal
        isOpen={showHeldOrdersModal}
        onClose={() => setShowHeldOrdersModal(false)}
        onLoadOrder={handleLoadHeldOrder}
      />

      {/* QR Code Scanner Modal */}
      <QRCodeScannerModal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleQRScanSuccess}
        onScanError={handleQRScanError}
      />

      <POSStoreMapModal
        isOpen={showStoreMap}
        onClose={() => setShowStoreMap(false)}
        onAddBatch={handleMapBatchSelect}
      />

      {/* Invoice Modal */}
      <POSInvoiceModal
        isOpen={showInvoiceModal}
        order={invoiceOrder}
        onClose={() => {
          setShowInvoiceModal(false);
          setInvoiceOrder(null);
          // ⭐ Reload page to refresh inventory data
          window.location.reload();
        }}
        onComplete={() => {
          // ⭐ Reload page to clear state and refresh inventory
          window.location.reload();
        }}
      />

      {/* ⭐ VNPay Return Handler */}
      <VNPayReturnHandler
        onPaymentComplete={handleVNPayComplete}
        onPaymentFailed={handleVNPayFailed}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[10000] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-in-right ${toast.type === 'success'
          ? 'bg-green-500 text-white'
          : 'bg-red-500 text-white'
          }`}>
          {toast.type === 'success' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          <span className="font-semibold text-[14px]">{toast.message}</span>
        </div>
      )}
    </div>
  );
};