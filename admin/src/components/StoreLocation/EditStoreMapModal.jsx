import React, { useState, useEffect } from 'react';
import { Save, Loader } from 'lucide-react';
import storeLocationService from '../../services/storeLocationService';
import { StoreLocationDetailModal } from './StoreLocationDetailModal';

export const EditStoreMapModal = ({ isOpen, onClose, onSuccess }) => {
  const [locations, setLocations] = useState([]);
  const [shelfGroups, setShelfGroups] = useState({});
  const [shelfColumnGaps, setShelfColumnGaps] = useState({}); // Track column gaps per shelf
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchLocations();
    }
  }, [isOpen]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const data = await storeLocationService.getAllStoreLocations();
      setLocations(data);

      // Group by shelves
      const groups = {};
      data.forEach(loc => {
        // Extract shelf section (e.g., "SHELF A" from "SHELF A01")
        const nameMatch = loc.name.match(/^(SHELF\s*[A-Z]+)/i);
        const shelfName = nameMatch ? nameMatch[1].toUpperCase() : 'OTHER';

        if (!groups[shelfName]) {
          groups[shelfName] = [];
        }
        groups[shelfName].push(loc);
      });

      // Sort locations within each shelf by number
      Object.keys(groups).forEach(shelfName => {
        groups[shelfName].sort((a, b) => {
          const numA = parseInt(a.name.match(/\d+$/)?.[0]) || 0;
          const numB = parseInt(b.name.match(/\d+$/)?.[0]) || 0;
          return numA - numB;
        });
      });

      setShelfGroups(groups);

      // Load column gaps from localStorage
      const savedGaps = {};
      Object.keys(groups).forEach(shelfName => {
        const saved = localStorage.getItem(`store-shelf-${shelfName}-gaps`);
        if (saved) {
          try {
            savedGaps[shelfName] = JSON.parse(saved);
          } catch (e) {
            savedGaps[shelfName] = [];
          }
        } else {
          savedGaps[shelfName] = [];
        }
      });
      setShelfColumnGaps(savedGaps);
    } catch (err) {
      setError('Failed to load store locations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationClick = (location) => {
    setSelectedLocation(location);
  };

  const handleDetailModalSuccess = () => {
    setSelectedLocation(null);
    fetchLocations(); // Refresh locations
    if (onSuccess) onSuccess(); // Notify parent
  };

  const toggleColumnGap = (shelfName, colNum) => {
    setShelfColumnGaps(prev => {
      const currentGaps = prev[shelfName] || [];
      const hasGap = currentGaps.includes(colNum);
      const newGaps = hasGap
        ? currentGaps.filter(g => g !== colNum)
        : [...currentGaps, colNum].sort((a, b) => a - b);

      // Save to localStorage
      localStorage.setItem(`store-shelf-${shelfName}-gaps`, JSON.stringify(newGaps));

      return {
        ...prev,
        [shelfName]: newGaps
      };
    });
  };

  const getShelfDimensions = (shelfLocations) => {
    const count = shelfLocations.length;
    const possibleRows = [6, 5, 4, 3, 2, 1];

    for (const rows of possibleRows) {
      if (count % rows === 0) {
        return { rows, cols: count / rows };
      }
    }

    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[20px] font-semibold text-gray-900">
              Edit Store Map
            </h2>
            <p className="text-[12px] text-gray-500 mt-1">
              Configure shelf layout and spacing. Click location to edit details.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Legend - Simplified for Store Map */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-emerald-500 border-2 border-emerald-600 rounded"></div>
                    <span className="text-gray-700 font-medium">Occupied</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-white border-2 border-gray-400 rounded"></div>
                    <span className="text-gray-700 font-medium">Empty</span>
                  </div>
                  <span className="text-xs text-gray-500 ml-auto">
                    * Column gaps are saved locally for this browser
                  </span>
                </div>
              </div>

              {/* Shelves */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {Object.keys(shelfGroups).sort().map(shelfName => {
                  const shelfLocations = shelfGroups[shelfName];
                  const { rows, cols } = getShelfDimensions(shelfLocations);

                  // Create grid array
                  const gridArray = Array(rows * cols).fill(null);
                  shelfLocations.forEach((location, idx) => {
                    gridArray[idx] = location;
                  });

                  const occupiedCount = shelfLocations.filter(l => l.batch).length;

                  return (
                    <div key={shelfName} className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-300">
                      <div className="mb-4 pb-3 border-b-2 border-gray-200">
                        <h3 className="text-xl font-bold text-gray-900">{shelfName}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {occupiedCount} occupied • {shelfLocations.length - occupiedCount} empty
                        </p>
                      </div>

                      {/* Column Gaps Configuration */}
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Column Spacing (Visual Only)
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500">Add gap after column:</span>
                          {Array.from({ length: cols - 1 }).map((_, idx) => {
                            const colNum = idx + 1;
                            const hasGap = shelfColumnGaps[shelfName]?.includes(colNum);
                            return (
                              <button
                                key={colNum}
                                onClick={() => toggleColumnGap(shelfName, colNum)}
                                className={`px-2 py-1 text-xs rounded border-2 transition-all ${hasGap
                                  ? 'bg-blue-500 border-blue-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                                  }`}
                              >
                                {colNum}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="inline-block border-2 border-gray-400 rounded-lg">
                        <div className="flex gap-0 p-2 bg-gray-300">
                          {Array.from({ length: cols }).map((_, colIdx) => {
                            const hasGapAfter = shelfColumnGaps[shelfName]?.includes(colIdx + 1);
                            return (
                              <React.Fragment key={colIdx}>
                                <div
                                  className="grid gap-1"
                                  style={{
                                    gridTemplateRows: `repeat(${rows}, 50px)`
                                  }}
                                >
                                  {Array.from({ length: rows }).map((_, rowIdx) => {
                                    const idx = colIdx * rows + rowIdx;
                                    const location = gridArray[idx];

                                    if (!location) {
                                      return (
                                        <div
                                          key={`empty-${rowIdx}-${colIdx}`}
                                          className="bg-gray-200 rounded border border-gray-300 opacity-30 w-[50px]"
                                        />
                                      );
                                    }

                                    const hasProduct = !!location.batch;
                                    let bgColor = hasProduct ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-gray-300';
                                    let textColor = hasProduct ? 'text-white' : 'text-gray-900';

                                    // Check if location is "active" logic? Store locations are always active.

                                    // Extract position number from name (e.g., "01" from "SHELF A01")
                                    const positionMatch = location.name.match(/\d+$/);
                                    const positionNumber = positionMatch ? positionMatch[0] : '';


                                    return (
                                      <button
                                        key={location.id}
                                        onClick={() => handleLocationClick(location)}
                                        className={`relative rounded border-2 transition-all w-[50px] ${bgColor} cursor-pointer hover:opacity-80`}
                                        title={`${location.name} - Click to edit`}
                                      >
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <span className={`text-[10px] font-bold ${textColor}`}>
                                            {positionNumber}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                {hasGapAfter && (
                                  <div className="w-3 bg-transparent" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <StoreLocationDetailModal
        isOpen={!!selectedLocation}
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
        onSuccess={handleDetailModalSuccess}
      />
    </div>
  );
};
