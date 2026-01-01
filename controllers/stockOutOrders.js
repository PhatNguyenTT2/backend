const stockOutOrdersRouter = require('express').Router();
const StockOutOrder = require('../models/stockOutOrder');
const DetailStockOutOrder = require('../models/detailStockOutOrder');
const InventoryMovementBatch = require('../models/inventoryMovementBatch');
const DetailInventory = require('../models/detailInventory');
const { userExtractor } = require('../utils/auth');

/**
 * StockOutOrders Controller - CRUD Pattern (following PurchaseOrders)
 * 
 * Endpoints:
 * - GET /api/stock-out-orders - Get all stock out orders
 * - GET /api/stock-out-orders/:id - Get single stock out order
 * - POST /api/stock-out-orders - Create new stock out order
 * - PUT /api/stock-out-orders/:id - Update stock out order
 * - DELETE /api/stock-out-orders/:id - Delete stock out order
 * - PUT /api/stock-out-orders/:id/status - Update order status
 */

/**
 * GET /api/stock-out-orders
 * Get all stock out orders with filtering
 */
stockOutOrdersRouter.get('/', async (request, response) => {
  try {
    const { status, reason, search, startDate, endDate } = request.query;

    // Build filter
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (reason) {
      filter.reason = reason;
    }

    if (search) {
      filter.$or = [
        { soNumber: new RegExp(search, 'i') },
        { destination: new RegExp(search, 'i') },
        { notes: new RegExp(search, 'i') }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) filter.orderDate.$lte = new Date(endDate);
    }

    // Query with population
    const stockOutOrders = await StockOutOrder.find(filter)
      .populate({
        path: 'createdBy',
        select: 'fullName employeeCode'
      })
      .populate({
        path: 'details',
        populate: [
          {
            path: 'product',
            select: 'name productCode image unitOfMeasure category',
            populate: {
              path: 'category',
              select: 'name categoryCode'
            }
          },
          {
            path: 'batchId',
            select: 'batchCode expiryDate quantity product',
            populate: {
              path: 'product',
              select: 'name productCode'
            }
          }
        ]
      })
      .sort({ createdAt: -1 });

    response.json(stockOutOrders);
  } catch (error) {
    console.error('Get stock out orders error:', error);
    response.status(500).json({
      error: 'Failed to get stock out orders',
      details: error.message
    });
  }
});

/**
 * GET /api/stock-out-orders/:id
 * Get single stock out order by ID
 */
stockOutOrdersRouter.get('/:id', async (request, response) => {
  try {
    const stockOutOrder = await StockOutOrder.findById(request.params.id)
      .populate({
        path: 'createdBy',
        select: 'fullName employeeCode'
      })
      .populate({
        path: 'details',
        populate: [
          {
            path: 'product',
            select: 'name productCode image unitOfMeasure category',
            populate: {
              path: 'category',
              select: 'name categoryCode'
            }
          },
          {
            path: 'batchId',
            select: 'batchCode expiryDate quantity product',
            populate: {
              path: 'product',
              select: 'name productCode'
            }
          }
        ]
      });

    if (!stockOutOrder) {
      return response.status(404).json({
        error: 'Stock out order not found'
      });
    }

    response.json(stockOutOrder);
  } catch (error) {
    console.error('Get stock out order by ID error:', error);
    response.status(500).json({
      error: 'Failed to get stock out order',
      details: error.message
    });
  }
});

/**
 * POST /api/stock-out-orders
 * Create new stock out order
 */
stockOutOrdersRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      orderDate,
      reason,
      destination,
      status,
      notes,
      details // Array of detail items
    } = request.body;

    // Validation
    if (!reason) {
      return response.status(400).json({
        error: 'Reason is required'
      });
    }

    // Get Employee from UserAccount
    const Employee = require('../models/employee');
    const employee = await Employee.findOne({ userAccount: request.user._id });

    if (!employee) {
      return response.status(400).json({
        error: 'No employee profile found for this user'
      });
    }

    // Create stock out order
    const stockOutOrder = new StockOutOrder({
      orderDate: orderDate || new Date(),
      reason,
      destination: destination || null,
      status: status || 'draft',
      notes: notes || null,
      createdBy: employee._id
    });

    const savedStockOutOrder = await stockOutOrder.save();

    // Create detail items if provided
    if (details && Array.isArray(details) && details.length > 0) {
      const detailPromises = details.map(detail =>
        DetailStockOutOrder.create({
          stockOutOrder: savedStockOutOrder._id,
          batchId: detail.batchId,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice || 0
        })
      );

      await Promise.all(detailPromises);
    }

    // Populate and return
    const populatedOrder = await StockOutOrder.findById(savedStockOutOrder._id)
      .populate('createdBy')
      .populate({
        path: 'details',
        populate: {
          path: 'batchId',
          populate: { path: 'product' }
        }
      });

    response.status(201).json(populatedOrder);
  } catch (error) {
    console.error('Create stock out order error:', error);

    if (error.code === 11000) {
      return response.status(409).json({
        error: 'Stock out order with this number already exists'
      });
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    response.status(500).json({
      error: 'Failed to create stock out order',
      details: error.message
    });
  }
});

