const detailStockOutOrdersRouter = require('express').Router();
const DetailStockOutOrder = require('../models/detailStockOutOrder');
const StockOutOrder = require('../models/stockOutOrder');
const Product = require('../models/product');
const ProductBatch = require('../models/productBatch');
const { userExtractor } = require('../utils/auth');

/**
 * DetailStockOutOrders Controller - CRUD Pattern (following DetailPurchaseOrders)
 * 
 * Endpoints:
 * - GET /api/detail-stock-out-orders - Get all detail stock out orders with filtering
 * - GET /api/detail-stock-out-orders/:id - Get single detail stock out order by ID
 * - POST /api/detail-stock-out-orders - Create new detail stock out order
 * - PUT /api/detail-stock-out-orders/:id - Update detail stock out order
 * - DELETE /api/detail-stock-out-orders/:id - Delete detail stock out order
 */

/**
 * GET /api/detail-stock-out-orders
 * Get all detail stock out orders with filtering
 * 
 * Query parameters:
 * - stockOutOrder: ObjectId - Filter by stock out order
 * - product: ObjectId - Filter by product
 * - batchId: ObjectId - Filter by batch
 * - minQuantity: number - Filter by minimum quantity
 * - maxQuantity: number - Filter by maximum quantity
 * - minPrice: number - Filter by minimum unit price
 * - maxPrice: number - Filter by maximum unit price
 * - withStockOutOrder: boolean - Include stock out order details
 * - withProduct: boolean - Include product details
 * - withBatch: boolean - Include batch details
 */
detailStockOutOrdersRouter.get('/', async (request, response) => {
  try {
    const {
      stockOutOrder,
      product,
      batchId,
      minQuantity,
      maxQuantity,
      minPrice,
      maxPrice,
      withStockOutOrder,
      withProduct,
      withBatch
    } = request.query;

    // Build filter object
    const filter = {};

    if (stockOutOrder) {
      filter.stockOutOrder = stockOutOrder;
    }

    if (product) {
      filter.product = product;
    }

    if (batchId) {
      filter.batchId = batchId;
    }

    // Quantity range filter
    if (minQuantity || maxQuantity) {
      filter.quantity = {};
      if (minQuantity) filter.quantity.$gte = parseInt(minQuantity);
      if (maxQuantity) filter.quantity.$lte = parseInt(maxQuantity);
    }

    // Unit price range filter
    if (minPrice || maxPrice) {
      filter.unitPrice = {};
      if (minPrice) filter.unitPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.unitPrice.$lte = parseFloat(maxPrice);
    }

    // Build query with optional population
    let query = DetailStockOutOrder.find(filter);

    // Conditional population based on query parameters
    if (withStockOutOrder === 'true') {
      query = query.populate({
        path: 'stockOutOrder',
        select: 'woNumber orderDate status reason destination createdBy',
        populate: {
          path: 'createdBy',
          select: 'fullName employeeCode'
        }
      });
    }

    if (withProduct === 'true') {
      query = query.populate({
        path: 'product',
        select: 'productCode name image unitPrice category',
        populate: {
          path: 'category',
          select: 'categoryCode name'
        }
      });
    }

    if (withBatch === 'true') {
      query = query.populate({
        path: 'batchId',
        select: 'batchCode expiryDate quantity product',
        populate: {
          path: 'product',
          select: 'name productCode'
        }
      });
    }

    const detailStockOutOrders = await query.sort({ createdAt: -1 });

    response.json(detailStockOutOrders);
  } catch (error) {
    console.error('Get detail stock out orders error:', error);
    response.status(500).json({
      error: 'Failed to get detail stock out orders',
      details: error.message
    });
  }
});

/**
 * GET /api/detail-stock-out-orders/:id
 * Get single detail stock out order by ID
 */
detailStockOutOrdersRouter.get('/:id', async (request, response) => {
  try {
    const detailStockOutOrder = await DetailStockOutOrder.findById(request.params.id)
      .populate({
        path: 'stockOutOrder',
        select: 'woNumber orderDate status reason destination',
        populate: {
          path: 'createdBy',
          select: 'fullName employeeCode'
        }
      })
      .populate({
        path: 'product',
        select: 'productCode name image unitPrice category',
        populate: {
          path: 'category',
          select: 'categoryCode name'
        }
      })
      .populate({
        path: 'batchId',
        select: 'batchCode expiryDate quantity product',
        populate: {
          path: 'product',
          select: 'name productCode'
        }
      });

    if (!detailStockOutOrder) {
      return response.status(404).json({
        error: 'Detail stock out order not found'
      });
    }

    response.json(detailStockOutOrder);
  } catch (error) {
    console.error('Get detail stock out order by ID error:', error);
    response.status(500).json({
      error: 'Failed to get detail stock out order',
      details: error.message
    });
  }
});

