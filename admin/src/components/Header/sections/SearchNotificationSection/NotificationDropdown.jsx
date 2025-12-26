import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, AlertTriangle, Info, Clock, DollarSign } from 'lucide-react';
import notificationService from '../../../../services/notificationService';

export const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ total: 0, critical: 0, high: 0, warning: 0 });
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch notifications on mount and when dropdown opens
  useEffect(() => {
    fetchNotifications();
    // Refresh notifications every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getAllNotifications();
      if (response.success) {
        setNotifications(response.data.notifications);
        setCounts(response.data.counts);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const getSeverityIcon = (severity, type) => {
    // Special icon for supplier credit notifications
    if (type && type.startsWith('credit_')) {
      switch (severity) {
        case 'critical':
          return <DollarSign className="w-5 h-5 text-red-600" />;
        case 'high':
          return <DollarSign className="w-5 h-5 text-orange-600" />;
        case 'warning':
          return <DollarSign className="w-5 h-5 text-amber-600" />;
        default:
          return <DollarSign className="w-5 h-5 text-blue-600" />;
      }
    }

    // Default icons for other notification types
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-amber-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'high':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'warning':
        return 'border-l-4 border-amber-500 bg-amber-50';
      default:
        return 'border-l-4 border-blue-500 bg-blue-50';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';
    return `₫${Number(amount).toLocaleString('vi-VN')}`;
  };

  const renderNotificationDetails = (notification) => {
    // Supplier credit notifications
    if (notification.type && notification.type.startsWith('credit_')) {
      return (
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="font-medium">
            {notification.supplierCode}
          </span>
          <span>•</span>
          <span>
            Debt: {formatCurrency(notification.currentDebt)}
          </span>
          <span>•</span>
          <span>
            Limit: {formatCurrency(notification.creditLimit)}
          </span>
          <span>•</span>
          <span className={`font-semibold ${notification.severity === 'critical' ? 'text-red-600' :
            notification.severity === 'high' ? 'text-orange-600' : 'text-amber-600'
            }`}>
            {notification.creditUtilization?.toFixed(1)}%
          </span>
        </div>
      );
    }

    // Inventory expiry notifications
    if (notification.type === 'expired_on_shelf' || notification.type === 'expired_in_warehouse') {
      return (
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="font-medium text-red-700">
            Expired: {formatDate(notification.expiryDate)}
          </span>
          <span>•</span>
          <span>{notification.quantity} units</span>
        </div>
      );
    }

    // Expiring soon notifications
    if (notification.type === 'expiring_soon') {
      return (
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="font-medium text-amber-700">
            Expires: {formatDate(notification.expiryDate)}
          </span>
          <span>•</span>
          <span>{notification.daysUntilExpiry} days left</span>
          <span>•</span>
          <span>{notification.quantity} units</span>
        </div>
      );
    }

    // Low stock notifications
    if (notification.type === 'low_stock') {
      return (
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span>{notification.batchCode}</span>
          <span>•</span>
          <span>{notification.quantity} units remaining</span>
        </div>
      );
    }

    return null;
  };

  const getNotificationsByType = () => {
    const critical = notifications.filter(n => n.severity === 'critical');
    const high = notifications.filter(n => n.severity === 'high');
    const warning = notifications.filter(n => n.severity === 'warning');
    return { critical, high, warning };
  };

  const { critical, high, warning } = getNotificationsByType();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        onClick={toggleDropdown}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {counts.total > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
            {counts.total > 99 ? '99+' : counts.total}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[420px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-gray-900">
                Notifications
              </h3>
              <button
                onClick={fetchNotifications}
                disabled={loading}
                className="text-[12px] text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Count Summary */}
            {counts.total > 0 && (
              <div className="flex items-center gap-3 mt-2 text-[11px]">
                {counts.critical > 0 && (
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    {counts.critical} Critical
                  </span>
                )}
                {counts.high > 0 && (
                  <span className="flex items-center gap-1 text-orange-600 font-medium">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    {counts.high} High
                  </span>
                )}
                {counts.warning > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    {counts.warning} Warning
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: '500px' }}>
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="text-[13px] text-gray-500 mt-2">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-[14px] text-gray-500 font-medium">No notifications</p>
                <p className="text-[12px] text-gray-400 mt-1">All inventory items are in good condition</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Critical Notifications */}
                {critical.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                      <p className="text-[11px] font-semibold text-red-800 uppercase tracking-wide">
                        Critical - Immediate Action Required
                      </p>
                    </div>
                    {critical.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 transition-colors ${getSeverityColor(notification.severity)}`}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getSeverityIcon(notification.severity, notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 mb-1">
                              {notification.title}
                            </p>
                            <p className="text-[12px] text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            {renderNotificationDetails(notification)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* High Priority Notifications */}
                {high.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
                      <p className="text-[11px] font-semibold text-orange-800 uppercase tracking-wide">
                        High Priority
                      </p>
                    </div>
                    {high.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 transition-colors ${getSeverityColor(notification.severity)}`}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getSeverityIcon(notification.severity, notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 mb-1">
                              {notification.title}
                            </p>
                            <p className="text-[12px] text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            {renderNotificationDetails(notification)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warning Notifications */}
                {warning.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                      <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
                        Warnings
                      </p>
                    </div>
                    {warning.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 transition-colors ${getSeverityColor(notification.severity)}`}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getSeverityIcon(notification.severity, notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 mb-1">
                              {notification.title}
                            </p>
                            <p className="text-[12px] text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            {renderNotificationDetails(notification)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <p className="text-[11px] text-gray-600 text-center">
                Last updated: {new Date().toLocaleTimeString('en-GB')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
