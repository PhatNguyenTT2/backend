import React, { useState, useEffect } from 'react';
import inventoryService from '../../services/inventoryService';

export const MovementHistoryModal = ({ isOpen, onClose, productId, productName, productSku }) => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'in', 'out', 'adjustments'

  useEffect(() => {
    const fetchMovements = async () => {
      if (!isOpen || !productId) return;

      setLoading(true);
      setError(null);

      try {
        console.log('Fetching movements for product:', productId);

        const data = await inventoryService.getMovements(productId, { limit: 50 });
        console.log('Movement data:', data);

        setMovements(data.movements || []);
      } catch (err) {
        console.error('Error fetching movements:', err);
        setError(err.error || err.message || 'Failed to load movement history');
      } finally {
        setLoading(false);
      }
    };

    fetchMovements();
  }, [isOpen, productId]);

  if (!isOpen) return null;

  // Filter movements based on selected tab
  const filteredMovements = (() => {
    if (filter === 'all') return movements;
    if (filter === 'in') return movements.filter(m => m.type === 'in');
    if (filter === 'out') return movements.filter(m => m.type === 'out');
    if (filter === 'adjustments') {
      // Group adjustment, reserved, and released together
      return movements.filter(m => ['adjustment', 'reserved', 'released'].includes(m.type));
    }
    return movements;
  })();

  const getMovementTypeBadge = (type) => {
    const badges = {
      'in': { bg: 'bg-green-100', text: 'text-green-700', label: 'Stock In' },
      'out': { bg: 'bg-red-100', text: 'text-red-700', label: 'Stock Out' },
      'adjustment': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Adjustment' },
      'reserved': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Reserved' },
      'released': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Released' }
    };

    const badge = badges[type] || badges['adjustment'];

    return (
      <span className={`${badge.bg} ${badge.text} px-2 py-1 rounded text-[10px] font-bold font-['Poppins',sans-serif] uppercase`}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
              Movement History
            </h2>
            <p className="text-[13px] text-gray-600 font-['Poppins',sans-serif] mt-1">
              {productSku && `${productSku} - `}{productName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-200">
          {[
            { value: 'all', label: 'All' },
            { value: 'in', label: 'Stock In' },
            { value: 'out', label: 'Stock Out' },
            { value: 'adjustments', label: 'Adjustments' }
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-['Poppins',sans-serif] font-medium transition-colors ${filter === value
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px] font-['Poppins',sans-serif]">
              {error}
            </div>
          )}

          {!loading && !error && filteredMovements.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-[14px] font-['Poppins',sans-serif]">
                No movement history found
              </p>
            </div>
          )}

          {!loading && !error && filteredMovements.length > 0 && (
            <div className="space-y-3">
              {filteredMovements.map((movement, index) => (
                <div
                  key={movement._id || index}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getMovementTypeBadge(movement.type)}
                        <span className="text-[13px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                          {(() => {
                            // For 'in' type: always increase
                            if (movement.type === 'in') return `+${movement.quantity} units`;

                            // For 'out' type: always decrease
                            if (movement.type === 'out') return `-${movement.quantity} units`;

                            // For 'adjustment': check adjustmentType field first, then fallback to reason
                            if (movement.type === 'adjustment') {
                              const isIncrease = movement.adjustmentType === 'increase' ||
                                movement.reason?.toLowerCase().includes('increase') ||
                                movement.reason?.toLowerCase().includes('+');
                              return `${isIncrease ? '+' : '-'}${movement.quantity} units`;
                            }

                            // For 'reserved': decrease available
                            if (movement.type === 'reserved') return `-${movement.quantity} units (reserved)`;

                            // For 'released': increase available
                            if (movement.type === 'released') return `+${movement.quantity} units (released)`;

                            // Default
                            return `${movement.quantity} units`;
                          })()}
                        </span>
                        <span className="text-[12px] text-gray-500 font-['Poppins',sans-serif]">
                          {formatDate(movement.date)}
                        </span>
                      </div>

                      {movement.reason && (
                        <p className="text-[13px] text-gray-700 font-['Poppins',sans-serif] mb-1">
                          <span className="font-medium">Reason:</span> {movement.reason}
                        </p>
                      )}

                      {movement.referenceId && (
                        <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif]">
                          <span className="font-medium">Ref:</span> {movement.referenceId}
                          {movement.referenceType && ` (${movement.referenceType})`}
                        </p>
                      )}

                      {movement.notes && (
                        <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif] mt-1 italic">
                          {movement.notes}
                        </p>
                      )}

                      {movement.performedBy && (
                        <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif] mt-2">
                          By: {movement.performedBy.username || movement.performedBy}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-[12px] text-gray-600 font-['Poppins',sans-serif]">
            {filteredMovements.length} {filteredMovements.length === 1 ? 'movement' : 'movements'} found
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-[13px] font-['Poppins',sans-serif] font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

