import React, { useState, useEffect } from 'react';
import { href, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ShoppingBag,
  Package2,
  User,
  ClipboardList,
  Mail,
  MessageSquare,
  CheckSquare,
  UserCircle,
  Shield,
  AlertTriangle,
  Settings,
  DollarSign,
  Users,
  User2Icon,
  LogOut,
  CarTaxiFront,
  CassetteTapeIcon,
  BookAIcon,
  PanelTopInactiveIcon,
  LucideStore,
  LucideAArrowDown,
  ReceiptEuro
} from 'lucide-react';
import authService from '../../../../services/authService';

export const NavigationMenuSection = () => {
  // Lấy trạng thái từ localStorage khi component mount
  const [openDropdowns, setOpenDropdowns] = useState(() => {
    const savedState = localStorage.getItem('sidebarDropdownState');
    return savedState ? JSON.parse(savedState) : {};
  });
  const location = useLocation();
  const navigate = useNavigate();

  // Lưu trạng thái vào localStorage mỗi khi thay đổi
  useEffect(() => {
    localStorage.setItem('sidebarDropdownState', JSON.stringify(openDropdowns));
  }, [openDropdowns]);

  const toggleDropdown = (itemName) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const handleSignOut = async () => {
    try {
      await authService.logout();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
      // Still navigate to login even if logout API fails
      navigate('/');
    }
  };

  const menuItems = [
    {
      category: 'Management',
      items: [
        { name: 'Dashboard', icon: LayoutGrid, href: '/dashboard' },
        { name: 'Orders', icon: ShoppingBag, arrow: false, href: '/orders' },
        { name: 'Categories', icon: BookAIcon, href: '/categories' },
        {
          name: 'Products',
          icon: Package2,
          arrow: true,
          submenu: [
            { name: 'List', href: '/products/list' },
            { name: 'View', href: '/products/view' },
          ]
        },
        // { name: 'Buyer', icon: User2Icon, arrow: true },
        { name: 'Customers', icon: User, href: '/customers' },
        { name: 'Suppliers', icon: User2Icon, href: '/suppliers' },
        {
          name: 'Inventory',
          icon: LucideStore,
          arrow: true,
          submenu: [
            { name: 'Management', href: '/inventory/management' },
            { name: 'Purchase Orders', href: '/inventory/purchase-orders' }
          ]
        },
        { name: 'Payments', icon: DollarSign, href: '/payments' },
        {
          name: 'Reports',
          icon: ReceiptEuro,
          arrow: true,
          submenu: [
            { name: 'Sales', href: '/reports/sales' },
            { name: 'Purchase', href: '/reports/purchase' },
            { name: 'Profit', href: '/reports/profit' },
            { name: 'Inventory', href: '/reports/inventory' }
          ]
        },
      ],
    },
    {
      category: 'Admin',
      items: [
        // { name: 'Profile', icon: UserCircle, arrow: true },
        {
          name: 'Users',
          icon: Users,
          arrow: true,
          submenu: [
            { name: 'Employees', href: '/employees' },
            { name: 'Departments', href: '/departments' },
          ]
        },
        { name: 'Authentication', icon: Shield, arrow: true },
        { name: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <nav className="pb-4 flex flex-col h-full">
      <div className="flex-1">
        {menuItems.map((menu, index) => (
          <div key={index}>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider font-bold my-4 px-4">
              {menu.category}
            </h3>
            <ul>
              {menu.items.map((item, itemIndex) => {
                const isActive = item.href === location.pathname;
                const hasActiveSubmenu = item.submenu?.some(sub => sub.href === location.pathname);

                return (
                  <li key={itemIndex}>
                    <div>
                      {item.arrow ? (
                        <div
                          onClick={() => toggleDropdown(item.name)}
                          className={`flex items-center justify-between py-2 px-4 rounded-full text-sm cursor-pointer ${hasActiveSubmenu
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'text-gray-700 hover:bg-emerald-50'
                            }`}
                        >
                          <div className="flex items-center">
                            <div className="p-2 rounded-full">
                              <item.icon className="w-5 h-5 text-gray-500" />
                            </div>
                            <span className="ml-3">{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className="bg-emerald-500 text-white text-xs font-bold rounded-full px-2 py-1">
                              {item.badge}
                            </span>
                          )}
                          {openDropdowns[item.name] ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          {item.new && (
                            <span className="bg-emerald-500 text-white text-xs font-bold rounded-md px-2 py-1">
                              New
                            </span>
                          )}
                        </div>
                      ) : (
                        <Link
                          to={item.href}
                          className={`flex items-center justify-between py-2 px-4 rounded-full text-sm ${isActive
                            ? 'bg-emerald-500 text-white'
                            : 'text-gray-700 hover:bg-emerald-50'
                            }`}
                        >
                          <div className="flex items-center">
                            <div className={`p-2 rounded-full ${isActive ? 'bg-emerald-100' : ''}`}>
                              <item.icon
                                className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-gray-500'
                                  }`}
                              />
                            </div>
                            <span className="ml-3">{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className="bg-emerald-500 text-white text-xs font-bold rounded-full px-2 py-1">
                              {item.badge}
                            </span>
                          )}
                          {item.new && (
                            <span className="bg-emerald-500 text-white text-xs font-bold rounded-md px-2 py-1">
                              New
                            </span>
                          )}
                        </Link>
                      )}

                      {/* Submenu dropdown */}
                      {item.arrow && item.submenu && openDropdowns[item.name] && (
                        <ul className="ml-8 mt-1 mb-2 space-y-1">
                          {item.submenu.map((subitem, subIndex) => {
                            const isSubmenuActive = subitem.href === location.pathname;

                            return (
                              <li key={subIndex}>
                                <Link
                                  to={subitem.href}
                                  className={`block py-2 px-4 text-sm rounded-lg transition-colors ${isSubmenuActive
                                    ? 'text-emerald-600 bg-emerald-50 font-medium'
                                    : 'text-gray-600 hover:text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                >
                                  {subitem.name}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Sign Out Button - Đồng bộ với menu */}
      <div className="mt-4 px-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center py-2 px-4 rounded-full text-sm text-gray-700 hover:bg-emerald-50 transition-colors"
        >
          <div className="p-2 rounded-full">
            <LogOut className="w-5 h-5 text-gray-500" />
          </div>
          <span className="ml-3">Sign Out</span>
        </button>
      </div>
    </nav>
  );
};
