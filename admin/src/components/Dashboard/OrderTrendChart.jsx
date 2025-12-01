import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  const formatCurrency = (value) => {
    return `₫${(value / 1000).toFixed(0)}K`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-[12px] font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-[11px]" style={{ color: entry.color }}>
              <span className="font-semibold">{entry.name}:</span>{' '}
              ₫{entry.value.toLocaleString('vi-VN')}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-[16px] font-semibold text-gray-900">
              Order Summary
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Revenue comparison over time
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-gray-600">{periodLabel || 'Current Period'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">{comparisonLabel || 'Previous Period'}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              stroke="#d1d5db"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={formatCurrency}
              stroke="#d1d5db"
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="current"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 4 }}
              activeDot={{ r: 6 }}
              name={periodLabel || 'Current Period'}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: '#ef4444', r: 4 }}
              activeDot={{ r: 6 }}
              name={comparisonLabel || 'Previous Period'}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-[13px]">No data available</p>
          </div>
        </div>
      )}
    </div>
  );
};
