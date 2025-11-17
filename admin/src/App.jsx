import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Dashboard, ViewProduct, Products, ProductBatches, LoginSignup, Orders, Categories, Employees, Customers, Suppliers, Inventories, DetailInventories, SalesReports, PurchaseReports, Roles, POSManagement } from "./pages";
import { POSLogin, POSMain } from "./pages/pos";
import PurchaseOrders from "./pages/PurchaseOrders";
import Payments from "./pages/Payments";
import ProtectedRoute from "./components/ProtectedRoute";
import { PERMISSIONS } from "./utils/permissions";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes - Public */}
        <Route path="/" element={<LoginSignup />} />
        <Route path="/signup" element={<LoginSignup />} />

        {/* POS Routes - Separate authentication flow */}
        <Route path="/pos-login" element={<POSLogin />} />
        <Route path="/pos" element={<POSMain />} />

        {/* Dashboard Routes - Protected */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_DASHBOARD}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/view"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_PRODUCTS}>
              <ViewProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_PRODUCTS}>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:productId/batches"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_PRODUCTS}>
              <ProductBatches />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_ORDERS}>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_CATEGORIES}>
              <Categories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_EMPLOYEES}>
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_ROLES}>
              <Roles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_CUSTOMERS}>
              <Customers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_SUPPLIERS}>
              <Suppliers />
            </ProtectedRoute>
          }
        />
        {/* Redirect old inventory route to new structure */}
        <Route
          path="/inventories"
          element={<Navigate to="/inventory/management" replace />}
        />

        {/* New Inventory Routes with submenu */}
        <Route
          path="/inventory/management"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_INVENTORY}>
              <Inventories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/detail/:productId"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_INVENTORY}>
              <DetailInventories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/purchase-orders"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_INVENTORY}>
              <PurchaseOrders />
            </ProtectedRoute>
          }
        />

        {/* Payments Route - Independent page for all payment management */}
        <Route
          path="/payments"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_PAYMENTS}>
              <Payments />
            </ProtectedRoute>
          }
        />

        {/* Reports Routes */}
        <Route
          path="/reports/sales"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_REPORTS}>
              <SalesReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/purchase"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.VIEW_REPORTS}>
              <PurchaseReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos-management"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_POS}>
              <POSManagement />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
