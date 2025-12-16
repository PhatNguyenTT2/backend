import React from 'react';
import { useNavigate } from 'react-router-dom';

// Custom Hooks
import {
  useAuth,
  useToast,
  useProducts,
  useCustomer,
  useCart,
  useBatchSelection,
  useQRScanner,
  useKeyboardShortcuts,
  useOrders,
  usePayment
} from '../../hooks/pos';

// Components
import {
  POSHeader,
  POSSearchBar,
  POSCategoryFilter,
  POSProductGrid,
  POSCart,
  POSPaymentModal,
  POSLoadingScreen,
  POSInvoiceModal
} from '../../components/POSMain';
import { POSBatchSelectModal } from '../../components/POSMain/POSBatchSelectModal';
import { POSHeldOrdersModal } from '../../components/POSMain/POSHeldOrdersModal';
import { QRCodeScannerModal } from '../../components/POSMain/QRCodeScannerModal';

/**
 * POSMain - Main POS page (REFACTORED)
 * All business logic extracted to custom hooks
 */
export const POSMain = () => {
  const navigate = useNavigate();

  // 🔔 Toast Notifications
  const { toast, showToast } = useToast();

  // 🔐 Authentication
  const { currentEmployee, currentTime, loading, handleLogout } = useAuth(navigate);

  // 📦 Products & Categories
  const {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    loadingProducts
  } = useProducts();

  // 👤 Customer Management
  const {
    selectedCustomer,
    setSelectedCustomer,
    customerDiscounts
  } = useCustomer();

  // 🛒 Cart Management
  const {
    cart,
    setCart,
    totals,
    addToCart,
    addProductWithBatch,
    updateQuantity,
    removeFromCart,
    clearCart
  } = useCart(showToast, selectedCustomer, customerDiscounts);

  // 🌿 Batch Selection
  const {
    showBatchModal,
    selectedProductData,
    scanning: batchScanning,
    setScanning: setBatchScanning,
    requiresBatchSelection,
    openBatchSelection,
    handleBatchSelected,
    closeBatchSelection
  } = useBatchSelection(showToast, addProductWithBatch);

  // 📝 Order Management
  const {
    existingOrder,
    setExistingOrder,
    showHeldOrdersModal,
    setShowHeldOrdersModal,
    handleHoldOrder,
    handleLoadHeldOrder
  } = useOrders(showToast, setCart, setSelectedCustomer);

  // 💳 Payment Processing
  const {
    showPaymentModal,
    setShowPaymentModal,
    showInvoiceModal,
    setShowInvoiceModal,
    invoiceOrder,
    handlePaymentMethodSelect,
    handleInvoiceComplete
  } = usePayment(showToast, setCart, setSelectedCustomer, setExistingOrder);

  // 📷 QR Scanner
  const {
    showQRScanner,
    setShowQRScanner,
    scanning: qrScanning,
    handleProductScanned,
    handleQRScanSuccess,
    handleQRScanError
  } = useQRScanner(showToast, addToCart, openBatchSelection, requiresBatchSelection, setSearchTerm);

  // ⌨️ Keyboard Shortcuts
  useKeyboardShortcuts({
    onLogout: () => handleLogout(cart),
    onClearCart: clearCart,
    onHoldOrder: () => handleHoldOrder(cart, selectedCustomer, currentEmployee),
    onCheckout: () => setShowPaymentModal(true),
    cartLength: cart.length,
    showPaymentModal
  });

  // Combined scanning state
  const scanning = batchScanning || qrScanning;

  // Handle add to cart (with batch selection for FRESH products)
  const handleAddToCart = async (product) => {
    if (requiresBatchSelection(product)) {
      await openBatchSelection(product);
    } else {
      addToCart(product);
    }
  };

  // 🔄 Loading State
  if (loading) {
    return <POSLoadingScreen />;
  }

  // 🎨 Render UI (Clean & Simple)
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <POSHeader
        currentEmployee={currentEmployee}
        currentTime={currentTime}
        onLogout={() => handleLogout(cart)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="mb-4">
            <POSSearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onProductScanned={handleProductScanned}
              onOpenQRScanner={() => setShowQRScanner(true)}
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
              onProductClick={handleAddToCart}
            />
          </div>
        </div>

        {/* Cart Section */}
        <POSCart
          cart={cart}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          onClearCart={clearCart}
          onCheckout={() => setShowPaymentModal(true)}
          onHoldOrder={() => handleHoldOrder(cart, selectedCustomer, currentEmployee)}
          onOpenHeldOrders={() => setShowHeldOrdersModal(true)}
          totals={totals}
          selectedCustomer={selectedCustomer}
          onCustomerChange={setSelectedCustomer}
          customerDiscounts={customerDiscounts}
        />
      </div>

      {/* Modals */}
      <POSPaymentModal
        isOpen={showPaymentModal}
        totals={totals}
        onClose={() => setShowPaymentModal(false)}
        onPaymentMethodSelect={(method) => handlePaymentMethodSelect(method, cart, selectedCustomer, existingOrder, totals)}
        existingOrder={existingOrder}
      />

      <POSBatchSelectModal
        isOpen={showBatchModal}
        productData={selectedProductData}
        onClose={closeBatchSelection}
        onBatchSelected={handleBatchSelected}
      />

      <POSHeldOrdersModal
        isOpen={showHeldOrdersModal}
        onClose={() => setShowHeldOrdersModal(false)}
        onLoadOrder={(order) => handleLoadHeldOrder(order, cart)}
      />

      <QRCodeScannerModal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleQRScanSuccess}
        onScanError={handleQRScanError}
      />

      <POSInvoiceModal
        isOpen={showInvoiceModal}
        order={invoiceOrder}
        onClose={() => setShowInvoiceModal(false)}
        onComplete={handleInvoiceComplete}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[10000] px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-in-right ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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
