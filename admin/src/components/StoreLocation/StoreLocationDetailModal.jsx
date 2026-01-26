import React, { useState } from 'react';
import { X, Package, MapPin, Trash2, Edit } from 'lucide-react';
import storeLocationService from '../../services/storeLocationService';

export const StoreLocationDetailModal = ({ isOpen, location, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');

  if (!isOpen || !location) return null;

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to remove batch "${location.batchCode}" from "${location.name}"?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await storeLocationService.deleteStoreLocation(location.id);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error deleting store location:', err);
      setError(err.response?.data?.error || 'Failed to delete store location');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!newName.trim()) {
      setError('Location name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await storeLocationService.updateStoreLocation(location.id, {
        name: newName.trim().toUpperCase()
      });
      setIsEditing(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error updating store location:', err);
      setError(err.response?.data?.error || 'Failed to update store location');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    setNewName(location.name);
    setIsEditing(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Location' : location.name}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Location Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase"
                  placeholder="SHELF A01"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Location Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{location.name}</p>
                    <p className="text-xs text-gray-500">Store Location</p>
                  </div>
                </div>
              </div>

              {/* Batch Info */}
              {location.batch ? (
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Assigned Batch</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Batch Code:</span>
                      <span className="text-sm font-medium text-gray-900">{location.batchCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Product:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {location.batch?.product?.name || 'Unknown'}
                      </span>
                    </div>
                    {location.inventory && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">On Shelf:</span>
                          <span className="text-sm font-medium text-emerald-600">
                            {location.inventory.quantityOnShelf}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Reserved:</span>
                          <span className="text-sm font-medium text-yellow-600">
                            {location.inventory.quantityReserved}
                          </span>
                        </div>
                      </>
                    )}
                    {location.batch?.expiryDate && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Expiry:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(location.batch.expiryDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No batch assigned</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {/* Primary Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={startEditing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    Rename
                  </button>

                  {location.batch ? (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Unassign batch "${location.batchCode}" from "${location.name}"?`)) return;
                        setLoading(true);
                        try {
                          await storeLocationService.updateStoreLocation(location.id, { batchCode: null });
                          if (onSuccess) onSuccess();
                        } catch (err) {
                          setError('Failed to unassign batch');
                          setLoading(false);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-orange-200 text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 text-sm font-medium"
                    >
                      <X className="w-4 h-4" />
                      Unassign
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (onSuccess) onSuccess('assign'); // Signal to parent to open assign modal
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium"
                    >
                      <div className="w-4 h-4 flex items-center justify-center font-bold">+</div>
                      Assign Batch
                    </button>
                  )}
                </div>

                {/* Destructive Action */}
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50 mt-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Location Slot
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
