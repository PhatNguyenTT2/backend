const inventoryMovementBatchesRouter = require('express').Router();
const InventoryMovementBatch = require('../models/inventoryMovementBatch');
const DetailInventory = require('../models/detailInventory');
const ProductBatch = require('../models/productBatch');
const { userExtractor } = require('../utils/auth');

/**
 * InventoryMovementBatches Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/inventory-movement-batches - Get all inventory movement batches with filtering
 * - GET /api/inventory-movement-batches/:id - Get single inventory movement batch by ID
 * - POST /api/inventory-movement-batches - Create new inventory movement batch
 * - PUT /api/inventory-movement-batches/:id - Update inventory movement batch
 * - DELETE /api/inventory-movement-batches/:id - Delete inventory movement batch
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getStatistics() - Movement statistics
 * - getByMovementType() - Use GET /api/inventory-movement-batches?movementType=value
 * - getByDateRange() - Use GET /api/inventory-movement-batches?startDate=...&endDate=...
 * - getByBatch() - Use GET /api/inventory-movement-batches?batchId=value
 * - getByProduct() - Use GET /api/inventory-movement-batches?productId=value
 * - getByEmployee() - Use GET /api/inventory-movement-batches?performedBy=value
 */

/**
 * GET /api/inventory-movement-batches
 * Get all inventory movement batches with filtering via query parameters
 * 
 * Query parameters:
 * - batchId: string - Filter by batch ID
 * - productId: string - Filter by product ID (via batch)
 * - inventoryDetail: string - Filter by detail inventory ID
 * - movementType: string - Filter by movement type (in, out, adjustment, transfer, audit)
 * - performedBy: string - Filter by employee ID
 * - purchaseOrderId: string - Filter by purchase order ID
 * - startDate: date - Filter movements from this date
 * - endDate: date - Filter movements until this date
 * - search: string - Search by movement number, batch code, or reason
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
inventoryMovementBatchesRouter.get('/', async (request, response) => {
  try {
    const {
      batchId,
      productId,
      inventoryDetail,
      movementType,
      performedBy,
      purchaseOrderId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (batchId) {
      filter.batchId = batchId;
    }

    if (inventoryDetail) {
      filter.inventoryDetail = inventoryDetail;
    }

    if (movementType) {
      filter.movementType = movementType;
    }

    if (performedBy) {
      filter.performedBy = performedBy;
    }

    if (purchaseOrderId) {
      filter.purchaseOrderId = purchaseOrderId;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate);
      }
    }

    // Search filter
    if (search) {
      filter.$or = [
        { movementNumber: new RegExp(search, 'i') },
        { reason: new RegExp(search, 'i') },
        { notes: new RegExp(search, 'i') }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query with populations
    let query = InventoryMovementBatch.find(filter)
      .populate({
        path: 'batchId',
        select: 'batchCode costPrice unitPrice quantity mfgDate expiryDate status product',
        populate: {
          path: 'product',
          select: 'productCode name image category',
          populate: {
            path: 'category',
            select: 'name categoryCode'
          }
        }
      })
      .populate({
        path: 'inventoryDetail',
        select: 'quantityOnHand quantityOnShelf quantityReserved location'
      })
      .populate({
        path: 'performedBy',
        select: 'employeeCode firstName lastName'
      })
      .populate({
        path: 'purchaseOrderId',
        select: 'purchaseOrderCode status totalAmount'
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ date: -1, createdAt: -1 });

    let movements = await query;

    // Filter by productId (after population)
    if (productId) {
      movements = movements.filter(
        mov => mov.batchId?.product?._id.toString() === productId
      );
    }

    // Get total count for pagination
    const total = await InventoryMovementBatch.countDocuments(filter);

    response.json({
      success: true,
      data: {
        movements,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get inventory movement batches error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get inventory movement batches',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/inventory-movement-batches/:id
 * Get single inventory movement batch by ID with full details
 */
