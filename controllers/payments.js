const paymentsRouter = require('express').Router();
const Payment = require('../models/payment');
const Order = require('../models/order');
const PurchaseOrder = require('../models/purchaseOrder');

/**
 * Payments Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/payments - Get all payments with filtering
 * - GET /api/payments/:id - Get single payment by ID
 * - POST /api/payments - Create new payment
 * - PUT /api/payments/:id - Update payment
 * - DELETE /api/payments/:id - Delete payment (only pending)
 * 
 * Additional endpoints for convenience:
 * - GET /api/orders/:id/payments - Get all payments for an order
 * - GET /api/purchase-orders/:id/payments - Get all payments for a purchase order
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getPaymentStatistics() - Waiting for frontend request
 * - getPaymentsByDateRange() - Use GET /api/payments?startDate=...&endDate=...
 * - getOverduePayments() - Use virtual isOverdue in query
 * - confirmPayment() - Use PUT /api/payments/:id with { status: 'completed' }
 * - cancelPayment() - Use PUT /api/payments/:id with { status: 'cancelled' }
 */

/**
 * GET /api/payments
 * Get all payments with filtering via query parameters
 * 
 * Query parameters:
 * - referenceType: string - Filter by reference type (Order/PurchaseOrder)
 * - referenceId: ObjectId - Filter by specific order or purchase order
 * - status: string - Filter by payment status (pending/completed/cancelled)
 * - paymentMethod: string - Filter by payment method (cash/bank_transfer)
 * - startDate: date - Filter payments from this date
 * - endDate: date - Filter payments to this date
 * - minAmount: number - Filter by minimum amount
 * - maxAmount: number - Filter by maximum amount
 * - createdBy: ObjectId - Filter by employee who created the payment
 * - search: string - Search by payment number
 * - sortBy: string - Sort field (default: paymentDate)
 * - sortOrder: string - Sort order (asc/desc, default: desc)
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
paymentsRouter.get('/', async (request, response) => {
  try {
    const {
      referenceType,
      referenceId,
      status,
      paymentMethod,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      createdBy,
      search,
      sortBy = 'paymentDate',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = request.query;

    // Build filter object
    const filter = {};

    if (referenceType) {
      filter.referenceType = referenceType;
    }

    if (referenceId) {
      filter.referenceId = referenceId;
    }

    if (status) {
      filter.status = status;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (createdBy) {
      filter.createdBy = createdBy;
    }

    if (search) {
      filter.paymentNumber = new RegExp(search, 'i');
    }

    // Date range filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) {
        filter.paymentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.paymentDate.$lte = new Date(endDate);
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) {
        filter.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        filter.amount.$lte = parseFloat(maxAmount);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Query with populate
    const payments = await Payment.find(filter)
      .populate('createdBy', 'employeeName userAccount')
      .populate({
        path: 'createdBy',
        populate: {
          path: 'userAccount',
          select: 'userCode'
        }
      })
      .populate('referenceId') // Polymorphic populate
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Payment.countDocuments(filter);

    response.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch payments',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

/**
 * GET /api/payments/:id
 * Get single payment by ID
 */
paymentsRouter.get('/:id', async (request, response) => {
  try {
    const payment = await Payment.findById(request.params.id)
      .populate('createdBy', 'employeeName userAccount')
      .populate({
        path: 'createdBy',
        populate: {
          path: 'userAccount',
          select: 'userCode'
        }
      })
      .populate('referenceId');

    if (!payment) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Payment not found',
          code: 'PAYMENT_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch payment',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

/**
 * POST /api/payments
 * Create new payment
 */
paymentsRouter.post('/', async (request, response) => {
  try {
    const {
      referenceType,
      referenceId,
      amount,
      paymentMethod,
      paymentDate,
      status,
      notes
    } = request.body;

    // Validate required fields
    if (!referenceType || !referenceId || !amount || !paymentMethod) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields: referenceType, referenceId, amount, paymentMethod',
          code: 'MISSING_REQUIRED_FIELDS'
        }
      });
    }

    // Validate referenceType
    if (!['Order', 'PurchaseOrder'].includes(referenceType)) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Invalid referenceType. Must be "Order" or "PurchaseOrder"',
          code: 'INVALID_REFERENCE_TYPE'
        }
      });
    }

    // Check if reference exists
    const Model = referenceType === 'Order' ? Order : PurchaseOrder;
    const referenceExists = await Model.exists({ _id: referenceId });
    if (!referenceExists) {
      return response.status(404).json({
        success: false,
        error: {
          message: `${referenceType} not found`,
          code: 'REFERENCE_NOT_FOUND'
        }
      });
    }

    // Create payment
    const payment = await Payment.create({
      referenceType,
      referenceId,
      amount,
      paymentMethod,
      paymentDate: paymentDate || new Date(),
      status: status || 'pending',
      createdBy: request.user?.id,
      notes
    });

    // Populate before returning
    await payment.populate('createdBy', 'employeeName userAccount');
    await payment.populate('referenceId');

    response.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create payment',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

/**
 * PUT /api/payments/:id
 * Update payment
 */
paymentsRouter.put('/:id', async (request, response) => {
  try {
    const { amount, paymentMethod, paymentDate, status, notes } = request.body;

    const payment = await Payment.findById(request.params.id);

    if (!payment) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Payment not found',
          code: 'PAYMENT_NOT_FOUND'
        }
      });
    }

    // Update fields
    if (amount !== undefined) payment.amount = amount;
    if (paymentMethod !== undefined) payment.paymentMethod = paymentMethod;
    if (paymentDate !== undefined) payment.paymentDate = paymentDate;
    if (status !== undefined) payment.status = status;
    if (notes !== undefined) payment.notes = notes;

    await payment.save();

    // Populate before returning
    await payment.populate('createdBy', 'employeeName userAccount');
    await payment.populate('referenceId');

    response.json({
      success: true,
      message: 'Payment updated successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update payment',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

/**
 * DELETE /api/payments/:id
 * Delete payment (only if status is pending)
 */
paymentsRouter.delete('/:id', async (request, response) => {
  try {
    const payment = await Payment.findById(request.params.id);

    if (!payment) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Payment not found',
          code: 'PAYMENT_NOT_FOUND'
        }
      });
    }

    // Only allow deleting pending payments
    if (payment.status !== 'pending') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Only pending payments can be deleted',
          code: 'CANNOT_DELETE_PAYMENT'
        }
      });
    }

    await payment.deleteOne();

    response.json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete payment',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

// Export router
module.exports = paymentsRouter;