/**
 * PUT /api/stock-out-orders/:id
 * Update stock out order
 */
stockOutOrdersRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      orderDate,
      reason,
      destination,
      status,
      notes
    } = request.body;

    // Find stock out order
    const stockOutOrder = await StockOutOrder.findById(request.params.id);

    if (!stockOutOrder) {
      return response.status(404).json({
        error: 'Stock out order not found'
      });
    }

    // Check if order can be edited
    if (!stockOutOrder.canEdit()) {
      return response.status(400).json({
        error: `Cannot edit stock out order in ${stockOutOrder.status} status`
      });
    }

    // Update fields
    if (orderDate !== undefined) stockOutOrder.orderDate = orderDate;
    if (reason !== undefined) stockOutOrder.reason = reason;
    if (destination !== undefined) stockOutOrder.destination = destination;
    if (status !== undefined) stockOutOrder.status = status;
    if (notes !== undefined) stockOutOrder.notes = notes;

    const updatedStockOutOrder = await stockOutOrder.save();

    // Populate for response
    await updatedStockOutOrder.populate([
      { path: 'createdBy' },
      {
        path: 'details',
        populate: {
          path: 'batchId',
          populate: { path: 'product' }
        }
      }
    ]);

    response.json(updatedStockOutOrder);
  } catch (error) {
    console.error('Update stock out order error:', error);

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    response.status(500).json({
      error: 'Failed to update stock out order',
      details: error.message
    });
  }
});

/**
 * DELETE /api/stock-out-orders/:id
 * Delete stock out order
 * 
 * Note: Can delete draft, completed, or cancelled stock out orders
 * Cannot delete pending or approved orders (they must be cancelled first or completed)
 * All related DetailStockOutOrder records will be deleted automatically
 */
stockOutOrdersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const stockOutOrder = await StockOutOrder.findById(request.params.id);

    if (!stockOutOrder) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Stock out order not found',
          code: 'STOCK_OUT_ORDER_NOT_FOUND'
        }
      });
    }

    // Only allow deletion of draft, completed, or cancelled orders
    // Note: Pending and approved orders should not be deleted as they may have active processes
    if (stockOutOrder.status === 'pending' || stockOutOrder.status === 'approved') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete pending or approved stock out orders',
          code: 'INVALID_STATUS_FOR_DELETION',
          details: {
            currentStatus: stockOutOrder.status,
            message: 'Pending or approved stock out orders cannot be deleted. Please cancel the order first or wait until it is completed.'
          }
        }
      });
    }

    // Check if stock out order has details
    const detailsCount = await DetailStockOutOrder.countDocuments({
      stockOutOrder: stockOutOrder._id
    });

    // Delete all detail stock out orders first
    if (detailsCount > 0) {
      await DetailStockOutOrder.deleteMany({ stockOutOrder: stockOutOrder._id });
    }

    // Delete the stock out order
    await StockOutOrder.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Stock out order deleted successfully',
      data: {
        id: stockOutOrder._id,
        soNumber: stockOutOrder.soNumber,
        status: stockOutOrder.status,
        deletedDetails: detailsCount
      }
    });
  } catch (error) {
    console.error('Delete stock out order error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete stock out order',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/stock-out-orders/:id/status
 * Update order status with workflow validation
 * Creates inventory movements when status changes to 'completed'
 */
stockOutOrdersRouter.put('/:id/status', userExtractor, async (request, response) => {
  try {
    const { status } = request.body;

    if (!status) {
      return response.status(400).json({
        error: 'Status is required'
      });
    }

    const stockOutOrder = await StockOutOrder.findById(request.params.id)
      .populate('createdBy');

    if (!stockOutOrder) {
      return response.status(404).json({
        error: 'Stock out order not found'
      });
    }

    // Validate status transitions
    const validTransitions = {
      draft: ['pending', 'cancelled'],
      pending: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    if (!validTransitions[stockOutOrder.status].includes(status)) {
      return response.status(400).json({
        error: `Cannot change status from ${stockOutOrder.status} to ${status}`
      });
    }

    const oldStatus = stockOutOrder.status;
    stockOutOrder.status = status;

    // If completing the order, create inventory movements
    if (status === 'completed' && oldStatus !== 'completed') {
      // Get all detail items
      const details = await DetailStockOutOrder.find({ stockOutOrder: stockOutOrder._id })
        .populate('batchId')
        .populate('product');

      if (!details || details.length === 0) {
        return response.status(400).json({
          error: 'Cannot complete stock out order without items'
        });
      }

      // Create inventory movements for each item
      const movementResults = [];
      const movementErrors = [];

      for (const detail of details) {
        try {
          // Find the detail inventory for this batch
          const detailInventory = await DetailInventory.findOne({ batchId: detail.batchId._id });

          if (!detailInventory) {
            movementErrors.push({
              batchCode: detail.batchId?.batchCode,
              error: 'Detail inventory not found for this batch'
            });
            continue;
          }

          // Check if there's enough stock
          const availableQty = detailInventory.quantityOnHand + detailInventory.quantityOnShelf;
          if (availableQty < detail.quantity) {
            movementErrors.push({
              batchCode: detail.batchId?.batchCode,
              error: `Insufficient stock. Available: ${availableQty}, Required: ${detail.quantity}`
            });
            continue;
          }

          // Create inventory movement (type: 'out')
          const movement = new InventoryMovementBatch({
            batchId: detail.batchId._id,
            inventoryDetail: detailInventory._id,
            movementType: 'out',
            quantity: detail.quantity, // Positive number for out movement
            reason: `Stock Out Order: ${stockOutOrder.soNumber} - ${stockOutOrder.reason}`,
            date: new Date(),
            performedBy: stockOutOrder.createdBy?._id || null,
            notes: stockOutOrder.notes || null
          });

          await movement.save();

          // Update detail inventory - Stock out reduces from warehouse (quantityOnHand)
          // This is different from sales which reduces from shelf
          const outQuantity = detail.quantity;
          detailInventory.quantityOnHand -= outQuantity;

          await detailInventory.save();

          movementResults.push({
            batchCode: detail.batchId?.batchCode,
            quantity: detail.quantity,
            movementId: movement._id
          });
        } catch (error) {
          console.error(`Error creating movement for batch ${detail.batchId?.batchCode}:`, error);
          movementErrors.push({
            batchCode: detail.batchId?.batchCode,
            error: error.message
          });
        }
      }

      // If there were any errors, rollback status change
      if (movementErrors.length > 0) {
        stockOutOrder.status = oldStatus; // Rollback
        return response.status(400).json({
          error: 'Failed to create inventory movements',
          details: movementErrors,
          message: 'Some items could not be processed. Order status not changed.'
        });
      }

      // Set completed date
      stockOutOrder.completedDate = new Date();

      // Save order with movement metadata
      await stockOutOrder.save();

      // Refresh notifications after inventory change
      const { refreshNotifications } = require('../utils/notificationHelper');
      await refreshNotifications();
      console.log('✅ Notifications refreshed after stock out completion');

      // Return success with movement details
      await stockOutOrder.populate([
        { path: 'createdBy' },
        {
          path: 'details',
          populate: {
            path: 'batchId',
            populate: { path: 'product' }
          }
        }
      ]);

      return response.json({
        ...stockOutOrder.toObject(),
        movements: movementResults,
        message: `Stock out order completed. ${movementResults.length} inventory movements created.`
      });
    }

    // For other status changes, just update the order
    await stockOutOrder.save();

    await stockOutOrder.populate([
      { path: 'createdBy' },
      {
        path: 'details',
        populate: {
          path: 'batchId',
          populate: { path: 'product' }
        }
      }
    ]);

    response.json(stockOutOrder);
  } catch (error) {
    console.error('Update stock out order status error:', error);
    response.status(500).json({
      error: 'Failed to update stock out order status',
      details: error.message
    });
  }
});

module.exports = stockOutOrdersRouter;
