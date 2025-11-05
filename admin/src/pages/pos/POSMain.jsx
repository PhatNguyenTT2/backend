import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import posAuthService from '../../services/posAuthService';

export const POSMain = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  // Load employee and verify session
  useEffect(() => {
    const checkAuth = async () => {
      if (!posAuthService.isAuthenticated()) {
        navigate('/pos-login');
        return;
      }

      try {
        // Verify session is still valid
        await posAuthService.verify();
        const employee = posAuthService.getCurrentEmployee();
        setCurrentEmployee(employee);
      } catch (error) {
        console.error('Session verification failed:', error);
        navigate('/pos-login');
      }
    };

    checkAuth();
  }, [navigate]);

  // Mock data - Replace with API calls
  useEffect(() => {
    // Mock categories
    setCategories([
      { id: 'all', name: 'All Products' },
      { id: 'electronics', name: 'Electronics' },
      { id: 'clothing', name: 'Clothing' },
      { id: 'food', name: 'Food & Beverage' },
    ]);

    // Mock products
    setProducts([
      { id: 1, name: 'Laptop Dell XPS 13', price: 1299.99, category: 'electronics', stock: 15, image: null },
      { id: 2, name: 'iPhone 14 Pro', price: 999.99, category: 'electronics', stock: 25, image: null },
      { id: 3, name: 'T-Shirt Cotton', price: 19.99, category: 'clothing', stock: 50, image: null },
      { id: 4, name: 'Coffee Arabica', price: 12.99, category: 'food', stock: 100, image: null },
      { id: 5, name: 'Wireless Mouse', price: 29.99, category: 'electronics', stock: 30, image: null },
      { id: 6, name: 'Jeans Blue', price: 49.99, category: 'clothing', stock: 40, image: null },
    ]);
  }, []);

  // Add to cart
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert('Not enough stock');
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  // Update quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (newQuantity > product.stock) {
      alert('Not enough stock');
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
      await posAuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      navigate('/pos-login');
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totals = calculateTotals();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-emerald-600 text-white p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
            <circle cx="7" cy="15" r="1" fill="currentColor" />
          </svg>
          <div>
            <h1 className="text-[20px] font-bold font-['Poppins',sans-serif]">
              POS Terminal
            </h1>
            <p className="text-[12px] font-['Poppins',sans-serif] text-emerald-100">
              {currentEmployee?.name} ({currentEmployee?.code})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right mr-4">
            <p className="text-[12px] font-['Poppins',sans-serif] text-emerald-100">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-[14px] font-semibold font-['Poppins',sans-serif]">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors text-[13px] font-semibold font-['Poppins',sans-serif] flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Search and Categories */}
          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-[15px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3"
            />

            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg font-['Poppins',sans-serif] text-[13px] font-medium whitespace-nowrap transition-colors ${selectedCategory === category.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-4 text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {/* Product Image Placeholder */}
                  <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                      <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                      <path d="M2 17l5-5 3 3 7-7 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <h3 className="text-[14px] font-semibold font-['Poppins',sans-serif] text-gray-900 mb-1 line-clamp-2">
                    {product.name}
                  </h3>

                  <div className="flex items-center justify-between">
                    <p className="text-[18px] font-bold font-['Poppins',sans-serif] text-emerald-600">
                      ${product.price}
                    </p>
                    <p className={`text-[11px] font-medium font-['Poppins',sans-serif] ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                      Stock: {product.stock}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-[15px] font-['Poppins',sans-serif]">
                  No products found
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-96 bg-white shadow-2xl flex flex-col">
          {/* Cart Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[18px] font-bold font-['Poppins',sans-serif] text-gray-900">
                Current Order
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[12px] font-medium font-['Poppins',sans-serif] text-red-600 hover:text-red-700"
                >
                  Clear All
                </button>
              )}
            </div>
            <p className="text-[13px] font-['Poppins',sans-serif] text-gray-500">
              {cart.length} item{cart.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mb-3">
                  <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
                  <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-[14px] font-['Poppins',sans-serif]">
                  Cart is empty
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-[13px] font-semibold font-['Poppins',sans-serif] text-gray-900 flex-1 pr-2">
                        {item.name}
                      </h3>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 bg-white rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                        <span className="w-12 text-center text-[14px] font-semibold font-['Poppins',sans-serif]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 bg-white rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-[11px] font-['Poppins',sans-serif] text-gray-500">
                          ${item.price} each
                        </p>
                        <p className="text-[15px] font-bold font-['Poppins',sans-serif] text-emerald-600">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer - Totals & Checkout */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 p-4 space-y-3">
              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[13px] font-['Poppins',sans-serif]">
                  <span className="text-gray-600">Tax (10%):</span>
                  <span className="font-semibold">${totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[18px] font-bold font-['Poppins',sans-serif] pt-2 border-t border-gray-200">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-emerald-600">${totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[16px] font-bold font-['Poppins',sans-serif] transition-colors"
              >
                Proceed to Payment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal - Simple version for now */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-[20px] font-bold font-['Poppins',sans-serif] text-gray-900 mb-4">
              Payment
            </h2>

            <div className="mb-6">
              <p className="text-[14px] font-['Poppins',sans-serif] text-gray-600 mb-2">
                Total Amount:
              </p>
              <p className="text-[32px] font-bold font-['Poppins',sans-serif] text-emerald-600">
                ${totals.total.toFixed(2)}
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <button className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors">
                Cash Payment
              </button>
              <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors">
                Card Payment
              </button>
              <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] transition-colors">
                E-Wallet
              </button>
            </div>

            <button
              onClick={() => setShowPaymentModal(false)}
              className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-[15px] font-semibold font-['Poppins',sans-serif] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
