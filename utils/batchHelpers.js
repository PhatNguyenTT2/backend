const ProductBatch = require('../models/productBatch');
const DetailInventory = require('../models/detailInventory');

/**
 * Batch Selection Helpers
 * Provides FEFO (First Expired First Out) logic for automatic batch selection
 */

/**
 * Get available batches for a product sorted by FEFO (First Expired First Out)
 * Only returns batches that:
 * - Are active
 * - Not expired yet
 * - Have stock on shelf (quantityOnShelf > 0)
 * @param {ObjectId} productId - Product ID
 * @returns {Array} Available batches sorted by expiry date (earliest first)
 */
const getAvailableBatchesFEFO = async (productId) => {
  try {
    // Get all batches for this product that are active and not expired
    const batches = await ProductBatch.find({
      product: productId,
      status: 'active',
      expiryDate: { $gt: new Date() } // Only non-expired batches
    })
      .sort({ expiryDate: 1 }) // Sort by expiry date (earliest first - FEFO)
      .lean();

    if (batches.length === 0) {
      console.log(`ℹ️ No active batches found for product ${productId}`);
      return [];
    }

    // Get detail inventories for these batches
    const batchIds = batches.map(b => b._id);
    const detailInventories = await DetailInventory.find({
      batchId: { $in: batchIds },
      quantityOnShelf: { $gt: 0 } // Only batches with stock on shelf
    }).lean();

    // Create a map of batchId -> detailInventory
    const inventoryMap = {};
    detailInventories.forEach(inv => {
      inventoryMap[inv.batchId.toString()] = inv;
    });

    // Merge batch info with inventory quantities
    const batchesWithQuantity = batches
      .map(batch => {
        const inventory = inventoryMap[batch._id.toString()];

        if (!inventory || inventory.quantityOnShelf <= 0) {
          return null;
        }

        // quantityAvailable = stock on shelf that's not reserved
        // This is the actual quantity we can sell
        const quantityAvailable = Math.max(0, inventory.quantityOnShelf - (inventory.quantityReserved || 0));

        return {
          ...batch,
          quantityOnShelf: inventory.quantityOnShelf,
          quantityReserved: inventory.quantityReserved || 0,
          quantityAvailable: quantityAvailable
        };
      })
      .filter(batch => batch !== null && batch.quantityOnShelf > 0); // Check onShelf, not available

    return batchesWithQuantity;
  } catch (error) {
    console.error('Error getting available batches FEFO:', error);
    throw error;
  }
};

/**
 * Select batch for a product with requested quantity using FEFO
 * Only selects batches with sufficient stock ON SHELF (not reserved)
 * @param {ObjectId} productId - Product ID
 * @param {Number} requestedQuantity - Requested quantity
 * @returns {Object} { batch: BatchObject, availableQuantity: Number } or null if not enough stock
 */
const selectBatchFEFO = async (productId, requestedQuantity) => {
  try {
    const availableBatches = await getAvailableBatchesFEFO(productId);

    if (availableBatches.length === 0) {
      console.log(`❌ No available batches found for product ${productId}`);
      return null;
    }

    // For now, we only support single-batch allocation
    // If needed, we can extend this to support multi-batch allocation
    const firstBatch = availableBatches[0];

    console.log(`🔍 Checking batch ${firstBatch.batchCode}:`, {
      quantityOnShelf: firstBatch.quantityOnShelf,
      quantityAvailable: firstBatch.quantityAvailable,
      requestedQuantity
    });

    if (firstBatch.quantityAvailable < requestedQuantity) {
      // Not enough stock in the first (nearest expiry) batch
      console.log(
        `❌ Insufficient stock in batch ${firstBatch.batchCode}. ` +
        `Available: ${firstBatch.quantityAvailable}, Needed: ${requestedQuantity}`
      );
      return null;
    }

    console.log(`✅ Selected batch ${firstBatch.batchCode} via FEFO with ${firstBatch.quantityAvailable} available`);

    return {
      batch: firstBatch,
      availableQuantity: firstBatch.quantityAvailable
    };
  } catch (error) {
    console.error('Error selecting batch FEFO:', error);
    throw error;
  }
};

/**
 * Allocate quantities across multiple batches using FEFO
 * This is useful when a single batch doesn't have enough stock
 * @param {ObjectId} productId - Product ID
 * @param {Number} requestedQuantity - Requested quantity
 * @returns {Array} Array of { batchId, batchCode, quantity, unitPrice } allocations
 */
const allocateQuantityFEFO = async (productId, requestedQuantity) => {
  try {
    const availableBatches = await getAvailableBatchesFEFO(productId);

    if (availableBatches.length === 0) {
      throw new Error('No available batches for this product');
    }

    const allocations = [];
    let remainingQuantity = requestedQuantity;

    console.log(`📦 Allocating ${requestedQuantity} units across ${availableBatches.length} batch(es) using FEFO:`);

    for (const batch of availableBatches) {
      if (remainingQuantity <= 0) break;

      const allocateFromThisBatch = Math.min(batch.quantityAvailable, remainingQuantity);

      if (allocateFromThisBatch > 0) {
        console.log(`  ✓ Batch ${batch.batchCode}: ${allocateFromThisBatch} units (Available: ${batch.quantityAvailable}, Reserved: ${batch.quantityReserved})`);

        allocations.push({
          batchId: batch._id,
          batchCode: batch.batchCode,
          quantity: allocateFromThisBatch,
          unitPrice: batch.unitPrice,
          expiryDate: batch.expiryDate
        });

        remainingQuantity -= allocateFromThisBatch;
      }
    }

    if (remainingQuantity > 0) {
      const totalAvailable = availableBatches.reduce((sum, b) => sum + b.quantityAvailable, 0);
      throw new Error(`Insufficient stock on shelf for product. Requested: ${requestedQuantity}, Available: ${totalAvailable}`);
    }

    console.log(`✅ Successfully allocated ${requestedQuantity} units across ${allocations.length} batch(es)`);


    return allocations;
  } catch (error) {
    console.error('Error allocating quantity FEFO:', error);
    throw error;
  }
};

module.exports = {
  getAvailableBatchesFEFO,
  selectBatchFEFO,
  allocateQuantityFEFO
};
