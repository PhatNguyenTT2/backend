import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';

export const ProfitSummaryCards = ({ summary }) => {
  if (!summary) return null;

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';
    return `₫${Number(amount).toLocaleString('vi-VN')}`;
  };

  const cards = [
    {
      title: 'Total Revenue',
      value: summary.totalRevenue,
      icon: DollarSign,
      color: 'green',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      borderColor: 'border-green-500',
      subtitle: `${summary.totalSalesOrders} orders`
    },
    {
      title: 'Total Cost',
      value: summary.totalCost,
      icon: DollarSign,
      color: 'red',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      borderColor: 'border-red-500',
      subtitle: `${summary.totalPurchaseOrders} POs`
    },
    {
      title: 'Gross Profit',
      value: summary.grossProfit,
      icon: summary.grossProfit >= 0 ? TrendingUp : TrendingDown,
      color: summary.grossProfit >= 0 ? 'blue' : 'orange',
      bgColor: summary.grossProfit >= 0 ? 'bg-blue-50' : 'bg-orange-50',
      textColor: summary.grossProfit >= 0 ? 'text-blue-700' : 'text-orange-700',
      borderColor: summary.grossProfit >= 0 ? 'border-blue-500' : 'border-orange-500',
      subtitle: 'Revenue - Cost'
    },
    {
      title: 'Profit Margin',
      value: `${summary.profitMargin.toFixed(1)}%`,
      icon: Percent,
      color: 'purple',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-500',
      subtitle: 'Profit / Revenue',
      isPercentage: true
    }
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const displayValue = card.isPercentage ? card.value : formatCurrency(card.value);

        return (
          <div
            key={index}
            className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${card.borderColor} hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[11px] text-gray-600 font-medium uppercase tracking-wider">
                  {card.title}
                </p>
                <p className={`text-[20px] font-bold ${card.textColor} mt-1`}>
                  {displayValue}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {card.subtitle}
                </p>
              </div>
              <div className={`${card.bgColor} p-2 rounded-lg`}>
                <Icon className={`w-5 h-5 ${card.textColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
