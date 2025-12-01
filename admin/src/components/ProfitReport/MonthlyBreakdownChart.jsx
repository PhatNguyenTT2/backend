import React from 'react';
import { TrendingUp } from 'lucide-react';

export const MonthlyBreakdownChart = ({ monthlyBreakdown = [] }) => {
  if (!monthlyBreakdown || monthlyBreakdown.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-500 text-[13px]">No monthly data available</p>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';
    const formatted = Number(amount).toLocaleString('vi-VN');
    // Shorten large numbers
    if (Math.abs(amount) >= 1000000) {
      return `₫${(amount / 1000000).toFixed(1)}M`;
    }
    return `₫${formatted}`;
  };

  // Find max value for scaling
  const maxValue = Math.max(
    ...monthlyBreakdown.map(m => Math.max(m.revenue, m.cost))
  );

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Monthly Trend
          </h3>
          <p className="text-[11px] text-gray-600 mt-1">Revenue vs Cost comparison by month</p>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600">Cost</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">Profit</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: '300px' }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-gray-500 pr-2">
          <span>{formatCurrency(maxValue)}</span>
          <span>{formatCurrency(maxValue * 0.75)}</span>
          <span>{formatCurrency(maxValue * 0.5)}</span>
          <span>{formatCurrency(maxValue * 0.25)}</span>
          <span>₫0</span>
        </div>

        {/* Chart area */}
        <div className="absolute left-12 right-0 top-0 bottom-6">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="border-t border-gray-200"></div>
            ))}
          </div>

          {/* Bars */}
          <div className="absolute inset-0 flex items-end justify-between gap-1">
            {monthlyBreakdown.map((month, index) => {
              const revenueHeight = maxValue > 0 ? (month.revenue / maxValue) * 100 : 0;
              const costHeight = maxValue > 0 ? (month.cost / maxValue) * 100 : 0;
              const profitHeight = maxValue > 0 ? (Math.abs(month.profit) / maxValue) * 100 : 0;

              return (
                <div
                  key={index}
                  className="flex-1 flex items-end justify-center gap-0.5 group relative"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-[11px] rounded-lg shadow-lg p-3 whitespace-nowrap">
                    <p className="font-semibold mb-2">{month.monthName}</p>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        Revenue: {formatCurrency(month.revenue)}
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        Cost: {formatCurrency(month.cost)}
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Profit: {formatCurrency(month.profit)}
                      </p>
                      <p className="text-gray-300 text-[10px] mt-1 pt-1 border-t border-gray-700">
                        Margin: {month.profitMargin.toFixed(1)}%
                      </p>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                  </div>

                  {/* Revenue bar */}
                  <div
                    className="w-3 bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer"
                    style={{ height: `${revenueHeight}%` }}
                  ></div>

                  {/* Cost bar */}
                  <div
                    className="w-3 bg-red-500 rounded-t hover:bg-red-600 transition-colors cursor-pointer"
                    style={{ height: `${costHeight}%` }}
                  ></div>

                  {/* Profit bar */}
                  <div
                    className={`w-3 rounded-t transition-colors cursor-pointer ${month.profit >= 0
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : 'bg-orange-500 hover:bg-orange-600'
                      }`}
                    style={{ height: `${profitHeight}%` }}
                  ></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="absolute left-12 right-0 bottom-0 flex justify-between text-[10px] text-gray-600">
          {monthlyBreakdown.map((month, index) => (
            <div key={index} className="flex-1 text-center">
              {month.monthName.substring(0, 3)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
