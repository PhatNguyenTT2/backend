import { useState, useEffect } from 'react';
import { Breadcrumb } from '../../components/Breadcrumb';
import {
  EmployeeSalesSummaryCards,
  EmployeeSalesComparisonChart,
  EmployeeSalesList
} from '../../components/EmployeeSalesReport';
import { Users, Calendar, RefreshCw } from 'lucide-react';
import api from '../../services/api';

const EmployeeSalesReport = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Reports', href: '/reports' },
    { label: 'Employee Sales', href: null }
  ];

  // State management
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Date helpers
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Filter state
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // Fetch employee sales report
  const fetchEmployeeSales = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/statistics/employee-sales', {
        params: {
          startDate,
          endDate
        }
      });

      if (response.data.success) {
        setSalesData(response.data.data);
      } else {
        setError('Failed to load employee sales report');
      }
    } catch (err) {
      console.error('Error fetching employee sales report:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load employee sales report');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchEmployeeSales();
    }
  }, [startDate, endDate]);

  // Quick date presets
  const handlePresetDate = (preset) => {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = yesterday;
        end = yesterday;
        break;
      case 'thisWeek':
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        start = monday;
        end = today;
        break;
      case 'lastWeek':
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        start = lastMonday;
        end = lastSunday;
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const formatDisplayDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-[24px] font-semibold text-gray-900">
                Employee Sales Performance
              </h1>
              <p className="text-[13px] text-gray-600 mt-1">
                Track and analyze employee sales performance metrics
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-2">
              Quick Select
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Today', value: 'today' },
                { label: 'Yesterday', value: 'yesterday' },
                { label: 'This Week', value: 'thisWeek' },
                { label: 'Last Week', value: 'lastWeek' },
                { label: 'This Month', value: 'thisMonth' },
                { label: 'Last Month', value: 'lastMonth' }
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-[12px] font-medium border border-gray-300"
                  onClick={() => handlePresetDate(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Selection */}
          {salesData && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-gray-600">
                  Showing data from: <span className="font-semibold text-gray-900">{formatDisplayDate(salesData.dateRange.startDate)}</span>
                  <span className="mx-2">→</span>
                  <span className="font-semibold text-gray-900">{formatDisplayDate(salesData.dateRange.endDate)}</span>
                </p>
                <button
                  onClick={fetchEmployeeSales}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[12px] font-medium flex items-center gap-1.5"
                  disabled={loading}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
          <p className="font-semibold">Error</p>
          <p className="text-[12px] mt-1">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-[13px] text-gray-500">Loading employee sales data...</p>
        </div>
      )}

      {/* Main Content */}
      {!loading && salesData && (
        <>
          {/* Summary Cards */}
          <EmployeeSalesSummaryCards summary={salesData.summary} />

          {/* Comparison Chart */}
          <div>
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4">
              Employee Performance Comparison
            </h2>
            <EmployeeSalesComparisonChart employees={salesData.employees} />
          </div>

          {/* Employee List */}
          <div>
            <h2 className="text-[16px] font-semibold text-gray-900 mb-4">
              Detailed Performance Breakdown
            </h2>
            <EmployeeSalesList employees={salesData.employees} loading={false} />
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !salesData && !error && (
        <div className="bg-white rounded-lg shadow-sm py-16 text-center">
          <Users className="mx-auto h-16 w-16 text-gray-400" />
          <h3 className="mt-4 text-[16px] font-semibold text-gray-900">
            No Data Available
          </h3>
          <p className="mt-2 text-[13px] text-gray-500">
            Select a date range to view employee sales performance
          </p>
        </div>
      )}
    </div>
  );
};

export default EmployeeSalesReport;
