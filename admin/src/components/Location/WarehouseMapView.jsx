import React, { useMemo, useState, useEffect } from 'react';
import { MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { LocationDetailModal } from './LocationDetailModal';
import locationService from '../../services/locationService';

export const WarehouseMapView = ({ locations, onLocationClick, onRefresh }) => {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [blockColumnGaps, setBlockColumnGaps] = useState({});
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Handle location update after batch assignment
  const handleLocationUpdate = async () => {
    // Refresh the selected location with fresh data
    if (selectedLocation) {
      try {
        const locationId = selectedLocation._id || selectedLocation.id;
        const updatedLocation = await locationService.getLocationById(locationId);
        setSelectedLocation(updatedLocation);
      } catch (error) {
        console.error('Error refreshing location:', error);
      }
    }

    // Notify parent to refresh all locations
    if (onRefresh) {
      onRefresh();
    }
  };

  // Group locations by block (first letter/character before hyphen)
  const blockGroups = useMemo(() => {
    const groups = {};

    locations.forEach(location => {
      const blockName = location.name.split('-')[0];
      if (!groups[blockName]) {
        groups[blockName] = [];
      }
      groups[blockName].push(location);
    });

    // Sort locations within each block
    Object.keys(groups).forEach(blockName => {
      groups[blockName].sort((a, b) => {
        const numA = parseInt(a.name.split('-')[1]) || 0;
        const numB = parseInt(b.name.split('-')[1]) || 0;
        return numA - numB;
      });
    });

    return groups;
  }, [locations]);

  // Load column gaps from localStorage when blockGroups change
  useEffect(() => {
    const gaps = {};
    Object.keys(blockGroups).forEach(blockName => {
      const saved = localStorage.getItem(`warehouse-block-${blockName}-gaps`);
      if (saved) {
        try {
          gaps[blockName] = JSON.parse(saved);
        } catch (e) {
          gaps[blockName] = [];
        }
      } else {
        gaps[blockName] = [];
      }
    });
    setBlockColumnGaps(gaps);
  }, [blockGroups]);

  // Calculate grid dimensions for each block
  const getBlockDimensions = (blockLocations) => {
    const count = blockLocations.length;

    // Try to detect pattern from location numbers
    // Common patterns: 6 rows x N cols (numbering vertically)
    const possibleRows = [6, 5, 4, 3, 2, 1];

    for (const rows of possibleRows) {
      if (count % rows === 0) {
        return { rows, cols: count / rows };
      }
    }

    // Fallback: square-ish grid
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
  };

  const renderBlock = (blockName, blockLocations) => {
    const { rows, cols } = getBlockDimensions(blockLocations);
    const columnGaps = blockColumnGaps[blockName] || [];

    // Calculate capacity for location
    const getLocationCapacity = (location) => {
      const occupiedCapacity = location.currentBatches?.reduce((total, batch) => {
        return total + (batch.quantityOnHand || 0);
      }, 0) || 0;
      const maxCapacity = location.maxCapacity || 100;
      const capacityPercent = (occupiedCapacity / maxCapacity) * 100;

      return { occupiedCapacity, maxCapacity, capacityPercent };
    };

    // Create a grid array to properly position locations
    const gridArray = Array(rows * cols).fill(null);

    blockLocations.forEach((location, idx) => {
      gridArray[idx] = location;
    });

    // Count locations by status
    const emptyCount = blockLocations.filter(l => {
      const { capacityPercent } = getLocationCapacity(l);
      return capacityPercent === 0;
    }).length;

    const nearlyFullCount = blockLocations.filter(l => {
      const { capacityPercent } = getLocationCapacity(l);
      return capacityPercent > 80 && capacityPercent < 100;
    }).length;

    const fullCount = blockLocations.filter(l => {
      const { capacityPercent } = getLocationCapacity(l);
      return capacityPercent > 90;
    }).length;

    return (
      <div key={blockName} className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-300">
        {/* Block Header */}
        <div className="mb-4 pb-3 border-b-2 border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Block {blockName}</h3>
          <p className="text-sm text-gray-600 mt-1">
            <span className="text-gray-600 font-medium">{emptyCount} empty</span>
            {' • '}
            <span className="text-yellow-600 font-medium">{nearlyFullCount} nearly full</span>
            {' • '}
            <span className="text-red-600 font-medium">{fullCount} full</span>
          </p>
        </div>

        {/* Grid Container */}
        <div className="overflow-visible">
          <div className="inline-block border-2 border-gray-400 rounded-lg">
            <div className="flex gap-0 p-2 bg-gray-300">
              {Array.from({ length: cols }).map((_, colIdx) => {
                const hasGapAfter = columnGaps.includes(colIdx + 1);
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

                        const { occupiedCapacity, maxCapacity, capacityPercent } = getLocationCapacity(location);
                        const active = location.isActive;

                        // Determine color based on capacity
                        let bgColor = 'bg-white border-gray-300'; // Empty
                        let textColor = 'text-gray-900';

                        if (!active) {
                          bgColor = 'bg-gray-300 border-gray-400';
                          textColor = 'text-gray-600';
                        } else if (capacityPercent > 90) {
                          bgColor = 'bg-red-500 border-red-600 hover:bg-red-600';
                          textColor = 'text-white';
                        } else if (capacityPercent > 80) {
                          bgColor = 'bg-yellow-400 border-yellow-500 hover:bg-yellow-500';
                          textColor = 'text-gray-900';
                        } else if (capacityPercent > 0) {
                          bgColor = 'bg-emerald-500 border-emerald-600 hover:bg-emerald-600';
                          textColor = 'text-white';
                        }

                        return (
                          <div
                            key={location.id}
                            onClick={() => setSelectedLocation(location)}
                            className={`relative rounded border-2 transition-all cursor-pointer group w-[50px] ${bgColor} hover:shadow-lg`}
                          >
                            {/* Location Content */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                              {/* Location Name */}
                              <span className={`text-[10px] font-bold ${textColor}`}>
                                {location.name.split('-')[1]}
                              </span>
                            </div>

                            {/* Inactive Badge */}
                            {!active && (
                              <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[6px] px-1 py-0.5 rounded font-bold">
                                OFF
                              </span>
                            )}

                            {/* Hover Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-[9999] pointer-events-none">
                              <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                <div className="font-bold">{location.name}</div>
                                <div className="text-[10px] text-gray-300">{location.locationCode}</div>
                                <div className="text-[10px] text-gray-400 mt-1">
                                  Capacity: {occupiedCapacity} / {maxCapacity} ({capacityPercent.toFixed(1)}%)
                                </div>
                                {location.currentBatches && location.currentBatches.length > 0 && (
                                  <>
                                    <div className="mt-1 pt-1 border-t border-gray-700">
                                      <div className="text-emerald-300 font-medium">
                                        {location.currentBatches.length} batch{location.currentBatches.length > 1 ? 'es' : ''}
                                      </div>
                                      {location.currentBatches.slice(0, 3).map((batch, idx) => (
                                        <div key={idx} className="text-[10px] text-gray-400">
                                          {batch.batchId?.batchCode} - {batch.batchId?.product?.name}
                                        </div>
                                      ))}
                                      {location.currentBatches.length > 3 && (
                                        <div className="text-[10px] text-gray-500 italic">
                                          +{location.currentBatches.length - 3} more
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                              {/* Arrow */}
                              <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 mx-auto"></div>
                            </div>
                          </div>
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
      </div>
    );
  };

  if (Object.keys(blockGroups).length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No warehouse map</h3>
        <p className="text-sm text-gray-500">Create locations using the Map Builder to see the layout</p>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
        <div className="flex items-center gap-8">
          <h4 className="text-sm font-bold text-gray-700">Legend:</h4>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white border-2 border-gray-300 rounded"></div>
            <span className="text-sm text-gray-700 font-medium">Empty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 border-2 border-emerald-600 rounded"></div>
            <span className="text-sm text-gray-700 font-medium">In Use (&lt;80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-400 border-2 border-yellow-500 rounded"></div>
            <span className="text-sm text-gray-700 font-medium">Nearly Full (&gt;80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500 border-2 border-red-600 rounded"></div>
            <span className="text-sm text-gray-700 font-medium">Full (&gt;90%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-300 border-2 border-gray-400 rounded"></div>
            <span className="text-sm text-gray-700 font-medium">Inactive</span>
          </div>
        </div>
      </div>

      {/* Blocks Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Object.keys(blockGroups)
          .sort()
          .map(blockName => renderBlock(blockName, blockGroups[blockName]))}
      </div>

      {/* Location Detail Modal */}
      <LocationDetailModal
        isOpen={!!selectedLocation}
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
        onSuccess={handleLocationUpdate}
      />
    </div>
  );
};
