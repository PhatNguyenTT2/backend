const locationMastersRouter = require('express').Router();
const LocationMaster = require('../models/locationMaster');
const DetailInventory = require('../models/detailInventory');
const { userExtractor } = require('../utils/auth');

/**
 * LocationMasters Controller - Simple CRUD Pattern (following Categories)
 * 
 * Endpoints:
 * - GET /api/location-masters - Get all locations
 * - GET /api/location-masters/available - Get available locations
 * - GET /api/location-masters/occupied - Get occupied locations
 * - GET /api/location-masters/:id - Get single location
 * - POST /api/location-masters - Create new location
 * - PUT /api/location-masters/:id - Update location
 * - DELETE /api/location-masters/:id - Delete location
 */

/**
 * GET /api/location-masters
 * Get all locations with filtering
 */
locationMastersRouter.get('/', async (request, response) => {
  try {
    const { isActive, search } = request.query;

    // Build filter
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { locationCode: new RegExp(search, 'i') }
      ];
    }

    // Query with population
    const locations = await LocationMaster.find(filter)
      .populate({
        path: 'currentBatches',
        select: 'batchId quantityOnHand quantityOnShelf quantityReserved quantityAvailable',
        populate: {
          path: 'batchId',
          select: 'batchCode product expiryDate quantity',
          populate: {
            path: 'product',
            select: 'name productCode'
          }
        }
      })
      .sort({ createdAt: -1 });

    response.json(locations);
  } catch (error) {
    console.error('Get locations error:', error);
    response.status(500).json({
      error: 'Failed to get locations',
      details: error.message
    });
  }
});

/**
 * GET /api/location-masters/available
 * Get only available (unoccupied and active) locations
 */
locationMastersRouter.get('/available', async (request, response) => {
  try {
    const activeLocations = await LocationMaster.find({ isActive: true })
      .populate('currentBatches')
      .sort({ name: 1 });

    const availableLocations = activeLocations.filter(loc =>
      !loc.currentBatches || loc.currentBatches.length === 0
    );

    response.json(availableLocations);
  } catch (error) {
    console.error('Get available locations error:', error);
    response.status(500).json({
      error: 'Failed to get available locations',
      details: error.message
    });
  }
});

/**
 * GET /api/location-masters/occupied
 * Get only occupied locations
 */
locationMastersRouter.get('/occupied', async (request, response) => {
  try {
    const allLocations = await LocationMaster.find()
      .populate({
        path: 'currentBatches',
        select: 'batchId quantityOnHand quantityOnShelf quantityReserved quantityAvailable',
        populate: {
          path: 'batchId',
          select: 'batchCode product expiryDate quantity',
          populate: {
            path: 'product',
            select: 'name productCode'
          }
        }
      })
      .sort({ name: 1 });

    const occupiedLocations = allLocations.filter(loc =>
      loc.currentBatches && loc.currentBatches.length > 0
    );

    response.json(occupiedLocations);
  } catch (error) {
    console.error('Get occupied locations error:', error);
    response.status(500).json({
      error: 'Failed to get occupied locations',
      details: error.message
    });
  }
});

/**
 * GET /api/location-masters/:id
 * Get single location by ID
 */
locationMastersRouter.get('/:id', async (request, response) => {
  try {
    const location = await LocationMaster.findById(request.params.id)
      .populate({
        path: 'currentBatches',
        select: 'batchId quantityOnHand quantityOnShelf quantityReserved quantityAvailable',
        populate: {
          path: 'batchId',
          select: 'batchCode product expiryDate quantity',
          populate: {
            path: 'product',
            select: 'name productCode'
          }
        }
      });

    if (!location) {
      return response.status(404).json({
        error: 'Location not found'
      });
    }

    response.json(location);
  } catch (error) {
    console.error('Get location by ID error:', error);
    response.status(500).json({
      error: 'Failed to get location',
      details: error.message
    });
  }
});

/**
 * POST /api/location-masters
 * Create new location
 */
locationMastersRouter.post('/', userExtractor, async (request, response) => {
  try {
    const { name, isActive } = request.body;

    // Validation
    if (!name || !name.trim()) {
      return response.status(400).json({
        error: 'Location name is required'
      });
    }

    // Check duplicate
    const existingLocation = await LocationMaster.findOne({
      name: name.trim().toUpperCase()
    });

    if (existingLocation) {
      return response.status(409).json({
        error: 'Location with this name already exists'
      });
    }

    // Create location
    const location = new LocationMaster({
      name: name.trim(),
      isActive: isActive !== undefined ? isActive : true
    });

    const savedLocation = await location.save();

    response.status(201).json(savedLocation);
  } catch (error) {
    console.error('Create location error:', error);

    if (error.code === 11000) {
      return response.status(409).json({
        error: 'Location with this name already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    response.status(500).json({
      error: 'Failed to create location',
      details: error.message
    });
  }
});

/**
 * PUT /api/location-masters/:id
 * Update location
 */
locationMastersRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const { name, isActive, maxCapacity } = request.body;

    // Find location
    const location = await LocationMaster.findById(request.params.id);

    if (!location) {
      return response.status(404).json({
        error: 'Location not found'
      });
    }

    // Check duplicate name
    if (name && name.trim().toUpperCase() !== location.name) {
      const existingLocation = await LocationMaster.findOne({
        _id: { $ne: location._id },
        name: name.trim().toUpperCase()
      });

      if (existingLocation) {
        return response.status(409).json({
          error: 'Location with this name already exists'
        });
      }
    }

    // Update fields
    if (name !== undefined) location.name = name.trim();
    if (isActive !== undefined) location.isActive = isActive;
    if (maxCapacity !== undefined) location.maxCapacity = maxCapacity;

    const updatedLocation = await location.save();

    // Populate for response
    await updatedLocation.populate({
      path: 'currentBatches',
      populate: {
        path: 'batchId',
        populate: {
          path: 'product',
          select: 'name productCode'
        }
      }
    });

    response.json(updatedLocation);
  } catch (error) {
    console.error('Update location error:', error);

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    response.status(500).json({
      error: 'Failed to update location',
      details: error.message
    });
  }
});

/**
 * DELETE /api/location-masters/:id
 * Delete location
 */
locationMastersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const location = await LocationMaster.findById(request.params.id);

    if (!location) {
      return response.status(404).json({
        error: 'Location not found'
      });
    }

    // Check if occupied
    const occupiedBatch = await DetailInventory.findOne({
      location: location._id
    });

    if (occupiedBatch) {
      return response.status(409).json({
        error: 'Cannot delete occupied location. Please move the batch first.'
      });
    }

    await LocationMaster.findByIdAndDelete(location._id);

    response.json({
      message: 'Location deleted successfully',
      deletedLocation: {
        id: location._id,
        locationCode: location.locationCode,
        name: location.name
      }
    });
  } catch (error) {
    console.error('Delete location error:', error);
    response.status(500).json({
      error: 'Failed to delete location',
      details: error.message
    });
  }
});

module.exports = locationMastersRouter;
