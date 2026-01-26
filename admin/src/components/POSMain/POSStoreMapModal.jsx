import React, { useState, useEffect } from 'react';
import { X, Map as MapIcon } from 'lucide-react';
import { StoreMapView } from '../StoreLocation';
import storeLocationService from '../../services/storeLocationService';

export const POSStoreMapModal = ({ isOpen, onClose, onAddBatch }) => {
  const [storeLocations, setStoreLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchStoreLocations();
    }
  }, [isOpen]);

  const fetchStoreLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await storeLocationService.getAllStoreLocations();
      setStoreLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching store locations:', err);
      setError('Failed to load store map');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationClick = (location) => {
    if (!location.batch) {
      return;
    }

    // Pass the batch details to the parent handler
    onAddBatch(location.batch);
    // Optional: Close modal after selection? Or keep open for multiple picks?
    // Let's keep it open for now, maybe show a toast or feedback.
    // For now, user can manually close.
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get unique products currently on shelf for suggestions
  const productSuggestions = React.useMemo(() => {
    if (!searchTerm.trim()) return [];
    const query = searchTerm.toLowerCase();

    const uniqueProducts = new Map();
    storeLocations.forEach(loc => {
      if (loc.batch && loc.batch.product) {
        const productName = loc.batch.product.name;
        if (productName.toLowerCase().includes(query)) {
          uniqueProducts.set(productName, loc.batch.product);
        }
      }
    });

    return Array.from(uniqueProducts.values()).slice(0, 5); // Limit to 5 suggestions
  }, [storeLocations, searchTerm]);

  // New: Calculate highlighted IDs based on search
  const highlightedLocationIds = React.useMemo(() => {
    if (!searchTerm.trim()) return null; // No filter
    const query = searchTerm.toLowerCase();

    return storeLocations
      .filter(loc => {
        // Search by Product Name or Batch Code
        if (!loc.batch) return false;
        const productName = loc.batch.product?.name?.toLowerCase() || '';
        const batchCode = loc.batchCode?.toLowerCase() || '';
        return productName.includes(query) || batchCode.includes(query);
      })
      .map(loc => loc.id);
  }, [storeLocations, searchTerm]);

  const handleSuggestionClick = (productName) => {
    setSearchTerm(productName);
    setShowSuggestions(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-2 mr-4">
              <MapIcon className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Store Map View</h2>
                <p className="text-xs text-gray-500">Select product from shelf</p>
              </div>
            </div>

            {/* Search Input with Suggestions */}
            <div className="relative max-w-md w-full">
              <input
                type="text"
                placeholder="Search product on shelf..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                autoFocus
              />
              <svg
                className="absolute left-3 top-2.5 text-gray-400 w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>

              {/* Suggestions Dropdown */}
              {showSuggestions && productSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {productSuggestions.map((product) => (
                    <button
                      key={product._id}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 flex items-center justify-between"
                      onClick={() => handleSuggestionClick(product.name)}
                    >
                      <span className="font-medium">{product.name}</span>
                      <span className="text-xs text-gray-400">{product.productCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Legend in Header */}
            <div className="flex items-center gap-4 ml-6 pl-6 border-l border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border border-gray-300 rounded-sm"></div>
                <span className="text-xs text-gray-600">Empty</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-500 border border-emerald-600 rounded-sm"></div>
                <span className="text-xs text-gray-600">Occupied</span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Centered & Minimal */}
        <div className="p-6 bg-gray-50 flex-1 overflow-auto flex items-center justify-center relative">
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-600">
              <p>{error}</p>
              <button
                onClick={fetchStoreLocations}
                className="mt-4 px-4 py-2 text-sm bg-white border border-red-200 rounded-lg hover:bg-red-50"
              >
                Retry
              </button>
            </div>
          ) : (
            // Wrapper for centering the Grid with Border
            <div className="flex items-center justify-center p-12 bg-white rounded-xl shadow-sm border-4 border-gray-200">
              <div className="transform scale-125 origin-center p-4">
                <StoreMapView
                  storeLocations={storeLocations}
                  onRefresh={fetchStoreLocations}
                  onLocationClick={handleLocationClick}
                  highlightedLocationIds={highlightedLocationIds}
                  minimal={true}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
