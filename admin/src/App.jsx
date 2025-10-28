import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Dashboard, ViewProduct, DetailProduct, ListProduct, LoginSignup, Orders, Categories, Users, Customers, Suppliers, Inventories, SalesReports, PurchaseReports } from "./pages";
import PurchaseOrders from "./pages/PurchaseOrders";
import Payments from "./pages/Payments";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes - Public */}
        <Route path="/" element={<LoginSignup />} />
        <Route path="/signup" element={<LoginSignup />} />

        {/* Dashboard Routes - Protected */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/view"
          element={
            <ProtectedRoute>
              <ViewProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id/:slug"
          element={
            <ProtectedRoute>
              <DetailProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/list"
          element={
            <ProtectedRoute>
              <ListProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <Categories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          }
        />
        {/* <Route
          path="/test-users"
          element={
            <ProtectedRoute>
              <TestUsers />
            </ProtectedRoute>
          }
        /> */}
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <Customers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
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
            <ProtectedRoute>
              <Inventories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/purchase-orders"
          element={
            <ProtectedRoute>
              <PurchaseOrders />
            </ProtectedRoute>
          }
        />

        {/* Payments Route - Independent page for all payment management */}
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          }
        />

        {/* Reports Routes */}
        <Route
          path="/reports/sales"
          element={
            <ProtectedRoute>
              <SalesReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/purchase"
          element={
            <ProtectedRoute>
              <PurchaseReports />
            </ProtectedRoute>
          }
        />

      </Routes>
    </Router>
  );
}

export default App;
