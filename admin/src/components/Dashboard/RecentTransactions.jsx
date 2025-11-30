import React from 'react';
import { Clock } from 'lucide-react';

export const RecentTransactions = ({ data, loading }) => {
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₫0';

    // Handle Mongoose Decimal128
    if (typeof amount === 'object' && amount.$numberDecimal) {
      return `₫${Number(amount.$numberDecimal).toLocaleString('vi-VN')}`;
    }

    return `₫${Number(amount).toLocaleString('vi-VN')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      processing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Processing' },
      shipping: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Shipping' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    };
    const config = statusMap[status?.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        </div>
        <div className="p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded flex-1"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <h3 className="text-[16px] font-semibold text-gray-900">
            Recent Transactions
          </h3>
          {data && data.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-semibold rounded-full">
              {data.length}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {data && data.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                  Order Number
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-6 py-3 text-right text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                  Total Payment
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-center text-[11px] font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((transaction, idx) => (
                <tr key={transaction.id || idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-[13px] font-semibold text-blue-600">
                      {transaction.orderNumber}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-[13px] font-medium text-gray-900">
                        {transaction.customerName}
                      </p>
                      {transaction.customerPhone && (
                        <p className="text-[11px] text-gray-500">
                          {transaction.customerPhone}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[14px] font-semibold text-emerald-600">
                      {formatCurrency(transaction.totalPayment)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] text-gray-600">
                      {formatDate(transaction.date)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(transaction.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-16 text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-[13px] text-gray-500">
              No recent transactions found
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
