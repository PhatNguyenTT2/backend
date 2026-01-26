import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';

export const StoreMapView = ({ storeLocations, onRefresh, onLocationClick, highlightedLocationIds = null, minimal = false }) => {
  // Group locations by shelf section (e.g., "SHELF A" from "SHELF A01")
  const shelfGroups = useMemo(() => {
    // ... existing logic ...
    const groups = {};
    storeLocations.forEach(location => {
      const nameMatch = location.name.match(/^(SHELF\s*[A-Z]+)/i);
      const shelfName = nameMatch ? nameMatch[1].toUpperCase() : 'OTHER';
      if (!groups[shelfName]) groups[shelfName] = [];
      groups[shelfName].push(location);
    });
    // ... sorting ...
    Object.keys(groups).forEach(shelfName => {
      groups[shelfName].sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+$/)?.[0]) || 0;
        const numB = parseInt(b.name.match(/\d+$/)?.[0]) || 0;
        return numA - numB;
      });
    });
    return groups;
  }, [storeLocations]);

  // ... state ...
  const [shelfColumnGaps, setShelfColumnGaps] = useState({});

  // ... useEffect ...
  React.useEffect(() => {
    const gaps = {};
    Object.keys(shelfGroups).forEach(shelfName => {
      const saved = localStorage.getItem(`store-shelf-${shelfName}-gaps`);
      if (saved) {
        try {
          gaps[shelfName] = JSON.parse(saved);
        } catch (e) {
          gaps[shelfName] = [];
        }
      } else {
        gaps[shelfName] = [];
      }
    });
    setShelfColumnGaps(gaps);
  }, [shelfGroups]);

  // ... getShelfDimensions ...
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

  const renderShelf = (shelfName, shelfLocations) => {
    const { rows, cols } = getShelfDimensions(shelfLocations);
    const columnGaps = shelfColumnGaps[shelfName] || [];

    // Create grid array
    const gridArray = Array(rows * cols).fill(null);
    shelfLocations.forEach((location, idx) => {
      gridArray[idx] = location;
    });

    // Count stats
    const occupiedCount = shelfLocations.filter(l => l.batch).length;
    const emptyCount = shelfLocations.length - occupiedCount;

    return (
      <div key={shelfName} className={`${minimal ? '' : 'bg-white rounded-lg shadow-md p-6 border-2 border-gray-300'}`}>
        {/* Shelf Header - Hide if minimal */}
        {!minimal && (
          <div className="mb-4 pb-3 border-b-2 border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">{shelfName}</h3>
            <p className="text-sm text-gray-600 mt-1">
              <span className="text-emerald-600 font-medium">{occupiedCount} occupied</span>
              {' • '}
              <span className="text-gray-600 font-medium">{emptyCount} empty</span>
            </p>
          </div>
        )}

        {/* Grid Container */}
        <div className="overflow-visible">
          <div className={`inline-block ${minimal ? 'border-none' : 'border-2 border-gray-400 rounded-lg'}`}>
            <div className={`flex gap-0 ${minimal ? '' : 'p-2 bg-gray-300'}`}>
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

                        const hasProduct = !!location.batch;
                        const isHighlighted = highlightedLocationIds
                          ? highlightedLocationIds.includes(location.id)
                          : true; // If no highlight filter, all are "highlighted"

                        // Default styles
                        let bgColor = 'bg-white border-gray-300 hover:bg-gray-50';
                        let textColor = 'text-gray-900';
                        let opacityClass = isHighlighted ? 'opacity-100' : 'opacity-40 grayscale';
                        let borderClass = 'border-2';

                        if (hasProduct) {
                          bgColor = 'bg-emerald-500 border-emerald-600 hover:bg-emerald-600';
                          textColor = 'text-white';

                          // If highlighted among others, give it a glow or stronger border?
                          // The opacity difference handles the focus well enough.
                        }

                        // Override background if NOT highlighted? The opacity handles it.

                        // Extract position number
                        const positionMatch = location.name.match(/\d+$/);
                        const positionNumber = positionMatch ? positionMatch[0] : '';

                        return (
                          <div
                            key={location.id}
                            onClick={() => onLocationClick && onLocationClick(location)}
                            className={`relative rounded transition-all cursor-pointer group w-[50px] ${bgColor} ${borderClass} ${opacityClass} hover:shadow-lg`}
                          >

                            {/* Location Content */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                              <span className={`text-[10px] font-bold ${textColor}`}>
                                {positionNumber}
                              </span>
                            </div>

                            {/* Hover Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-[9999] pointer-events-none">
                              <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                <div className="font-bold">{location.name}</div>
                                {hasProduct ? (
                                  <>
                                    <div className="text-[10px] text-emerald-300 mt-1">
                                      {location.batchCode}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                      {location.batch?.product?.name || 'Unknown Product'}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                      On Shelf: {location.inventory?.quantityOnShelf || 0}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-[10px] text-gray-400 mt-1">
                                    Empty slot<br />
                                    Click to assign
                                  </div>
                                )}
                              </div>
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
                )
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (Object.keys(shelfGroups).length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No store locations</h3>
        <p className="text-sm text-gray-500">Create layout using 'Build Layout' or assign batches manually.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Legend - Hide if minimal */}
      {!minimal && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <div className="flex items-center gap-8">
            <h4 className="text-sm font-bold text-gray-700">Legend:</h4>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white border-2 border-gray-300 rounded"></div>
              <span className="text-sm text-gray-700 font-medium">Empty</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 border-2 border-emerald-600 rounded"></div>
              <span className="text-sm text-gray-700 font-medium">Occupied</span>
            </div>
          </div>
        </div>
      )}

      {/* Shelves Grid */}
      <div className="flex flex-wrap justify-center gap-6 w-full">
        {Object.keys(shelfGroups)
          .sort()
          .map(shelfName => renderShelf(shelfName, shelfGroups[shelfName]))}
      </div>
    </div>
  );
};
