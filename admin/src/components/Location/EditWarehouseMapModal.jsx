import React, { useState, useEffect } from 'react';
import { Save, Loader } from 'lucide-react';
import locationService from '../../services/locationService';
import { EditLocationModal } from './EditLocationModal';

export const EditWarehouseMapModal = ({ isOpen, onClose, onSuccess }) => {
  const [locations, setLocations] = useState([]);
  const [blockGroups, setBlockGroups] = useState({});
  const [blockColumnGaps, setBlockColumnGaps] = useState({}); // Track column gaps per block
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editLocationModalOpen, setEditLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchLocations();
    }
  }, [isOpen]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const data = await locationService.getAllLocations();
      setLocations(data);

      // Group by blocks
      const groups = {};
      data.forEach(loc => {
        const blockName = loc.name.split('-')[0];
        if (!groups[blockName]) {
          groups[blockName] = [];
        }
        groups[blockName].push(loc);
      });

      // Sort locations within each block by number
      Object.keys(groups).forEach(blockName => {
        groups[blockName].sort((a, b) => {
          const numA = parseInt(a.name.split('-')[1]) || 0;
          const numB = parseInt(b.name.split('-')[1]) || 0;
          return numA - numB;
        });
      });

      setBlockGroups(groups);

      // Load column gaps from localStorage
      const savedGaps = {};
      Object.keys(groups).forEach(blockName => {
        const saved = localStorage.getItem(`warehouse-block-${blockName}-gaps`);
        if (saved) {
          try {
            savedGaps[blockName] = JSON.parse(saved);
          } catch (e) {
            savedGaps[blockName] = [];
          }
        } else {
          savedGaps[blockName] = [];
        }
      });
      setBlockColumnGaps(savedGaps);
    } catch (err) {
      setError('Failed to load locations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationClick = (location) => {
    setSelectedLocation(location);
    setEditLocationModalOpen(true);
  };

  const handleEditLocationSuccess = () => {
    setEditLocationModalOpen(false);
    setSelectedLocation(null);
    fetchLocations(); // Refresh locations
  };

  const toggleLocationActive = (locationId) => {
    setLocations(prevLocs =>
      prevLocs.map(loc =>
        loc.id === locationId ? { ...loc, isActive: !loc.isActive } : loc
      )
    );

    // Update blockGroups
    setBlockGroups(prevGroups => {
      const newGroups = { ...prevGroups };
      Object.keys(newGroups).forEach(blockName => {
        newGroups[blockName] = newGroups[blockName].map(loc =>
          loc.id === locationId ? { ...loc, isActive: !loc.isActive } : loc
        );
      });
      return newGroups;
    });
  };

  const toggleColumnGap = (blockName, colNum, maxCols) => {
    setBlockColumnGaps(prev => {
      const currentGaps = prev[blockName] || [];
      const hasGap = currentGaps.includes(colNum);
      const newGaps = hasGap
        ? currentGaps.filter(g => g !== colNum)
        : [...currentGaps, colNum].sort((a, b) => a - b);

      // Save to localStorage
      localStorage.setItem(`warehouse-block-${blockName}-gaps`, JSON.stringify(newGaps));

      return {
        ...prev,
        [blockName]: newGaps
      };
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    setError('');

    try {
      // Get locations that changed active status
      const originalLocations = await locationService.getAllLocations();
      const changedLocations = locations.filter(loc => {
        const original = originalLocations.find(o => o.id === loc.id);
        return original && original.isActive !== loc.isActive;
      });

      // Update each changed location
      const updatePromises = changedLocations.map(loc =>
        locationService.updateLocation(loc.id, { isActive: loc.isActive })
          .catch(err => {
            console.warn(`Failed to update ${loc.name}:`, err.response?.data?.error || err.message);
            return null;
          })
      );

      await Promise.all(updatePromises);

      if (onSuccess) onSuccess();
      if (onClose) onClose();

      alert(`Successfully updated ${changedLocations.length} location(s)`);
    } catch (err) {
      console.error('Error saving changes:', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getBlockDimensions = (blockLocations) => {
    const count = blockLocations.length;
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
              Edit Warehouse Map
            </h2>
            <p className="text-[12px] text-gray-500 mt-1">
              Toggle locations active/inactive. Inactive locations won't be available for inventory.
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
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-emerald-500 border-2 border-emerald-600 rounded"></div>
                    <span className="text-gray-700 font-medium">Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-300 border-2 border-gray-400 rounded"></div>
                    <span className="text-gray-700 font-medium">Inactive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-yellow-400 border-2 border-yellow-500 rounded"></div>
                    <span className="text-gray-700 font-medium">In Use (Cannot Deactivate)</span>
                  </div>
                </div>
              </div>

              {/* Blocks */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {Object.keys(blockGroups).sort().map(blockName => {
                  const blockLocations = blockGroups[blockName];
                  const { rows, cols } = getBlockDimensions(blockLocations);

                  // Create grid array
                  const gridArray = Array(rows * cols).fill(null);
                  blockLocations.forEach((location, idx) => {
                    gridArray[idx] = location;
                  });

                  const activeCount = blockLocations.filter(l => l.isActive).length;
                  const inUseCount = blockLocations.filter(l =>
                    l.currentBatches && l.currentBatches.length > 0
                  ).length;

                  return (
                    <div key={blockName} className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-300">
                      <div className="mb-4 pb-3 border-b-2 border-gray-200">
                        <h3 className="text-xl font-bold text-gray-900">Block {blockName}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {activeCount} active • {inUseCount} in use
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
                            const hasGap = blockColumnGaps[blockName]?.includes(colNum);
                            return (
                              <button
                                key={colNum}
                                onClick={() => toggleColumnGap(blockName, colNum, cols)}
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
                        <p className="text-[10px] text-gray-400 mt-1">
                          Click column numbers to add visual spacing after that column
                        </p>
                      </div>

                      <div className="inline-block border-2 border-gray-400 rounded-lg">
                        <div className="flex gap-0 p-2 bg-gray-300">
                          {Array.from({ length: cols }).map((_, colIdx) => {
                            const hasGapAfter = blockColumnGaps[blockName]?.includes(colIdx + 1);
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

                                    const hasInventory = location.currentBatches && location.currentBatches.length > 0;

                                    let bgColor = 'bg-white border-gray-300';
                                    if (!location.isActive) {
                                      bgColor = 'bg-gray-300 border-gray-400';
                                    } else if (hasInventory) {
                                      bgColor = 'bg-yellow-400 border-yellow-500';
                                    } else {
                                      bgColor = 'bg-emerald-500 border-emerald-600';
                                    }

                                    return (
                                      <button
                                        key={location.id}
                                        onClick={() => handleLocationClick(location)}
                                        className={`relative rounded border-2 transition-all w-[50px] ${bgColor} cursor-pointer hover:opacity-80`}
                                        title={`${location.name} - Click to edit`}
                                      >
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <span className={`text-[10px] font-bold ${location.isActive ? (hasInventory ? 'text-gray-900' : 'text-white') : 'text-gray-600'
                                            }`}>
                                            {location.name.split('-')[1]}
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
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveChanges}
              disabled={saving || loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Location Modal */}
      <EditLocationModal
        isOpen={editLocationModalOpen}
        onClose={() => {
          setEditLocationModalOpen(false);
          setSelectedLocation(null);
        }}
        onSuccess={handleEditLocationSuccess}
        location={selectedLocation}
      />
    </div>
  );
};
