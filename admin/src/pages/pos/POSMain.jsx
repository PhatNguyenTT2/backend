import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import posLoginService from '../../services/posLoginService';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import settingsService from '../../services/settingsService';
import {
  POSHeader,
  POSSearchBar,
  POSCategoryFilter,
  POSProductGrid,
  POSCart,
  POSPaymentModal,
  POSLoadingScreen,
  POSCustomerSelector
} from '../../components/POSMain';
import { POSBatchSelectModal } from '../../components/POSMain/POSBatchSelectModal';

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

  // Toast notification state
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

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
        const response = await settingsService.getCustomerDiscounts();
        if (response.success && response.data) {
          setCustomerDiscounts({
            guest: 0, // Guest customers always 0% discount
            retail: response.data.retail || 10,
            wholesale: response.data.wholesale || 15,
            vip: response.data.vip || 20
          });
          console.log('Loaded discount configuration:', response.data);
        }
      } catch (error) {
        console.error('Error fetching discount configuration:', error);
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('product-search')?.focus();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        handleLogout();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Delete' && cart.length > 0) {
        e.preventDefault();
        clearCart();
      }

      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('product-search')?.focus();
      }

      if (e.key === 'F8' && cart.length > 0) {
        e.preventDefault();
        handleHoldOrder();
      }

      if (e.key === 'F9' && cart.length > 0) {
        e.preventDefault();
        setShowPaymentModal(true);
      }

      if (e.key === 'Escape' && showPaymentModal) {
        e.preventDefault();
        setShowPaymentModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart.length, showPaymentModal]);

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
      const existingItem = cart.find(item => item.id === product.id);
      const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
      const availableStock = product.stock || product.inventory?.quantityAvailable || 0;

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
        setCart([...cart, {
          ...product,
          quantity: 1,
          price: product.unitPrice || product.price || 0
        }]);
        showToast('success', `Added ${product.name} to cart`);
      }
    }
  };

  // Handle productCode scanned
  const handleProductScanned = async (productCode) => {
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

        console.log('📦 Scanned - Total batches:', batches.length, '→ Available on shelf:', availableBatches.length);

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
        // REGULAR PRODUCT: Auto-add to cart immediately
        // Backend will handle FEFO (First Expired First Out) batch selection when creating order
        // Use first batch (FEFO sorted) for display price only
        handleAddProductWithBatch(response.data, batches[0], 1);
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

  // Handle batch selected from modal
  const handleBatchSelected = (selectedBatch, quantity) => {
    handleAddProductWithBatch(selectedProductData, selectedBatch, quantity);
    setShowBatchModal(false);
    setSelectedProductData(null);
  };

  // Add product with batch info to cart
  const handleAddProductWithBatch = (productData, batch, quantity) => {
    const { product, inventory } = productData;

    // Determine cart item ID based on product type:
    // - FRESH products: Use product-batch combo (staff manually selects batch)
    // - REGULAR products: Use product.id only (backend auto-selects FEFO batch)
    const isFresh = product.category?.name?.toLowerCase().includes('fresh');
    const cartItemId = isFresh ? `${product.id}-${batch.id}` : product.id;

    const cartItem = {
      id: cartItemId,
      productId: product.id,
      productCode: product.productCode,
      name: product.name,
      image: product.image,
      price: parseFloat(batch.unitPrice || product.unitPrice),
      quantity: quantity,
      stock: inventory.quantityAvailable,
      categoryName: product.category?.name || 'Uncategorized',

      // Batch info (only for FRESH products that require manual selection)
      ...(isFresh && {
        batch: {
          id: batch.id,
          batchCode: batch.batchCode,
          expiryDate: batch.expiryDate,
          availableQty: batch.quantity,
          daysUntilExpiry: batch.daysUntilExpiry
        }
      })
    };

    // Check if this exact product+batch combo already exists in cart
    const existingItem = cart.find(item => item.id === cartItemId);

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      const maxQty = isFresh ? batch.quantity : inventory.quantityAvailable;

      if (newQuantity > maxQty) {
        showToast('error', `Not enough stock. Available: ${maxQty}`);
        return;
      }

      setCart(cart.map(item =>
        item.id === cartItemId
          ? { ...item, quantity: newQuantity }
          : item
      ));

      showToast('success', `Updated ${product.name} quantity to ${newQuantity}`);
    } else {
      // Add new item
      setCart([...cart, cartItem]);
      showToast('success', `Added ${quantity}x ${product.name} to cart`);
    }

    console.log(`Added ${quantity}x ${product.name} (Batch: ${batch.batchCode})`);
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

    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  // Remove from cart
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    if (window.confirm('Clear all items from cart?')) {
      setCart([]);
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
      // DON'T include batch - let backend auto-select using FEFO
      const orderItems = cart.map(item => {
        console.log('🛒 Cart item:', {
          productId: item.productId || item.id,
          quantity: item.quantity,
          price: item.price,
          hasBatch: !!item.batch
        });

        return {
          product: item.productId || item.id,
          quantity: item.quantity,
          unitPrice: item.price
          // Batch will be auto-selected by backend using FEFO
        };
      });

      // Prepare order data
      const orderData = {
        customer: selectedCustomer?.id === 'virtual-guest' ? 'virtual-guest' : selectedCustomer?.id,
        createdBy: currentEmployee.id,
        deliveryType: 'pickup', // POS always pickup
        shippingFee: 0,
        status: 'draft', // Hold order = draft status
        paymentStatus: 'pending',
        items: orderItems
      };

      console.log('📝 Creating hold order:', orderData);

      // Get POS token from localStorage
      const posToken = localStorage.getItem('posToken');
      console.log('🔑 POS Token:', posToken ? 'Found' : 'Not Found');

      if (!posToken) {
        throw new Error('POS authentication required');
      }

      console.log('🌐 Calling API: POST /api/pos-login/order');

      // Call POS-specific API endpoint (no admin auth required)
      const response = await fetch('/api/pos-login/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${posToken}`
        },
        body: JSON.stringify(orderData)
      });

      console.log('📡 Response status:', response.status, response.statusText);

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

      console.log('✅ Hold order created:', result.data.order);

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

  // Handle payment
  const handlePayment = (paymentMethod) => {
    console.log('Processing payment with method:', paymentMethod);
    console.log('Cart items:', cart);
    console.log('Total:', calculateTotals().total);

    // TODO: Implement actual payment processing
    alert(`Payment with ${paymentMethod} will be implemented`);
    setShowPaymentModal(false);
  };

  const totals = calculateTotals();

  if (loading) {
    return <POSLoadingScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
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
          onCheckout={() => setShowPaymentModal(true)}
          onHoldOrder={handleHoldOrder}
          totals={totals}
          selectedCustomer={selectedCustomer}
          onCustomerChange={setSelectedCustomer}
          customerDiscounts={customerDiscounts}
        />
      </div>

      <POSPaymentModal
        isOpen={showPaymentModal}
        totals={totals}
        onClose={() => setShowPaymentModal(false)}
        onPayment={handlePayment}
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