inventoryMovementBatchesRouter.get('/:id', async (request, response) => {
  try {
    const movement = await InventoryMovementBatch.findById(request.params.id)
      .populate({
        path: 'batchId',
        select: 'batchCode costPrice unitPrice quantity mfgDate expiryDate status promotionApplied discountPercentage notes product',
        populate: {
          path: 'product',
          select: 'productCode barcode name category unit',
          populate: {
            path: 'category',
            select: 'name categoryCode'
          }
        }
      })
      .populate({
        path: 'inventoryDetail',
        select: 'quantityOnHand quantityOnShelf quantityReserved location'
      })
      .populate({
        path: 'performedBy',
        select: 'employeeCode firstName lastName email phone'
      })
      .populate({
        path: 'purchaseOrderId',
        select: 'purchaseOrderCode status totalAmount orderDate supplier',
        populate: {
          path: 'supplier',
          select: 'supplierCode name contactPerson'
        }
      });

    if (!movement) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory movement batch not found',
          code: 'MOVEMENT_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: movement
    });
  } catch (error) {
    console.error('Get inventory movement batch by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get inventory movement batch',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/inventory-movement-batches
 * Create new inventory movement batch
 * Requires authentication
 * 
 * Note: This endpoint will automatically update the DetailInventory quantities
 */
inventoryMovementBatchesRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      batchId,
      inventoryDetail,
      movementType,
      quantity,
      reason,
      date,
      performedBy,
      purchaseOrderId,
      notes
    } = request.body;

    // Validation
    if (!batchId || !inventoryDetail || !movementType || quantity === undefined) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'batchId, inventoryDetail, movementType, and quantity are required'
        }
      });
    }

    // Validate quantity is not zero
    if (quantity === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Quantity cannot be zero',
          code: 'INVALID_QUANTITY'
        }
      });
    }

    // Check if batch exists
    const existingBatch = await ProductBatch.findById(batchId);
    if (!existingBatch) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Product batch not found',
          code: 'BATCH_NOT_FOUND'
        }
      });
    }

    // Check if detail inventory exists
    const existingDetailInventory = await DetailInventory.findById(inventoryDetail);
    if (!existingDetailInventory) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Detail inventory not found',
          code: 'DETAIL_INVENTORY_NOT_FOUND'
        }
      });
    }

    // Verify batch matches detail inventory
    if (existingDetailInventory.batchId.toString() !== batchId) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Batch ID does not match detail inventory',
          code: 'BATCH_MISMATCH'
        }
      });
    }

    // Validate movement based on type
    if (movementType === 'out' && quantity > 0) {
      // For 'out' movements, quantity should be negative or we'll negate it
      // Check if there's enough stock
      if (existingDetailInventory.quantityAvailable < Math.abs(quantity)) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Insufficient stock for outbound movement',
            code: 'INSUFFICIENT_STOCK',
            details: `Available: ${existingDetailInventory.quantityAvailable}, Requested: ${Math.abs(quantity)}`
          }
        });
      }
    }

    // Create movement
    const movement = new InventoryMovementBatch({
      batchId,
      inventoryDetail,
      movementType,
      quantity,
      reason: reason || null,
      date: date || new Date(),
      performedBy: performedBy || request.user?.id || null,
      purchaseOrderId: purchaseOrderId || null,
      notes: notes || null
    });

    const savedMovement = await movement.save();

    // Update detail inventory based on movement type
    switch (movementType) {
      case 'in':
        // Incoming stock goes to warehouse (quantityOnHand)
        existingDetailInventory.quantityOnHand += Math.abs(quantity);
        break;

      case 'out':
        // Outgoing stock reduces from shelf first, then warehouse
        const outQuantity = Math.abs(quantity);
        if (existingDetailInventory.quantityOnShelf >= outQuantity) {
          existingDetailInventory.quantityOnShelf -= outQuantity;
        } else {
          const remaining = outQuantity - existingDetailInventory.quantityOnShelf;
          existingDetailInventory.quantityOnShelf = 0;
          existingDetailInventory.quantityOnHand -= remaining;
        }
        break;

      case 'adjustment':
        // Adjustment can be positive or negative
        if (quantity > 0) {
          existingDetailInventory.quantityOnHand += quantity;
        } else {
          const adjustQuantity = Math.abs(quantity);
          if (existingDetailInventory.quantityOnHand >= adjustQuantity) {
            existingDetailInventory.quantityOnHand -= adjustQuantity;
          } else {
            const remaining = adjustQuantity - existingDetailInventory.quantityOnHand;
            existingDetailInventory.quantityOnHand = 0;
            existingDetailInventory.quantityOnShelf = Math.max(0, existingDetailInventory.quantityOnShelf - remaining);
          }
        }
        break;

      case 'transfer':
        // Transfer from warehouse to shelf or vice versa
        if (quantity > 0) {
          // Transfer to shelf
          if (existingDetailInventory.quantityOnHand >= quantity) {
            existingDetailInventory.quantityOnHand -= quantity;
            existingDetailInventory.quantityOnShelf += quantity;
          } else {
            return response.status(400).json({
              success: false,
              error: {
                message: 'Insufficient warehouse stock for transfer',
                code: 'INSUFFICIENT_WAREHOUSE_STOCK'
              }
            });
          }
        } else {
          // Transfer to warehouse
          const transferQuantity = Math.abs(quantity);
          if (existingDetailInventory.quantityOnShelf >= transferQuantity) {
            existingDetailInventory.quantityOnShelf -= transferQuantity;
            existingDetailInventory.quantityOnHand += transferQuantity;
          } else {
            return response.status(400).json({
              success: false,
              error: {
                message: 'Insufficient shelf stock for transfer',
                code: 'INSUFFICIENT_SHELF_STOCK'
              }
            });
          }
        }
        break;

      case 'audit':
        // Audit adjusts to match actual count
        // Positive = add discrepancy, Negative = remove discrepancy
        if (quantity > 0) {
          existingDetailInventory.quantityOnHand += quantity;
        } else {
          const auditQuantity = Math.abs(quantity);
          if (existingDetailInventory.quantityOnHand >= auditQuantity) {
            existingDetailInventory.quantityOnHand -= auditQuantity;
          } else {
            const remaining = auditQuantity - existingDetailInventory.quantityOnHand;
            existingDetailInventory.quantityOnHand = 0;
            existingDetailInventory.quantityOnShelf = Math.max(0, existingDetailInventory.quantityOnShelf - remaining);
          }
        }
        break;
    }

    // Save updated detail inventory
    await existingDetailInventory.save();

    // Populate movement details
    await savedMovement.populate([
      {
        path: 'batchId',
        select: 'batchCode costPrice unitPrice quantity mfgDate expiryDate status product',
        populate: {
          path: 'product',
          select: 'productCode name image category',
          populate: {
            path: 'category',
            select: 'name categoryCode'
          }
        }
      },
      {
        path: 'inventoryDetail',
        select: 'quantityOnHand quantityOnShelf quantityReserved location'
      },
      {
        path: 'performedBy',
        select: 'employeeCode firstName lastName'
      },
      {
        path: 'purchaseOrderId',
        select: 'purchaseOrderCode status totalAmount'
      }
    ]);

    response.status(201).json({
      success: true,
      data: savedMovement,
      message: 'Inventory movement batch created successfully'
    });
  } catch (error) {
    console.error('Create inventory movement batch error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create inventory movement batch',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/inventory-movement-batches/:id
 * Update inventory movement batch
 * Requires authentication
 * 
 * Note: Limited updates allowed - mainly for correcting administrative errors
 * Cannot change core movement data (quantity, type, batch) after creation
 */
inventoryMovementBatchesRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      reason,
      notes,
      date
    } = request.body;

    // Find movement
    const movement = await InventoryMovementBatch.findById(request.params.id);

    if (!movement) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory movement batch not found',
          code: 'MOVEMENT_NOT_FOUND'
        }
      });
    }

    // Only allow updating administrative fields, not core movement data
    if (reason !== undefined) movement.reason = reason;
    if (notes !== undefined) movement.notes = notes;
    if (date !== undefined) movement.date = new Date(date);

    const updatedMovement = await movement.save();

    // Populate movement details
    await updatedMovement.populate([
      {
        path: 'batchId',
        select: 'batchCode costPrice unitPrice quantity mfgDate expiryDate status product',
        populate: {
          path: 'product',
          select: 'productCode name image category',
          populate: {
            path: 'category',
            select: 'name categoryCode'
          }
        }
      },
      {
        path: 'inventoryDetail',
        select: 'quantityOnHand quantityOnShelf quantityReserved location'
      },
      {
        path: 'performedBy',
        select: 'employeeCode firstName lastName'
      },
      {
        path: 'purchaseOrderId',
        select: 'purchaseOrderCode status totalAmount'
      }
    ]);

    response.json({
      success: true,
      data: updatedMovement,
      message: 'Inventory movement batch updated successfully'
    });
  } catch (error) {
    console.error('Update inventory movement batch error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update inventory movement batch',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/inventory-movement-batches/bulk-transfer
 * Bulk transfer stock between warehouse and shelf
 * Requires authentication
 * 
 * Request body:
 * - transfers: Array of { detailInventoryId, quantity }
 * - direction: 'toShelf' | 'toWarehouse'
 * - date: Date (optional)
 * - performedBy: Employee ID (optional)
 * - reason: String (optional)
 * - notes: String (optional)
 */
inventoryMovementBatchesRouter.post('/bulk-transfer', userExtractor, async (request, response) => {
  try {
    const {
      transfers,
      direction,
      date,
      performedBy,
      reason,
      notes
    } = request.body;

    // Validation
    if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Transfers array is required and must not be empty',
          code: 'MISSING_TRANSFERS'
        }
      });
    }

    if (!direction || !['toShelf', 'toWarehouse'].includes(direction)) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Valid direction is required (toShelf or toWarehouse)',
          code: 'INVALID_DIRECTION'
        }
      });
    }

    const results = {
      succeeded: [],
      failed: []
    };

    // Process each transfer
    for (const transfer of transfers) {
      try {
        const { detailInventoryId, quantity } = transfer;

        if (!detailInventoryId || !quantity || quantity <= 0) {
          results.failed.push({
            detailInventoryId,
            error: 'Invalid detailInventoryId or quantity'
          });
          continue;
        }

        // Get detail inventory
        const detailInventory = await DetailInventory.findById(detailInventoryId)
          .populate('batchId');

        if (!detailInventory) {
          results.failed.push({
            detailInventoryId,
            error: 'Detail inventory not found'
          });
          continue;
        }

        // Check stock availability
        if (direction === 'toShelf') {
          // Warehouse -> Shelf
          if (detailInventory.quantityOnHand < quantity) {
            results.failed.push({
              detailInventoryId,
              batchCode: detailInventory.batchId?.batchCode,
              error: `Insufficient warehouse stock (available: ${detailInventory.quantityOnHand}, requested: ${quantity})`
            });
            continue;
          }
        } else {
          // Shelf -> Warehouse
          if (detailInventory.quantityOnShelf < quantity) {
            results.failed.push({
              detailInventoryId,
              batchCode: detailInventory.batchId?.batchCode,
              error: `Insufficient shelf stock (available: ${detailInventory.quantityOnShelf}, requested: ${quantity})`
            });
            continue;
          }
        }

        // Create movement record
        // Positive quantity = warehouse to shelf
        // Negative quantity = shelf to warehouse
        const movementQuantity = direction === 'toShelf' ? quantity : -quantity;

        const movement = new InventoryMovementBatch({
          batchId: detailInventory.batchId._id,
          inventoryDetail: detailInventoryId,
          movementType: 'transfer',
          quantity: movementQuantity,
          reason: reason || 'Bulk Stock Transfer',
          date: date || new Date(),
          performedBy: performedBy || request.user?.id || null,
          notes: notes || null
        });

        await movement.save();

        // Update inventory quantities
        if (direction === 'toShelf') {
          detailInventory.quantityOnHand -= quantity;
          detailInventory.quantityOnShelf += quantity;
        } else {
          detailInventory.quantityOnShelf -= quantity;
          detailInventory.quantityOnHand += quantity;
        }

        await detailInventory.save();

        results.succeeded.push({
          detailInventoryId,
          batchCode: detailInventory.batchId?.batchCode,
          quantity,
          movementId: movement._id
        });
      } catch (error) {
        console.error(`Error processing transfer for ${transfer.detailInventoryId}:`, error);
        results.failed.push({
          detailInventoryId: transfer.detailInventoryId,
          error: error.message
        });
      }
    }

    const summary = {
      total: transfers.length,
      succeeded: results.succeeded.length,
      failed: results.failed.length
    };

    response.status(200).json({
      success: true,
      data: {
        summary,
        results
      },
      message: `Bulk transfer completed: ${summary.succeeded} succeeded, ${summary.failed} failed`
    });
  } catch (error) {
    console.error('Bulk transfer error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to perform bulk transfer',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/inventory-movement-batches/:id
 * Delete inventory movement batch
 * Requires authentication
 * 
 * Note: Deleting a movement will reverse its effect on inventory
 * This should be used carefully and mainly for correcting errors
 */
inventoryMovementBatchesRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const movement = await InventoryMovementBatch.findById(request.params.id)
      .populate({
        path: 'batchId',
        select: 'batchCode product',
        populate: {
          path: 'product',
          select: 'productCode name'
        }
      })
      .populate('inventoryDetail');

    if (!movement) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Inventory movement batch not found',
          code: 'MOVEMENT_NOT_FOUND'
        }
      });
    }

    // Reverse the movement effect on detail inventory
    const detailInventory = movement.inventoryDetail;
    const movementType = movement.movementType;
    const quantity = movement.quantity;

    switch (movementType) {
      case 'in':
        // Reverse incoming: reduce quantityOnHand
        if (detailInventory.quantityOnHand >= Math.abs(quantity)) {
          detailInventory.quantityOnHand -= Math.abs(quantity);
        } else {
          return response.status(400).json({
            success: false,
            error: {
              message: 'Cannot reverse movement: insufficient stock',
              code: 'INSUFFICIENT_STOCK_FOR_REVERSAL'
            }
          });
        }
        break;

      case 'out':
        // Reverse outgoing: add back to quantityOnShelf
        detailInventory.quantityOnShelf += Math.abs(quantity);
        break;

      case 'adjustment':
        // Reverse adjustment
        if (quantity > 0) {
          // Was an increase, now decrease
          if (detailInventory.quantityOnHand >= quantity) {
            detailInventory.quantityOnHand -= quantity;
          } else {
            return response.status(400).json({
              success: false,
              error: {
                message: 'Cannot reverse adjustment: insufficient stock',
                code: 'INSUFFICIENT_STOCK_FOR_REVERSAL'
              }
            });
          }
        } else {
          // Was a decrease, now increase
          detailInventory.quantityOnHand += Math.abs(quantity);
        }
        break;

      case 'transfer':
        // Reverse transfer
        if (quantity > 0) {
          // Was warehouse to shelf, reverse it
          if (detailInventory.quantityOnShelf >= quantity) {
            detailInventory.quantityOnShelf -= quantity;
            detailInventory.quantityOnHand += quantity;
          } else {
            return response.status(400).json({
              success: false,
              error: {
                message: 'Cannot reverse transfer: insufficient shelf stock',
                code: 'INSUFFICIENT_STOCK_FOR_REVERSAL'
              }
            });
          }
        } else {
          // Was shelf to warehouse, reverse it
          const transferQuantity = Math.abs(quantity);
          if (detailInventory.quantityOnHand >= transferQuantity) {
            detailInventory.quantityOnHand -= transferQuantity;
            detailInventory.quantityOnShelf += transferQuantity;
          } else {
            return response.status(400).json({
              success: false,
              error: {
                message: 'Cannot reverse transfer: insufficient warehouse stock',
                code: 'INSUFFICIENT_STOCK_FOR_REVERSAL'
              }
            });
          }
        }
        break;

      case 'audit':
        // Reverse audit
        if (quantity > 0) {
          if (detailInventory.quantityOnHand >= quantity) {
            detailInventory.quantityOnHand -= quantity;
          } else {
            return response.status(400).json({
              success: false,
              error: {
                message: 'Cannot reverse audit: insufficient stock',
                code: 'INSUFFICIENT_STOCK_FOR_REVERSAL'
              }
            });
          }
        } else {
          detailInventory.quantityOnHand += Math.abs(quantity);
        }
        break;
    }

    // Save reversed inventory
    await detailInventory.save();

    // Delete movement
    await InventoryMovementBatch.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Inventory movement batch deleted successfully (inventory reversed)',
      data: {
        id: movement._id,
        movementNumber: movement.movementNumber,
        movementType: movement.movementType,
        quantity: movement.quantity,
        batch: {
          id: movement.batchId?._id,
          batchCode: movement.batchId?.batchCode
        },
        product: {
          id: movement.batchId?.product?._id,
          productCode: movement.batchId?.product?.productCode,
          name: movement.batchId?.product?.name
        }
      }
    });
  } catch (error) {
    console.error('Delete inventory movement batch error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete inventory movement batch',
        details: error.message
      }
    });
  }
});

module.exports = inventoryMovementBatchesRouter;