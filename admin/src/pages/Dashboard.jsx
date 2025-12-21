import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';
import { PermissionAlert } from '../components/PermissionAlert';
import {
  SummaryCards,
  OrderTrendChart,
  TopCategoriesChart,
  RecentTransactions
} from '../components/Dashboard';
import api from '../services/api';

const Dashboard = () => {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [cache, setCache] = useState({});
  const [animKey, setAnimKey] = useState(0);
  const dropdownRef = useRef(null);

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: null }
  ];

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDashboardData = async () => {
    // Check cache first (Phase 2: Cache optimization)
    if (cache[period]) {
      setData(cache[period]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // KHÔNG reset data về null - giữ data cũ để hiển thị (Phase 1)

      const response = await api.get('/statistics/dashboard', {
        params: { period }
      });

      if (response.data.success) {
        const newData = response.data.data;
        setData(newData);
        // Save to cache (Phase 2)
        setCache(prev => ({ ...prev, [period]: newData }));
      } else {
        setError('Failed to load dashboard data');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = (type) => {
    const labels = {
      week: 'This Week',
      month: 'This Month',
      year: 'This Year'
    };
    return labels[type] || type;
  };

  const getComparisonLabel = (type) => {
    const labels = {
      week: 'Last Week',
      month: 'Last Month',
      year: 'Last Year'
    };
    return labels[type] || 'Previous Period';
  };

  const periodOptions = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ];

  const handlePeriodChange = (value) => {
    if (value === period) return;

    setPeriod(value);
    setDropdownOpen(false);
    // Trigger animation when period changes
    setAnimKey(prev => prev + 1);
  };

  // Prepare summary data structure
  const summaryData = data ? {
    totalOrders: data.totalOrders,
    totalSales: data.totalSales,
    newCustomers: data.newCustomers,
    totalRevenue: data.totalRevenue,
    changes: data.changes
  } : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Permission Alert */}
      <PermissionAlert />

      {/* Header with Period Filter */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Dashboard
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Business overview and statistics
            </p>
          </div>

          {/* Period Dropdown Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 min-w-[160px] justify-between"
            >
              <span>{getPeriodLabel(period)}</span>
              <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handlePeriodChange(option.value)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${period === option.value
                      ? 'bg-emerald-50 text-emerald-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-semibold text-sm">Error</p>
          <p className="text-xs mt-1">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-2 text-xs font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Dashboard Content with Animation */}
      <div
        key={animKey}
        className="space-y-6 animate-fade-in-smooth"
      >
        {/* Summary Cards */}
        <div className={`transition-opacity duration-300 ${loading ? 'opacity-60' : 'opacity-100'}`}>
          <SummaryCards summary={summaryData} loading={loading} />
        </div>

        {/* Charts Row */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${loading ? 'opacity-60' : 'opacity-100'}`}>
          <div className="lg:col-span-2">
            <OrderTrendChart
              data={data?.orderTrend}
              loading={loading}
              periodLabel={getPeriodLabel(period)}
              comparisonLabel={getComparisonLabel(period)}
            />
          </div>
          <div className="lg:col-span-1">
            <TopCategoriesChart
              data={data?.topCategories}
              loading={loading}
            />
          </div>
        </div>

        {/* Recent Transactions */}
        <div className={`transition-opacity duration-300 ${loading ? 'opacity-60' : 'opacity-100'}`}>
          <RecentTransactions
            data={data?.transactions}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
