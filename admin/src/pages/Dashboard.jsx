import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Breadcrumb } from '../components/Breadcrumb';
import { PermissionAlert } from '../components/PermissionAlert';
import {
  SummaryCards,
  OrderTrendChart,
  TopCategoriesChart,
  RecentTransactions
} from '../components/Dashboard';
import api from '../services/api';

const Home = () => {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: null }
  ];

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/statistics/dashboard', {
        params: { period }
      });

      if (response.data.success) {
        setData(response.data.data);
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
    return labels[type] || `Previous ${type}`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Permission Alert */}
        <PermissionAlert />

        {/* Header with Period Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[24px] font-semibold text-gray-900">
                Dashboard
              </h1>
              {data?.currentPeriod && (
                <p className="text-[13px] text-gray-600 mt-1">
                  {data.currentPeriod.label}
                </p>
              )}
            </div>

            {/* Period Selector */}
            <div className="flex gap-2">
              {['week', 'month', 'year'].map((periodType) => (
                <button
                  key={periodType}
                  onClick={() => setPeriod(periodType)}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${period === periodType
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {getPeriodLabel(periodType)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
            <p className="font-semibold">Error</p>
            <p className="text-[12px] mt-1">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        <SummaryCards summary={data?.summary} loading={loading} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OrderTrendChart
            data={data?.orderTrend}
            loading={loading}
            periodLabel={getPeriodLabel(period)}
            comparisonLabel={getComparisonLabel(period)}
          />
          <TopCategoriesChart
            data={data?.topCategories}
            loading={loading}
          />
        </div>

        {/* Recent Transactions */}
        <RecentTransactions
          data={data?.recentTransactions}
          loading={loading}
        />
      </div>
    </Layout>
  );
};

export default Home;
