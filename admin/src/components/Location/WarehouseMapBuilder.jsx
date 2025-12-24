import React, { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

export const WarehouseMapBuilder = ({ isOpen, onClose, onSuccess }) => {
  const [blocks, setBlocks] = useState([
    { id: 1, name: 'A', rows: 6, cols: 3 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addBlock = () => {
    const nextLetter = String.fromCharCode(65 + blocks.length); // A, B, C...
    setBlocks([...blocks, {
      id: Date.now(),
      name: nextLetter,
      rows: 6,
      cols: 3
    }]);
  };

  const updateBlock = (id, field, value) => {
    setBlocks(blocks.map(block =>
      block.id === id ? { ...block, [field]: value } : block
    ));
  };

  const removeBlock = (id) => {
    setBlocks(blocks.filter(block => block.id !== id));
  };

  const generateLocations = async () => {
    setLoading(true);
    setError('');

    try {
      const locationService = (await import('../../services/locationService')).default;
      const locationsToCreate = [];

      // Generate location names for each block
      blocks.forEach(block => {
        for (let col = 1; col <= block.cols; col++) {
          for (let row = 1; row <= block.rows; row++) {
            // Format: A-01, A-02, A-03... (column 1), A-07, A-08... (column 2)
            const position = ((col - 1) * block.rows) + row;
            const locationName = `${block.name}-${String(position).padStart(2, '0')}`;
            locationsToCreate.push({ name: locationName, maxCapacity: 100, isActive: true });
          }
        }
      });

      // Create all locations
      const createPromises = locationsToCreate.map(loc =>
        locationService.createLocation(loc).catch(err => {
          console.warn(`Failed to create ${loc.name}:`, err.response?.data?.error || err.message);
          return null;
        })
      );

      const results = await Promise.all(createPromises);
      const successCount = results.filter(r => r !== null).length;

      if (onSuccess) onSuccess();
      if (onClose) onClose();

      alert(`Successfully created ${successCount} out of ${locationsToCreate.length} locations`);
    } catch (err) {
      console.error('Error generating locations:', err);
      setError('Failed to generate locations. Please try again.');
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
              Warehouse Map Builder
            </h2>
            <p className="text-[12px] text-gray-500 mt-1">
              Design your warehouse layout with blocks and generate locations
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

          {/* Blocks Configuration */}
          <div className="space-y-4 mb-6">
            {blocks.map((block, index) => (
              <div key={block.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Block {block.name}
                  </h3>
                  {blocks.length > 1 && (
                    <button
                      onClick={() => removeBlock(block.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Block Name
                    </label>
                    <input
                      type="text"
                      value={block.name}
                      onChange={(e) => updateBlock(block.id, 'name', e.target.value.toUpperCase())}
                      maxLength={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Rows (Height)
                    </label>
                    <input
                      type="number"
                      value={block.rows}
                      onChange={(e) => updateBlock(block.id, 'rows', parseInt(e.target.value) || 1)}
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
                      value={block.cols}
                      onChange={(e) => updateBlock(block.id, 'cols', parseInt(e.target.value) || 1)}
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-600 mb-2">Preview:</p>
                  <div className="inline-block border-2 border-gray-300 rounded">
                    <div
                      className="grid gap-[2px] p-1 bg-gray-300"
                      style={{
                        gridTemplateColumns: `repeat(${block.cols}, 40px)`,
                        gridTemplateRows: `repeat(${block.rows}, 40px)`
                      }}
                    >
                      {Array.from({ length: block.rows * block.cols }).map((_, idx) => {
                        const col = Math.floor(idx / block.rows) + 1;
                        const row = (idx % block.rows) + 1;
                        const position = ((col - 1) * block.rows) + row;
                        const locationName = `${block.name}-${String(position).padStart(2, '0')}`;

                        return (
                          <div
                            key={idx}
                            className="bg-white flex items-center justify-center text-[8px] font-mono text-gray-700 border border-gray-200"
                            title={locationName}
                          >
                            {String(position).padStart(2, '0')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Will generate {block.rows * block.cols} locations: {block.name}-01 to {block.name}-{String(block.rows * block.cols).padStart(2, '0')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Add Block Button */}
          <button
            onClick={addBlock}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 mb-6"
          >
            <Plus className="w-4 h-4" />
            Add Another Block
          </button>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Summary</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Total Blocks: {blocks.length}</p>
              <p>• Total Locations: {blocks.reduce((sum, b) => sum + (b.rows * b.cols), 0)}</p>
              <p className="text-xs text-blue-600 mt-2">
                Locations will be numbered vertically (top to bottom), then left to right
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
              disabled={loading}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
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
                  Generate Locations
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
