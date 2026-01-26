import React, { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import storeLocationService from '../../services/storeLocationService';

export const StoreMapBuilder = ({ isOpen, onClose, onSuccess }) => {
  const [shelves, setShelves] = useState([
    { id: 1, name: '', rows: 1, cols: 6 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper: Check if there are duplicate shelf names
  const hasDuplicateShelfNames = () => {
    const shelfNames = shelves.map(s => s.name.toUpperCase().trim());
    return shelfNames.length !== new Set(shelfNames).size;
  };

  // Helper: Check if shelf name is valid
  const isValidShelfName = (name) => {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= 10 && /^[A-Z0-9\s]+$/i.test(trimmed);
  };

  const addShelf = () => {
    setError('');
    setShelves([...shelves, {
      id: Date.now(),
      name: '',
      rows: 1,
      cols: 6
    }]);
  };

  const updateShelf = (id, field, value) => {
    if (field === 'name') {
      const normalizedValue = value.toUpperCase().trim();

      if (normalizedValue && !isValidShelfName(normalizedValue)) {
        setError(`Invalid shelf name "${normalizedValue}". Use alphanumeric characters only.`);
        return;
      }

      const isDuplicate = shelves.some(shelf =>
        shelf.id !== id && shelf.name.toUpperCase().trim() === normalizedValue
      );

      if (isDuplicate) {
        setError(`Shelf name "${normalizedValue}" already exists.`);
        return;
      }

      setError('');
    }

    setShelves(shelves.map(shelf =>
      shelf.id === id ? { ...shelf, [field]: value } : shelf
    ));
  };

  const removeShelf = (id) => {
    setShelves(shelves.filter(shelf => shelf.id !== id));
  };

  const getTotalPositions = () => {
    return shelves.reduce((sum, s) => sum + (s.rows * s.cols), 0);
  };

  const generateLocations = async () => {
    setLoading(true);
    setError('');

    // Validate shelf names
    const invalidShelves = shelves.filter(s => !isValidShelfName(s.name));
    if (invalidShelves.length > 0) {
      setError(`Invalid shelf name(s): ${invalidShelves.map(s => `"${s.name}"`).join(', ')}`);
      setLoading(false);
      return;
    }

    // Validate unique shelf names
    if (hasDuplicateShelfNames()) {
      setError('Each shelf must have a unique name.');
      setLoading(false);
      return;
    }

    // Validate positions
    if (shelves.some(s => s.rows <= 0 || s.cols <= 0)) {
      setError('All shelves must have at least 1 row and 1 column.');
      setLoading(false);
      return;
    }

    try {
      // Get existing locations to check for conflicts
      const existingLocations = await storeLocationService.getAllStoreLocations();
      const existingNames = new Set(existingLocations.map(loc => loc.name.toUpperCase()));

      // Generate location names
      const locationsToCreate = [];

      for (const shelf of shelves) {
        const shelfPrefix = `SHELF ${shelf.name}`;
        const total = shelf.rows * shelf.cols;

        for (let i = 1; i <= total; i++) {
          const locationName = `${shelfPrefix}${String(i).padStart(2, '0')}`;

          // Check for conflicts
          if (existingNames.has(locationName.toUpperCase())) {
            setError(`Location "${locationName}" already exists.`);
            setLoading(false);
            return;
          }

          locationsToCreate.push({
            name: locationName
          });
        }
      }

      if (error) return;

      // Call API to create locations
      await storeLocationService.bulkCreateStoreLocations(locationsToCreate);

      alert(`Successfully created ${locationsToCreate.length} store locations!`);

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      console.error('Error generating locations:', err);
      // Handle partial failures or backend errors
      setError(err.response?.data?.error || err.message || 'Failed to generate locations.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-[20px] font-semibold text-gray-900">
              Store Shelf Builder
            </h2>
            <p className="text-[12px] text-gray-500 mt-1">
              Define your store shelf layout (Rows x Columns)
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

          {/* Shelves Configuration */}
          <div className="space-y-4 mb-6">
            {shelves.map((shelf) => (
              <div key={shelf.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Shelf Section
                  </h3>
                  {shelves.length > 1 && (
                    <button
                      onClick={() => removeShelf(shelf.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Shelf Name (e.g., A, B) *
                    </label>
                    <input
                      type="text"
                      value={shelf.name}
                      onChange={(e) => updateShelf(shelf.id, 'name', e.target.value.toUpperCase())}
                      maxLength={10}
                      className={`w-full px-3 py-2 border rounded-lg text-sm uppercase ${shelves.filter(s => s.name.toUpperCase() === shelf.name.toUpperCase()).length > 1
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300'
                        }`}
                      placeholder="A"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Rows (Height)
                    </label>
                    <input
                      type="number"
                      value={shelf.rows}
                      onChange={(e) => updateShelf(shelf.id, 'rows', parseInt(e.target.value) || 1)}
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Columns (Width)
                    </label>
                    <input
                      type="number"
                      value={shelf.cols}
                      onChange={(e) => updateShelf(shelf.id, 'cols', parseInt(e.target.value) || 1)}
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-2">Preview:</p>
                  <div className="inline-block border border-gray-300 rounded bg-white p-1">
                    <div className="grid gap-1" style={{
                      gridTemplateColumns: `repeat(${shelf.cols}, 40px)`
                    }}>
                      {Array.from({ length: shelf.rows }).map((_, rowIdx) => (
                        <React.Fragment key={rowIdx}>
                          {Array.from({ length: shelf.cols }).map((_, colIdx) => {
                            const position = rowIdx * shelf.cols + colIdx + 1;
                            return (
                              <div
                                key={`${rowIdx}-${colIdx}`}
                                className="h-[40px] border border-gray-200 rounded flex items-center justify-center text-[10px] font-mono text-gray-700"
                              >
                                {shelf.name}{String(position).padStart(2, '0')}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Will generate: SHELF {shelf.name}01 to SHELF {shelf.name}{String(shelf.rows * shelf.cols).padStart(2, '0')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Add Shelf Button */}
          <button
            onClick={addShelf}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 mb-6"
          >
            <Plus className="w-4 h-4" />
            Add Another Shelf Section
          </button>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Summary</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Total Shelf Sections: {shelves.length}</p>
              <p>• Total Positions: {getTotalPositions()}</p>
              <p className="text-xs text-blue-600 mt-2">
                Positions will be numbered Left-to-Right, Top-to-Bottom
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={generateLocations}
              disabled={loading || hasDuplicateShelfNames() || shelves.length === 0 || shelves.some(s => !isValidShelfName(s.name))}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Generate Layout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
