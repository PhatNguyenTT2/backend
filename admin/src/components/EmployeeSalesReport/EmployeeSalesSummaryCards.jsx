import React from 'react';
import { Users, ShoppingCart, DollarSign, Award } from 'lucide-react';

export const EmployeeSalesSummaryCards = ({ summary }) => {
  if (!summary) return null;

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const cards = [
    {
      title: 'Total Employees',
      value: summary.totalEmployees || 0,
      icon: Users,
      iconBgColor: 'bg-blue-100',
      iconTextColor: 'text-blue-600',
      borderColor: 'border-blue-500',
      valueColor: 'text-gray-900',
      subtitle: `Active sales staff`
    },
    {
      title: 'Total Orders',
      value: (summary.totalOrders || 0).toLocaleString(),
      icon: ShoppingCart,
      iconBgColor: 'bg-green-100',
      iconTextColor: 'text-green-600',
      borderColor: 'border-green-500',
      valueColor: 'text-gray-900',
      subtitle: 'Completed orders'
    },
    {
      title: 'Total Revenue',
      value: summary.totalRevenue || 0,
      icon: DollarSign,
      iconBgColor: 'bg-purple-100',
      iconTextColor: 'text-purple-600',
      borderColor: 'border-purple-500',
      valueColor: 'text-gray-900',
      subtitle: `Avg: ${formatCurrency(summary.averageOrderValue || 0)}`,
      isCurrency: true
    },
    {
      title: 'Top Performer',
      value: summary.topEmployee?.name || 'N/A',
      icon: Award,
      iconBgColor: 'bg-orange-100',
      iconTextColor: 'text-orange-600',
      borderColor: 'border-orange-500',
      valueColor: 'text-gray-900',
      subtitle: summary.topEmployee
        ? `${formatCurrency(summary.topEmployee.revenue)} • ${summary.topEmployee.orders} orders`
        : 'No data',
      isText: true
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const displayValue = card.isCurrency
          ? formatCurrency(card.value)
          : card.value;

        return (
          <div
            key={index}
            className={`bg-white rounded-xl p-6 border-l-4 ${card.borderColor} shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {card.title}
              </div>
              <div className={`w-10 h-10 rounded-lg ${card.iconBgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.iconTextColor}`} />
              </div>
            </div>

            <div className={`text-3xl font-semibold ${card.valueColor} mb-3`}>
              {displayValue}
            </div>

            <div className="text-xs text-gray-500">
              {card.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
};
