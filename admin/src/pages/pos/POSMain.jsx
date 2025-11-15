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
  POSLoadingScreen
} from '../../components/POSMain';

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
  }, [selectedCategory, searchTerm]);  // Update time every second
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

  // Update quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const cartItem = cart.find(item => item.id === productId);
    if (!cartItem) return;

    const availableStock = cartItem.stock || cartItem.inventory?.quantityAvailable || 0;

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
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;
    return { subtotal, tax, total };
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
        />
      </div>

      <POSPaymentModal
        isOpen={showPaymentModal}
        totals={totals}
        onClose={() => setShowPaymentModal(false)}
        onPayment={handlePayment}
      />
    </div>
  );
};