/**
 * POST /api/detail-stock-out-orders
 * Create new detail stock out order
 */
detailStockOutOrdersRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      stockOutOrder,
      product,
      batchId,
      quantity,
      unitPrice,
      notes
    } = request.body;

    // Validation
    if (!stockOutOrder) {
      return response.status(400).json({
        error: 'Stock out order is required'
      });
    }

    if (!product) {
      return response.status(400).json({
        error: 'Product is required'
      });
    }

    if (!batchId) {
      return response.status(400).json({
        error: 'Batch is required'
      });
    }

    if (!quantity || quantity < 1) {
      return response.status(400).json({
        error: 'Valid quantity is required (minimum 1)'
      });
    }

    if (unitPrice === undefined || unitPrice < 0) {
      return response.status(400).json({
        error: 'Valid unit price is required'
      });
    }

    // Verify stock out order exists
    const woExists = await StockOutOrder.findById(stockOutOrder);
    if (!woExists) {
      return response.status(404).json({
        error: 'Stock out order not found'
      });
    }

    // Verify product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return response.status(404).json({
        error: 'Product not found'
      });
    }

    // Verify batch exists
    const batchExists = await ProductBatch.findById(batchId);
    if (!batchExists) {
      return response.status(404).json({
        error: 'Batch not found'
      });
    }

    // Create detail stock out order
    const detailStockOutOrder = new DetailStockOutOrder({
      stockOutOrder,
      product,
      batchId,
      quantity,
      unitPrice,
      notes: notes || null
    });

    const savedDetail = await detailStockOutOrder.save();

    // Populate for response
    await savedDetail.populate([
      {
        path: 'stockOutOrder',
        select: 'woNumber orderDate status'
      },
      {
        path: 'product',
        select: 'productCode name image unitPrice'
      },
      {
        path: 'batchId',
        select: 'batchCode expiryDate'
      }
    ]);

    response.status(201).json(savedDetail);
  } catch (error) {
    console.error('Create detail stock out order error:', error);

    if (error.code === 11000) {
      return response.status(409).json({
        error: 'Detail stock out order already exists for this product in this order'
      });
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    response.status(500).json({
      error: 'Failed to create detail stock out order',
      details: error.message
    });
  }
});

/**
 * PUT /api/detail-stock-out-orders/:id
 * Update detail stock out order
 */
detailStockOutOrdersRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      quantity,
      unitPrice,
      notes
    } = request.body;

    const detailStockOutOrder = await DetailStockOutOrder.findById(request.params.id);

    if (!detailStockOutOrder) {
      return response.status(404).json({
        error: 'Detail stock out order not found'
      });
    }

    // Update fields (product, batch, stockOutOrder should not be changed)
    if (quantity !== undefined) {
      if (quantity < 1) {
        return response.status(400).json({
          error: 'Quantity must be at least 1'
        });
      }
      detailStockOutOrder.quantity = quantity;
    }

    if (unitPrice !== undefined) {
      if (unitPrice < 0) {
        return response.status(400).json({
          error: 'Unit price cannot be negative'
        });
      }
      detailStockOutOrder.unitPrice = unitPrice;
    }

    if (notes !== undefined) {
      detailStockOutOrder.notes = notes;
    }

    const updatedDetail = await detailStockOutOrder.save();

    // Populate for response
    await updatedDetail.populate([
      {
        path: 'stockOutOrder',
        select: 'woNumber orderDate status'
      },
      {
        path: 'product',
        select: 'productCode name image unitPrice'
      },
      {
        path: 'batchId',
        select: 'batchCode expiryDate'
      }
    ]);

    response.json(updatedDetail);
  } catch (error) {
    console.error('Update detail stock out order error:', error);

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    response.status(500).json({
      error: 'Failed to update detail stock out order',
      details: error.message
    });
  }
});

/**
 * DELETE /api/detail-stock-out-orders/:id
 * Delete detail stock out order
 */
detailStockOutOrdersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const detailStockOutOrder = await DetailStockOutOrder.findById(request.params.id);

    if (!detailStockOutOrder) {
      return response.status(404).json({
        error: 'Detail stock out order not found'
      });
    }

    await DetailStockOutOrder.findByIdAndDelete(request.params.id);

    response.json({
      message: 'Detail stock out order deleted successfully',
      deletedDetail: {
        id: detailStockOutOrder._id,
        product: detailStockOutOrder.product,
        quantity: detailStockOutOrder.quantity
      }
    });
  } catch (error) {
    console.error('Delete detail stock out order error:', error);
    response.status(500).json({
      error: 'Failed to delete detail stock out order',
      details: error.message
    });
  }
});

module.exports = detailStockOutOrdersRouter;
