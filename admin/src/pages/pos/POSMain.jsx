import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import posLoginService from '../../services/posLoginService';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
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
    guest: 0,      // Walk-in customers: 0% discount
    retail: 10,    // Retail customers: 10% discount
    wholesale: 15, // Wholesale customers: 15% discount
    vip: 20        // VIP customers: 20% discount
  });

  // Batch selection modal state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState(null);
  const [scanning, setScanning] = useState(false);

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

  // Load categories from backend
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

    fetchCategories();
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
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
    const availableStock = product.stock || product.inventory?.quantityAvailable || 0;

    if (currentQuantityInCart >= availableStock) {
      alert(`Not enough stock. Available: ${availableStock}`);
      return;
    }

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        ...product,
        quantity: 1,
        price: product.unitPrice || product.price || 0
      }]);
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
        alert(`Product not found: ${productCode}`);
        return;
      }

      const { product, inventory, batches, outOfStock } = response.data;

      // Check if out of stock
      if (outOfStock || !batches || batches.length === 0) {
        alert(`${product.name} is currently out of stock!`);
        return;
      }

      // If multiple batches available, show selection modal
      if (batches.length > 1) {
        setSelectedProductData(response.data);
        setShowBatchModal(true);
      } else {
        // Auto-add with the only available batch (FEFO)
        handleAddProductWithBatch(response.data, batches[0], 1);
      }

    } catch (error) {
      console.error('Error scanning product:', error);
      if (error.response?.status === 404) {
        alert(`Product not found: ${productCode}`);
      } else {
        alert('Failed to scan product. Please try again.');
      }
    } finally {
      setScanning(false);
    }
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

    // Create unique cart item ID combining product and batch
    const cartItemId = `${product.id}-${batch.id}`;

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

      // Batch info
      batch: {
        id: batch.id,
        batchCode: batch.batchCode,
        expiryDate: batch.expiryDate,
        availableQty: batch.quantity,
        daysUntilExpiry: batch.daysUntilExpiry
      }
    };

    // Check if this exact product+batch combo already exists in cart
    const existingItem = cart.find(item => item.id === cartItemId);

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      const maxQty = batch.quantity;

      if (newQuantity > maxQty) {
        alert(`Not enough stock in this batch. Available: ${maxQty}`);
        return;
      }

      setCart(cart.map(item =>
        item.id === cartItemId
          ? { ...item, quantity: newQuantity }
          : item
      ));
    } else {
      // Add new item
      setCart([...cart, cartItem]);
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
      alert(`Not enough stock. Available: ${availableStock}`);
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
    </div>
  );
};

