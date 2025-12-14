import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export const OrderTrendChart = ({ data, loading, periodLabel, comparisonLabel }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  // Transform data for Recharts
  const chartData = data?.labels?.map((label, index) => ({
    name: label,
    current: data.currentPeriod[index] || 0,
    previous: data.comparisonPeriod[index] || 0
  })) || [];

  // Format currency - Full VND format
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Short format for Y-axis
  const formatCurrencyShort = (value) => {
    if (value >= 1000000) {
      return `₫${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `₫${(value / 1000).toFixed(0)}K`;
    }
    return `₫${value}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 bg-opacity-90 text-white p-3 rounded-lg shadow-xl">
          <p className="text-[13px] font-bold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-[12px]" style={{ color: entry.color }}>
              <span className="font-semibold">{entry.name}:</span>{' '}
              {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[16px] font-semibold text-gray-900">
            Xu hướng đơn hàng
          </h3>
          <p className="text-[12px] text-gray-500 mt-1">
            So sánh doanh thu theo thời gian
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[12px] font-medium text-gray-600">
              {periodLabel || 'Kỳ hiện tại'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-[12px] font-medium text-gray-600">
              {comparisonLabel || 'Kỳ trước'}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 15, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0, 0, 0, 0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#999999' }}
              stroke="transparent"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#999999' }}
              tickFormatter={formatCurrencyShort}
              stroke="transparent"
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(0, 0, 0, 0.1)', strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="current"
              stroke="#1eb988"
              strokeWidth={2.5}
              dot={{
                fill: '#1eb988',
                r: 4,
                strokeWidth: 2,
                stroke: '#fff'
              }}
              activeDot={{
                r: 6,
                strokeWidth: 3,
                stroke: '#fff'
              }}
              name={periodLabel || 'Kỳ hiện tại'}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#e68161"
              strokeWidth={2.5}
              dot={{
                fill: '#e68161',
                r: 4,
                strokeWidth: 2,
                stroke: '#fff'
              }}
              activeDot={{
                r: 6,
                strokeWidth: 3,
                stroke: '#fff'
              }}
              name={comparisonLabel || 'Kỳ trước'}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-400">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-[14px]">Không có dữ liệu</p>
          </div>
        </div>
      )}
    </div>
  );
};
