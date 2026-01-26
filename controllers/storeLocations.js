const storeLocationsRouter = require('express').Router();
const StoreLocation = require('../models/storeLocation');
const DetailInventory = require('../models/detailInventory');
const ProductBatch = require('../models/productBatch');
const { userExtractor } = require('../utils/auth');

/**
 * StoreLocations Controller
 * Manages batch locations on store shelves (for batches with quantityOnShelf > 0)
 * 
 * Endpoints:
 * - GET /api/store-locations - Get all store locations with batch info
 * - GET /api/store-locations/batches-on-shelf - Get batches eligible for store placement
 * - GET /api/store-locations/:id - Get single store location
 * - POST /api/store-locations - Assign batch to store location
 * - PUT /api/store-locations/:id - Update store location
 * - DELETE /api/store-locations/:id - Remove store location assignment
 */

/**
 * GET /api/store-locations
 * Get all store locations with batch details
 */
storeLocationsRouter.get('/', async (request, response) => {
  try {
    const { search, name } = request.query;

    // Build filter
    const filter = {};

    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { batchCode: new RegExp(search, 'i') }
      ];
    }

    if (name) {
      filter.name = new RegExp(name, 'i');
    }

    // Get store locations
    const storeLocations = await StoreLocation.find(filter)
      .sort({ name: 1 });

    // Enrich with batch and inventory details
    const enrichedLocations = await Promise.all(
      storeLocations.map(async (location) => {
        const locationObj = location.toJSON();

        // Get batch info
        const batch = await ProductBatch.findOne({ batchCode: location.batchCode })
          .populate('product', 'name productCode')
          .lean();

        // Get inventory info
        const inventory = await DetailInventory.findOne({ batchId: batch?._id })
          .lean();

        return {
          ...locationObj,
          batch: batch ? {
            id: batch._id,
            batchCode: batch.batchCode,
            product: batch.product,
            expiryDate: batch.expiryDate,
            quantity: batch.quantity
          } : null,
          inventory: inventory ? {
            quantityOnHand: inventory.quantityOnHand,
            quantityOnShelf: inventory.quantityOnShelf,
            quantityReserved: inventory.quantityReserved
          } : null
        };
      })
    );

    response.json(enrichedLocations);
  } catch (error) {
    console.error('Get store locations error:', error);
    response.status(500).json({
      error: 'Failed to get store locations',
      details: error.message
    });
  }
});

/**
 * GET /api/store-locations/batches-on-shelf
 * Get all batches with quantityOnShelf > 0 that can be assigned to store locations
 */
storeLocationsRouter.get('/batches-on-shelf', async (request, response) => {
  try {
    // Find all detail inventories with quantityOnShelf > 0
    const detailInventories = await DetailInventory.find({
      quantityOnShelf: { $gt: 0 }
    })
      .populate({
        path: 'batchId',
        select: 'batchCode product expiryDate quantity',
        populate: {
          path: 'product',
          select: 'name productCode'
        }
      })
      .lean();

    // Get all existing store locations
    const existingLocations = await StoreLocation.find().lean();
    const assignedBatchCodes = new Set(existingLocations.map(loc => loc.batchCode));

    // Format response
    const batchesOnShelf = detailInventories
      .filter(inv => inv.batchId) // Filter out any with missing batch
      .map(inv => ({
        batchCode: inv.batchId.batchCode,
        product: inv.batchId.product,
        expiryDate: inv.batchId.expiryDate,
        quantityOnShelf: inv.quantityOnShelf,
        isAssigned: assignedBatchCodes.has(inv.batchId.batchCode)
      }));

    response.json(batchesOnShelf);
  } catch (error) {
    console.error('Get batches on shelf error:', error);
    response.status(500).json({
      error: 'Failed to get batches on shelf',
      details: error.message
    });
  }
});

/**
 * GET /api/store-locations/unique-names
 * Get unique store location names (for building store map)
 */
storeLocationsRouter.get('/unique-names', async (request, response) => {
  try {
    const uniqueNames = await StoreLocation.distinct('name');
    response.json(uniqueNames.sort());
  } catch (error) {
    console.error('Get unique names error:', error);
    response.status(500).json({
      error: 'Failed to get unique store location names',
      details: error.message
    });
  }
});

/**
 * GET /api/store-locations/:id
 * Get single store location by ID
 */
