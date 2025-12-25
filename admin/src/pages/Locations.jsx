import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { AddLocationModal, EditLocationModal, WarehouseMapBuilder, EditWarehouseMapModal, WarehouseMapView } from '../components/Location';
import locationService from '../services/locationService';

export const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [mapBuilderModal, setMapBuilderModal] = useState(false);
  const [editMapModal, setEditMapModal] = useState(false);
  const [editModal, setEditModal] = useState({ isOpen: false, location: null });

  // Breadcrumb
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Inventory', href: '/inventory/management' },
    { label: 'Locations', href: '/inventory/locations' }
  ];

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...locations];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(location =>
        location.name?.toLowerCase().includes(query) ||
        location.locationCode?.toLowerCase().includes(query)
      );
    }

    // Calculate occupied capacity for each location
    const locationsWithCapacity = result.map(loc => {
      const occupiedCapacity = loc.currentBatches?.reduce((total, batch) => {
        return total + (batch.quantityOnHand || 0) + (batch.quantityOnShelf || 0);
      }, 0) || 0;
      const maxCapacity = loc.maxCapacity || 100;
      const capacityPercent = (occupiedCapacity / maxCapacity) * 100;

      return {
        ...loc,
        occupiedCapacity,
        capacityPercent
      };
    });

    // Status filter
    if (filterStatus === 'active') {
      result = locationsWithCapacity.filter(loc => loc.isActive);
    } else if (filterStatus === 'inactive') {
      result = locationsWithCapacity.filter(loc => !loc.isActive);
    } else if (filterStatus === 'empty') {
      result = locationsWithCapacity.filter(loc =>
        !loc.currentBatches || loc.currentBatches.length === 0
      );
    } else if (filterStatus === 'nearly-full') {
      result = locationsWithCapacity.filter(loc =>
        loc.capacityPercent > 80 && loc.capacityPercent < 100
      );
    } else if (filterStatus === 'full') {
      result = locationsWithCapacity.filter(loc =>
        loc.capacityPercent >= 100
      );
    } else {
      result = locationsWithCapacity;
    }

    setFilteredLocations(result);
  }, [locations, searchQuery, filterStatus]);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await locationService.getAllLocations();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError(err.message || 'Failed to load locations');
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSuccess = () => {
    fetchLocations();
    setAddModal(false);
  };

  const handleEditSuccess = () => {
    fetchLocations();
    setEditModal({ isOpen: false, location: null });
  };

  const handleEdit = (location) => {
    setEditModal({ isOpen: true, location });
  };

  const handleDelete = async (location) => {
    if (location.currentBatches && location.currentBatches.length > 0) {
      alert(`Cannot delete location with ${location.currentBatches.length} batch(es). Please move all batches first.`);
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete location "${location.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      await locationService.deleteLocation(location.id);
      fetchLocations();
    } catch (err) {
      console.error('Error deleting location:', err);
      alert(err.response?.data?.error || 'Failed to delete location');
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Warehouse Locations</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMapModal(true)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium"
          >
            Edit Map
          </button>
          <button
            onClick={() => setMapBuilderModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
          >
            Build Warehouse Map
          </button>
        </div>
      </div>
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading locations</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchLocations}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Warehouse Map View */}
      <WarehouseMapView
        locations={filteredLocations}
        onLocationClick={handleEdit}
      />

      {/* Modals */}
      <WarehouseMapBuilder
        isOpen={mapBuilderModal}
        onClose={() => setMapBuilderModal(false)}
        onSuccess={fetchLocations}
      />

      <EditWarehouseMapModal
        isOpen={editMapModal}
        onClose={() => setEditMapModal(false)}
        onSuccess={fetchLocations}
      />

      <AddLocationModal
        isOpen={addModal}
        onClose={() => setAddModal(false)}
        onSuccess={handleAddSuccess}
      />

      <EditLocationModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, location: null })}
        onSuccess={handleEditSuccess}
        location={editModal.location}
      />
    </div>
  );
};

export default Locations;
