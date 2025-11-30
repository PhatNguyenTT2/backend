import React from 'react';
import { ShoppingCart, Package, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const SummaryCards = ({ summary, loading }) => {
  const cards = [
    {
      key: 'totalOrders',
      label: 'Total Orders',
      icon: ShoppingCart,
      color: 'emerald',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-500'
    },
    {
      key: 'totalSales',
      label: 'Total Sales (Qty)',
      icon: Package,
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-500'
    },
    {
      key: 'newCustomers',
      label: 'New Customers',
      icon: Users,
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-500'
    },
    {
      key: 'totalRevenue',
      label: 'Total Revenue',
      icon: TrendingUp,
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600',
      borderColor: 'border-orange-500',
      isCurrency: true
    }
  ];

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendColor = (trend, change) => {
    if (trend === 'up' && change > 0) return 'text-green-600 bg-green-50';
    if (trend === 'down' && change < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';

    // Handle Mongoose Decimal128
    if (typeof amount === 'object' && amount.$numberDecimal) {
      return `₫${Number(amount.$numberDecimal).toLocaleString('vi-VN')}`;
    }

    return `₫${Number(amount).toLocaleString('vi-VN')}`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-gray-300 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map(card => {
        const metric = summary?.[card.key];
        const Icon = card.icon;

        return (
          <div
            key={card.key}
            className={`bg-white rounded-lg shadow-sm p-6 border-l-4 ${card.borderColor} hover:shadow-md transition-shadow`}
          >
            {/* Header with icon */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-gray-600 font-medium uppercase tracking-wider">
                {card.label}
              </p>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-4 h-4 ${card.textColor}`} />
              </div>
            </div>

            {/* Value */}
            <p className={`text-[28px] font-bold ${card.textColor} mb-2`}>
              {metric ? (
                card.isCurrency
                  ? formatCurrency(metric.current)
                  : metric.current.toLocaleString()
              ) : '0'}
            </p>

            {/* Trend indicator */}
            {metric && (
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-semibold ${getTrendColor(metric.trend, metric.change)}`}>
                {getTrendIcon(metric.trend)}
                <span>
                  {Math.abs(metric.change)}%
                </span>
                <span className="text-[10px] font-normal ml-1">
                  vs {metric.trend === 'up' ? 'previous' : 'last'} period
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