storeLocationsRouter.get('/:id', async (request, response) => {
  try {
    const storeLocation = await StoreLocation.findById(request.params.id);

    if (!storeLocation) {
      return response.status(404).json({
        error: 'Store location not found'
      });
    }

    // Get batch info
    const batch = await ProductBatch.findOne({ batchCode: storeLocation.batchCode })
      .populate('product', 'name productCode')
      .lean();

    // Get inventory info
    const inventory = batch
      ? await DetailInventory.findOne({ batchId: batch._id }).lean()
      : null;

    const result = {
      ...storeLocation.toJSON(),
      batch: batch ? {
        id: batch._id,
        batchCode: batch.batchCode,
        product: batch.product,
        expiryDate: batch.expiryDate,
        quantity: batch.quantity
      } : null,
      inventory: inventory ? {
        quantityOnHand: inventory.quantityOnHand,
        quantityOnShelf: inventory.quantityOnShelf,
        quantityReserved: inventory.quantityReserved
      } : null
    };

    response.json(result);
  } catch (error) {
    console.error('Get store location by ID error:', error);
    response.status(500).json({
      error: 'Failed to get store location',
      details: error.message
    });
  }
});

/**
 * POST /api/store-locations/bulk
 * Bulk create store locations (for map builder)
 */
storeLocationsRouter.post('/bulk', userExtractor, async (request, response) => {
  try {
    const { locations } = request.body;

    // Sync indexes to ensure sparse unique index is active
    // This fixes the issue where previous non-sparse index prevented multiple nulls
    try {
      await StoreLocation.syncIndexes();
    } catch (idxError) {
      console.warn('Index sync warning:', idxError.message);
    }

    if (!Array.isArray(locations) || locations.length === 0) {
      return response.status(400).json({ error: 'Locations array is required' });
    }

    const createdLocations = [];
    const errors = [];

    // Process each location
    for (const loc of locations) {
      try {
        if (!loc.name) continue;

        // Check duplicate name
        const existing = await StoreLocation.findOne({ name: loc.name.trim().toUpperCase() });
        if (existing) {
          errors.push(`Location ${loc.name} already exists`);
          continue;
        }

        const newLocation = new StoreLocation({
          name: loc.name.trim().toUpperCase()
          // batchCode is undefined/missing by default, triggering sparse behavior
        });

        await newLocation.save();
        createdLocations.push(newLocation);
      } catch (err) {
        errors.push(`Failed to create ${loc.name}: ${err.message}`);
      }
    }

    response.status(201).json({
      message: `Created ${createdLocations.length} locations`,
      created: createdLocations,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk create store locations error:', error);
    response.status(500).json({
      error: 'Failed to bulk create store locations',
      details: error.message
    });
  }
});

/**
 * POST /api/store-locations
 * Create new store location (or assign batch to it)
 */
storeLocationsRouter.post('/', userExtractor, async (request, response) => {
  try {
    const { batchCode, name } = request.body;

    if (!name || !name.trim()) {
      return response.status(400).json({
        error: 'Store location name is required'
      });
    }

    // Check if location exists
    const existingLocation = await StoreLocation.findOne({
      name: name.trim().toUpperCase()
    });

    if (existingLocation) {
      // If location exists and has no batch, we can assign to it
      if (batchCode) {
        if (existingLocation.batchCode) {
          return response.status(409).json({
            error: 'Location is already occupied',
            existingLocation: existingLocation.name
          });
        }

        // Use the PUT logic to assign
        existingLocation.batchCode = batchCode.trim().toUpperCase();
        await existingLocation.save();
        return response.status(200).json(existingLocation);
      } else {
        return response.status(409).json({
          error: 'Store location with this name already exists'
        });
      }
    }

    // New location creation
    const newLocData = {
      name: name.trim().toUpperCase()
    };

    if (batchCode) {
      newLocData.batchCode = batchCode.trim().toUpperCase();
    }

    const storeLocation = new StoreLocation(newLocData);

    // If batchCode assigned, validate it
    if (batchCode) {
      // Verify batch exists
      const batch = await ProductBatch.findOne({ batchCode: batchCode.trim().toUpperCase() });
      if (!batch) {
        return response.status(404).json({
          error: 'Batch not found'
        });
      }

      // Verify batch has quantityOnShelf > 0
      const inventory = await DetailInventory.findOne({ batchId: batch._id });
      if (!inventory || inventory.quantityOnShelf <= 0) {
        return response.status(400).json({
          error: 'Batch must have quantityOnShelf > 0 to be assigned to store location'
        });
      }

      // Check if batch already has a store location
      const existingBatchLoc = await StoreLocation.findOne({ batchCode: batchCode.trim().toUpperCase() });
      if (existingBatchLoc) {
        return response.status(409).json({
          error: 'This batch is already assigned to a store location',
          existingLocation: existingBatchLoc.name
        });
      }
    }

    const savedLocation = await storeLocation.save();

    response.status(201).json(savedLocation);
  } catch (error) {
    console.error('Create store location error:', error);

    if (error.code === 11000) {
      return response.status(409).json({
        error: 'Location name or batch code already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    response.status(500).json({
      error: 'Failed to create store location',
      details: error.message
    });
  }
});

/**
 * PUT /api/store-locations/:id
 * Update store location (rename or assign/unassign batch)
 */
storeLocationsRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const { name, batchCode } = request.body;

    const storeLocation = await StoreLocation.findById(request.params.id);

    if (!storeLocation) {
      return response.status(404).json({
        error: 'Store location not found'
      });
    }

    // Update name
    if (name !== undefined) {
      storeLocation.name = name.trim().toUpperCase();
    }

    // Update batch (Assign/Unassign)
    if (batchCode !== undefined) {
      if (batchCode === null || batchCode === '') {
        // Unassign - Use $unset to completely remove the field (avoiding sparse unique null conflict)
        await StoreLocation.findByIdAndUpdate(storeLocation._id, { $unset: { batchCode: 1 } });
        storeLocation.batchCode = undefined; // Update local instance for response
      } else {
        // Assign
        const normalizedBatchCode = batchCode.trim().toUpperCase();

        // Verify batch exists and valid
        const batch = await ProductBatch.findOne({ batchCode: normalizedBatchCode });
        if (!batch) {
          return response.status(404).json({ error: 'Batch not found' });
        }

        const inventory = await DetailInventory.findOne({ batchId: batch._id });
        if (!inventory || inventory.quantityOnShelf <= 0) {
          return response.status(400).json({ error: 'Batch must have quantityOnShelf > 0' });
        }

        // Check unique
        const existing = await StoreLocation.findOne({
          batchCode: normalizedBatchCode,
          _id: { $ne: storeLocation._id }
        });
        if (existing) {
          return response.status(409).json({
            error: 'Batch already assigned to another location',
            location: existing.name
          });
        }

        storeLocation.batchCode = normalizedBatchCode;
        await storeLocation.save();
      }
    } else {
      // Only name update
      await storeLocation.save();
    }

    // Fetch updated document to ensure we have latest state
    const updatedLocation = await StoreLocation.findById(storeLocation._id);

    // Re-fetch to enrich data
    const batch = updatedLocation.batchCode
      ? await ProductBatch.findOne({ batchCode: updatedLocation.batchCode }).populate('product', 'name productCode').lean()
      : null;

    const inventory = batch
      ? await DetailInventory.findOne({ batchId: batch._id }).lean()
      : null;

    response.json({
      ...updatedLocation.toJSON(),
      batch: batch ? {
        id: batch._id,
        batchCode: batch.batchCode,
        product: batch.product,
        expiryDate: batch.expiryDate,
        quantity: batch.quantity
      } : null,
      inventory: inventory ? {
        quantityOnHand: inventory.quantityOnHand,
        quantityOnShelf: inventory.quantityOnShelf,
        quantityReserved: inventory.quantityReserved
      } : null
    });

  } catch (error) {
    console.error('Update store location error:', error);
    // ...
    if (error.code === 11000) {
      return response.status(409).json({ error: 'Duplicate entry (name or batch)' });
    }
    // ...
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    response.status(500).json({
      error: 'Failed to update store location',
      details: error.message
    });
  }
});

/**
 * DELETE /api/store-locations/:id
 * Remove store location assignment
 */
storeLocationsRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const storeLocation = await StoreLocation.findById(request.params.id);

    if (!storeLocation) {
      return response.status(404).json({
        error: 'Store location not found'
      });
    }

    await StoreLocation.findByIdAndDelete(storeLocation._id);

    response.json({
      message: 'Store location deleted successfully',
      deletedLocation: {
        id: storeLocation._id,
        batchCode: storeLocation.batchCode,
        name: storeLocation.name
      }
    });
  } catch (error) {
    console.error('Delete store location error:', error);
    response.status(500).json({
      error: 'Failed to delete store location',
      details: error.message
    });
  }
});

module.exports = storeLocationsRouter;
