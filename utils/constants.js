/**
 * System-wide constants and configurations
 * This is the single source of truth for permissions
 */

// All available permissions in the system
const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_CATEGORIES: 'manage_categories',
  MANAGE_ORDERS: 'manage_orders',
  MANAGE_CUSTOMERS: 'manage_customers',
  MANAGE_SUPPLIERS: 'manage_suppliers',
  MANAGE_EMPLOYEES: 'manage_employees',
  MANAGE_POS: 'manage_POS',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_INVENTORY: 'manage_inventory',
  VIEW_REPORTS: 'view_reports',
  MANAGE_PAYMENTS: 'manage_payments',
  MANAGE_SETTINGS: 'manage_settings'
}

// Get all permission values as array
const ALL_PERMISSIONS = Object.values(PERMISSIONS)

// Permission labels for UI display
const PERMISSION_LABELS = {
  [PERMISSIONS.VIEW_DASHBOARD]: 'View Dashboard',
  [PERMISSIONS.MANAGE_PRODUCTS]: 'Manage Products',
  [PERMISSIONS.MANAGE_CATEGORIES]: 'Manage Categories',
  [PERMISSIONS.MANAGE_ORDERS]: 'Manage Orders',
  [PERMISSIONS.MANAGE_CUSTOMERS]: 'Manage Customers',
  [PERMISSIONS.MANAGE_SUPPLIERS]: 'Manage Suppliers',
  [PERMISSIONS.MANAGE_EMPLOYEES]: 'Manage Employees',
  [PERMISSIONS.MANAGE_POS]: 'Manage POS',
  [PERMISSIONS.MANAGE_ROLES]: 'Manage Roles',
  [PERMISSIONS.MANAGE_INVENTORY]: 'Manage Inventory',
  [PERMISSIONS.VIEW_REPORTS]: 'View Reports',
  [PERMISSIONS.MANAGE_PAYMENTS]: 'Manage Payments',
  [PERMISSIONS.MANAGE_SETTINGS]: 'Manage Settings'
}

// Special permission for Super Admin (bypass all checks)
const SUPER_ADMIN_PERMISSION = 'all'

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  SUPER_ADMIN_PERMISSION
}
