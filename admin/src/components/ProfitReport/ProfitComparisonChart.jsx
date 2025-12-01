import React from 'react';
import { DollarSign, ShoppingCart, Package } from 'lucide-react';

export const ProfitComparisonChart = ({ products = [], summary }) => {
  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-gray-500 text-[13px]">No data available</p>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';
    return `₫${Number(amount).toLocaleString('vi-VN')}`;
  };

  // Get top 5 products by revenue
  const topRevenueProducts = [...products]
    .filter(p => p.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Get top 5 products by cost
  const topCostProducts = [...products]
    .filter(p => p.totalCost > 0)
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5);

  const revenueColors = [
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500'
  ];

  const costColors = [
    'bg-red-500',
    'bg-rose-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-amber-500'
  ];

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Revenue Side */}
      <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Revenue
            </h3>
            <p className="text-[11px] text-gray-600 mt-1">Top 5 products by revenue</p>
          </div>
          <div className="text-right">
            <p className="text-[20px] font-bold text-green-600">
              {formatCurrency(summary?.totalRevenue || 0)}
            </p>
            <p className="text-[11px] text-gray-500">{summary?.totalSalesOrders || 0} orders</p>
          </div>
        </div>

        <div className="space-y-3 mt-6">
          {topRevenueProducts.map((product, index) => {
            const percentage = summary?.totalRevenue > 0
              ? (product.totalRevenue / summary.totalRevenue) * 100
              : 0;

            return (
              <div key={product.productId} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-semibold text-gray-700">{index + 1}.</span>
                    <span className="text-gray-900 truncate">{product.productName}</span>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-semibold text-green-700">
                      {formatCurrency(product.totalRevenue)}
                    </p>
                    <p className="text-[10px] text-gray-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${revenueColors[index]} h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-[11px] text-gray-600">Products Sold</p>
              <p className="text-[16px] font-bold text-green-600">
                {summary?.totalProductsSold || 0}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-600">Avg Order Value</p>
              <p className="text-[16px] font-bold text-green-600">
                {formatCurrency(
                  summary?.totalSalesOrders > 0
                    ? summary.totalRevenue / summary.totalSalesOrders
                    : 0
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Side */}
      <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-red-600" />
              Cost
            </h3>
            <p className="text-[11px] text-gray-600 mt-1">Top 5 products by cost</p>
          </div>
          <div className="text-right">
            <p className="text-[20px] font-bold text-red-600">
              {formatCurrency(summary?.totalCost || 0)}
            </p>
            <p className="text-[11px] text-gray-500">{summary?.totalPurchaseOrders || 0} POs</p>
          </div>
        </div>

        <div className="space-y-3 mt-6">
          {topCostProducts.map((product, index) => {
            const percentage = summary?.totalCost > 0
              ? (product.totalCost / summary.totalCost) * 100
              : 0;

            return (
              <div key={product.productId} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-semibold text-gray-700">{index + 1}.</span>
                    <span className="text-gray-900 truncate">{product.productName}</span>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-semibold text-red-700">
                      {formatCurrency(product.totalCost)}
                    </p>
                    <p className="text-[10px] text-gray-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${costColors[index]} h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-[11px] text-gray-600">Products Purchased</p>
              <p className="text-[16px] font-bold text-red-600">
                {summary?.totalProductsPurchased || 0}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-600">Avg PO Value</p>
              <p className="text-[16px] font-bold text-red-600">
                {formatCurrency(
                  summary?.totalPurchaseOrders > 0
                    ? summary.totalCost / summary.totalPurchaseOrders
                    : 0
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
