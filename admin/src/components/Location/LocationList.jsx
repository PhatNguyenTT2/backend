import React from 'react';
import { MapPin, Edit2, Trash2, Package } from 'lucide-react';

export const LocationList = ({
  locations,
  onEdit,
  onDelete,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No locations found</h3>
        <p className="text-sm text-gray-500">Get started by creating a new location</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
      {locations.map((location) => {
        const isOccupied = location.currentBatches && location.currentBatches.length > 0;
        const batchCount = location.currentBatches?.length || 0;

        return (
          <div
            key={location.id}
            className={`relative rounded-lg shadow-sm hover:shadow-md transition-all p-4 border-2 cursor-pointer group ${isOccupied
              ? 'bg-emerald-500 border-emerald-600 hover:bg-emerald-600'
              : 'bg-white border-gray-300 hover:border-emerald-400'
              }`}
            onClick={() => onEdit(location)}
          >
            {/* Location Icon */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className={`p-3 rounded-full ${isOccupied ? 'bg-white/20' : 'bg-gray-100'
                }`}>
                <MapPin className={`w-6 h-6 ${isOccupied ? 'text-white' : 'text-gray-500'
                  }`} />
              </div>

              {/* Location Name */}
              <div className="text-center">
                <p className={`text-sm font-bold ${isOccupied ? 'text-white' : 'text-gray-900'
                  }`}>
                  {location.name}
                </p>
                <p className={`text-[10px] ${isOccupied ? 'text-white/80' : 'text-gray-500'
                  }`}>
                  {location.locationCode}
                </p>
              </div>

              {/* Batch Info (if occupied) */}
              {isOccupied && (
                <div className="mt-1 text-center">
                  <p className="text-[10px] text-white/90 font-medium">
                    {batchCount} batch{batchCount > 1 ? 'es' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Status Badge - Top Right */}
            {!location.isActive && (
              <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500 text-white">
                Inactive
              </span>
            )}

            {/* Action Buttons - Hidden, Show on Hover */}
            <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(location);
                }}
                className="p-2 bg-white rounded-lg hover:bg-emerald-50 transition-colors"
                title="Edit location"
              >
                <Edit2 className="w-4 h-4 text-emerald-600" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isOccupied) onDelete(location);
                }}
                disabled={isOccupied}
                className={`p-2 rounded-lg transition-colors ${isOccupied
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-white hover:bg-red-50'
                  }`}
                title={isOccupied ? 'Cannot delete occupied location' : 'Delete location'}
              >
                <Trash2 className={`w-4 h-4 ${isOccupied ? 'text-gray-500' : 'text-red-600'
                  }`} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
