import { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { PurchaseList } from '../../components/PurchaseList';
import reportService from '../../services/reportService';

const PurchaseReports = () => {
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Reports', href: '/reports' },
    { label: 'Purchase', href: null },
  ];

  // State management
  const [purchaseData, setPurchaseData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter state
  const [periodType, setPeriodType] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState(null);

  // Initialize dates based on period type
  useEffect(() => {
    handlePeriodTypeChange(periodType);
  }, []);

  const handlePeriodTypeChange = (type) => {
    const now = new Date();
    let start, end;

    switch (type) {
      case 'today':
        start = end = now.toISOString().split('T')[0];
        break;
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start = weekAgo.toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      case 'custom':
        start = end = '';
        break;
      default:
        start = end = '';
    }

    setPeriodType(type);
    setStartDate(start);
    setEndDate(end);
  };

  // Fetch purchase report
  const fetchPurchaseReport = async () => {
    if (!startDate || !endDate) {
      setError('Please select a date range');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await reportService.getPurchaseReport({
        startDate,
        endDate,
        periodType
      });

      if (response.success) {
        setPurchaseData(response.purchaseList || []);
        setSummary(response.summary || null);
      }
    } catch (err) {
      console.error('Error fetching purchase report:', err);
      setError(err.error || err.message || 'Failed to load purchase report');
    } finally {
      setLoading(false);
    }
  };

  // Auto fetch when dates change (but not on initial render with empty dates)
  useEffect(() => {
    if (startDate && endDate) {
      fetchPurchaseReport();
    }
  }, [startDate, endDate]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-[24px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
            Purchase Reports
          </h1>
          <p className="text-[13px] text-gray-600 font-['Poppins',sans-serif] mt-1">
            View product purchases by date range
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="space-y-4">
            {/* Period Type Selection */}
            <div>
              <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                Report Period
              </label>
              <div className="grid grid-cols-6 gap-2">
                {[
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'This Week' },
                  { value: 'month', label: 'This Month' },
                  { value: 'quarter', label: 'This Quarter' },
                  { value: 'year', label: 'This Year' },
                  { value: 'custom', label: 'Custom Range' }
                ].map(period => (
                  <button
                    key={period.value}
                    type="button"
                    className={`px-4 py-2 rounded-lg border text-[13px] font-['Poppins',sans-serif] transition-colors ${periodType === period.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    onClick={() => handlePeriodTypeChange(period.value)}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium font-['Poppins',sans-serif] text-[#212529] mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-[13px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchPurchaseReport}
                  disabled={loading || !startDate || !endDate}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-['Poppins',sans-serif] font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      View Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
            <p className="font-semibold">Error</p>
            <p className="text-[12px] mt-1">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
              <p className="text-[11px] text-gray-600 font-['Poppins',sans-serif] font-medium uppercase tracking-[0.5px]">Total Cost</p>
              <p className="text-[20px] font-bold font-['Poppins',sans-serif] text-blue-600 mt-1">
                ${summary.totalCost?.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
              <p className="text-[11px] text-gray-600 font-['Poppins',sans-serif] font-medium uppercase tracking-[0.5px]">Total Quantity</p>
              <p className="text-[20px] font-bold font-['Poppins',sans-serif] text-purple-600 mt-1">
                {summary.totalQuantity || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
              <p className="text-[11px] text-gray-600 font-['Poppins',sans-serif] font-medium uppercase tracking-[0.5px]">Total Purchase Orders</p>
              <p className="text-[20px] font-bold font-['Poppins',sans-serif] text-green-600 mt-1">
                {summary.totalPurchaseOrders || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-orange-500">
              <p className="text-[11px] text-gray-600 font-['Poppins',sans-serif] font-medium uppercase tracking-[0.5px]">Products Purchased</p>
              <p className="text-[20px] font-bold font-['Poppins',sans-serif] text-orange-600 mt-1">
                {summary.productCount || 0}
              </p>
            </div>
          </div>
        )}

        {/* Purchase List Component */}
        <PurchaseList
          purchaseData={purchaseData}
          summary={summary}
          loading={loading}
        />
      </div>
    </Layout>
  );
};

export default PurchaseReports;
