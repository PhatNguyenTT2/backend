import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { StoreMapView, StoreMapBuilder, AssignBatchModal, StoreLocationDetailModal, EditStoreMapModal } from '../components/StoreLocation';
import storeLocationService from '../services/storeLocationService';

export const StoreLocations = () => {
  const [storeLocations, setStoreLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [mapBuilderModal, setMapBuilderModal] = useState(false);
  const [editMapModal, setEditMapModal] = useState(false);
  const [assignBatchModal, setAssignBatchModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [targetLocationName, setTargetLocationName] = useState('');

  // Breadcrumb
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Products', href: '/products' },
    { label: 'Store Locations', href: '/products/store-locations' }
  ];

  // Fetch store locations on mount
  useEffect(() => {
    fetchStoreLocations();
  }, []);

  // Auto-refresh when window/tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStoreLocations();
      }
    };

    const handleWindowFocus = () => {
      fetchStoreLocations();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const fetchStoreLocations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await storeLocationService.getAllStoreLocations();
      setStoreLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching store locations:', err);
      setError(err.message || 'Failed to load store locations');
      setStoreLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Store Shelf Locations</h1>

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
            Build Layout
          </button>
          <button
            onClick={() => setAssignBatchModal(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium"
          >
            Assign Batch
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading store locations</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchStoreLocations}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="animate-spin h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading store locations...</p>
        </div>
      ) : (
        /* Store Map View */
        <StoreMapView
          storeLocations={storeLocations}
          onRefresh={fetchStoreLocations}
          onLocationClick={setSelectedLocation}
        />
      )}

      {/* Modals */}
      <StoreMapBuilder
        isOpen={mapBuilderModal}
        onClose={() => setMapBuilderModal(false)}
        onSuccess={fetchStoreLocations}
      />

      <EditStoreMapModal
        isOpen={editMapModal}
        onClose={() => setEditMapModal(false)}
        onSuccess={fetchStoreLocations}
      />

      <StoreLocationDetailModal
        isOpen={!!selectedLocation}
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
        onSuccess={(action) => {
          if (action === 'assign') {
            // Open assign modal, keeping the name
            setAssignBatchModal(true);
            // We need to keep the location name, but the modal closed. 
            // We can use a separate state `targetLocationName`
            setTargetLocationName(selectedLocation.name);
          } else {
            fetchStoreLocations();
          }
          setSelectedLocation(null);
        }}
      />

      <AssignBatchModal
        isOpen={assignBatchModal}
        onClose={() => {
          setAssignBatchModal(false);
          setTargetLocationName('');
        }}
        onSuccess={fetchStoreLocations}
        initialLocationName={targetLocationName}
      />
    </div>
  );
};

export default StoreLocations;
