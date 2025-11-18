const suppliersRouter = require('express').Router();
const Supplier = require('../models/supplier');
const PurchaseOrder = require('../models/purchaseOrder');
const { userExtractor } = require('../utils/auth');

/**
 * Suppliers Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/suppliers - Get all suppliers with filtering
 * - GET /api/suppliers/:id - Get single supplier by ID
 * - POST /api/suppliers - Create new supplier
 * - PUT /api/suppliers/:id - Update supplier
 * - DELETE /api/suppliers/:id - Delete supplier
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getStatistics() - Supplier statistics
 * - getTopSuppliers() - Use GET /api/suppliers with sort by currentDebt or total orders
 * - getSuppliersWithHighDebt() - Use GET /api/suppliers?highDebt=true
 * - getSuppliersExceedingCredit() - Use GET /api/suppliers?creditExceeded=true
 * - updateCreditLimit() - Use PUT /api/suppliers/:id with { creditLimit: value }
 * - updateDebt() - Internal use only (handled by purchase order completion)
 * - activate() - Use PUT /api/suppliers/:id with { isActive: true }
 * - deactivate() - Use PUT /api/suppliers/:id with { isActive: false }
 */

/**
 * GET /api/suppliers
 * Get all suppliers with filtering via query parameters
 * 
 * Query parameters:
 * - isActive: boolean - Filter by active status
 * - search: string - Search by company name
 * - paymentTerms: string - Filter by payment terms (cod/net15/net30/net60/net90)
 * - highDebt: boolean - Filter suppliers with high debt (>80% credit utilization)
 * - creditExceeded: boolean - Filter suppliers exceeding credit limit
 * - minCreditLimit: number - Filter by minimum credit limit
 * - maxCreditLimit: number - Filter by maximum credit limit
 * - withPurchaseOrders: boolean - Include purchase orders
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
suppliersRouter.get('/', async (request, response) => {
  try {
    const {
      isActive,
      search,
      paymentTerms,
      highDebt,
      creditExceeded,
      minCreditLimit,
      maxCreditLimit,
      withPurchaseOrders,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { companyName: new RegExp(search, 'i') },
        { supplierCode: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }

    if (paymentTerms) {
      filter.paymentTerms = paymentTerms;
    }

    if (minCreditLimit !== undefined || maxCreditLimit !== undefined) {
      filter.creditLimit = {};
      if (minCreditLimit !== undefined) {
        filter.creditLimit.$gte = parseFloat(minCreditLimit);
      }
      if (maxCreditLimit !== undefined) {
        filter.creditLimit.$lte = parseFloat(maxCreditLimit);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = Supplier.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Populate purchase orders if requested
    if (withPurchaseOrders === 'true') {
      query = query.populate({
        path: 'purchaseOrders',
        select: 'purchaseOrderCode totalAmount status createdAt',
        options: { limit: 10, sort: { createdAt: -1 } }
      });
    }

    let suppliers = await query;

    // Post-processing filters (require virtuals)
    if (highDebt === 'true') {
      suppliers = suppliers.filter(s => s.creditUtilization >= 80);
    }

    if (creditExceeded === 'true') {
      suppliers = suppliers.filter(s => s.isCreditExceeded);
    }

    // Get total count for pagination (before virtual filters)
    const total = await Supplier.countDocuments(filter);

    response.json({
      success: true,
      data: {
        suppliers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: highDebt === 'true' || creditExceeded === 'true' ? suppliers.length : total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get suppliers',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/suppliers/:id
 * Get single supplier by ID with purchase orders and credit info
 */
suppliersRouter.get('/:id', async (request, response) => {
  try {
    const supplier = await Supplier.findById(request.params.id)
      .populate({
        path: 'purchaseOrders',
        select: 'purchaseOrderCode totalAmount status deliveryDate createdAt',
        options: { sort: { createdAt: -1 } }
      });

    if (!supplier) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Supplier not found',
          code: 'SUPPLIER_NOT_FOUND'
        }
      });
    }

    // Get purchase order statistics
    const totalOrders = supplier.purchaseOrders?.length || 0;
    const completedOrders = supplier.purchaseOrders?.filter(po => po.status === 'completed').length || 0;
    const pendingOrders = supplier.purchaseOrders?.filter(po => po.status === 'pending').length || 0;

    response.json({
      success: true,
      data: {
        supplier,
        statistics: {
          totalOrders,
          completedOrders,
          pendingOrders,
          availableCredit: supplier.availableCredit,
          creditUtilization: supplier.creditUtilization,
          isCreditExceeded: supplier.isCreditExceeded
        }
      }
    });
  } catch (error) {
    console.error('Get supplier by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get supplier',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/suppliers
 * Create new supplier
 * Requires authentication
 */
suppliersRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      companyName,
      phone,
      address,
      accountNumber,
      paymentTerms,
      creditLimit,
      isActive
    } = request.body;

    // Validation
    if (!companyName) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Company name is required',
          code: 'MISSING_COMPANY_NAME'
        }
      });
    }

    // Check if supplier with same company name already exists
    const existingSupplier = await Supplier.findOne({
      companyName: { $regex: new RegExp(`^${companyName}$`, 'i') }
    });

    if (existingSupplier) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Supplier with this company name already exists',
          code: 'DUPLICATE_COMPANY_NAME',
          details: {
            existingSupplier: {
              id: existingSupplier._id,
              supplierCode: existingSupplier.supplierCode,
              companyName: existingSupplier.companyName
            }
          }
        }
      });
    }

    // Check if phone number already exists (if provided)
    if (phone) {
      const existingPhone = await Supplier.findOne({ phone });
      if (existingPhone) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Supplier with this phone number already exists',
            code: 'DUPLICATE_PHONE',
            details: {
              existingSupplier: {
                id: existingPhone._id,
                supplierCode: existingPhone.supplierCode,
                companyName: existingPhone.companyName
              }
            }
          }
        });
      }
    }

    // Create supplier
    const supplier = new Supplier({
      companyName,
      phone: phone || null,
      address: address || null,
      accountNumber: accountNumber || null,
      paymentTerms: paymentTerms || 'net30',
      creditLimit: creditLimit || 0,
      currentDebt: 0,
      isActive: isActive !== undefined ? isActive : true
    });

    const savedSupplier = await supplier.save();

    response.status(201).json({
      success: true,
      data: savedSupplier,
      message: 'Supplier created successfully'
    });
  } catch (error) {
    console.error('Create supplier error:', error);

    // Handle duplicate supplier code (should not happen with auto-generation)
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Supplier code already exists',
          code: 'DUPLICATE_SUPPLIER_CODE',
          details: error.message
        }
      });
    }

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
        message: 'Failed to create supplier',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/suppliers/:id
 * Update supplier
 * Requires authentication
 * 
 * Note: This endpoint handles all updates including:
 * - Company information updates
 * - Credit limit adjustments
 * - Payment terms changes
 * - Status changes (activate/deactivate via isActive field)
 * - Debt updates (normally handled internally by purchase orders)
 */
suppliersRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      companyName,
      phone,
      address,
      accountNumber,
      paymentTerms,
      creditLimit,
      currentDebt,
      isActive
    } = request.body;

    // Find supplier
    const supplier = await Supplier.findById(request.params.id);

    if (!supplier) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Supplier not found',
          code: 'SUPPLIER_NOT_FOUND'
        }
      });
    }

    // Check if company name is being changed and if it conflicts
    if (companyName && companyName !== supplier.companyName) {
      const existingSupplier = await Supplier.findOne({
        _id: { $ne: supplier._id },
        companyName: { $regex: new RegExp(`^${companyName}$`, 'i') }
      });

      if (existingSupplier) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Another supplier with this company name already exists',
            code: 'DUPLICATE_COMPANY_NAME'
          }
        });
      }
    }

    // Check if phone is being changed and if it conflicts
    if (phone && phone !== supplier.phone) {
      const existingPhone = await Supplier.findOne({
        _id: { $ne: supplier._id },
        phone: phone
      });

      if (existingPhone) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Another supplier with this phone number already exists',
            code: 'DUPLICATE_PHONE'
          }
        });
      }
    }

    // Validate credit limit change
    if (creditLimit !== undefined) {
      const newCreditLimit = parseFloat(creditLimit);
      if (newCreditLimit < supplier.currentDebt) {
        return response.status(400).json({
          success: false,
          error: {
            message: 'Credit limit cannot be lower than current debt',
            code: 'INVALID_CREDIT_LIMIT',
            details: {
              currentDebt: supplier.currentDebt,
              requestedCreditLimit: newCreditLimit
            }
          }
        });
      }
    }

    // Update fields
    if (companyName !== undefined) supplier.companyName = companyName;
    if (phone !== undefined) supplier.phone = phone;
    if (address !== undefined) supplier.address = address;
    if (accountNumber !== undefined) supplier.accountNumber = accountNumber;
    if (paymentTerms !== undefined) supplier.paymentTerms = paymentTerms;
    if (creditLimit !== undefined) supplier.creditLimit = creditLimit;
    if (currentDebt !== undefined) supplier.currentDebt = currentDebt;
    if (isActive !== undefined) supplier.isActive = isActive;

    const updatedSupplier = await supplier.save();

    response.json({
      success: true,
      data: updatedSupplier,
      message: 'Supplier updated successfully'
    });
  } catch (error) {
    console.error('Update supplier error:', error);

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
        message: 'Failed to update supplier',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/suppliers/:id
 * Delete supplier
 * Requires authentication
 * 
 * Note: Can only delete inactive suppliers. Cannot delete if supplier has active purchase orders or outstanding debt.
 */
suppliersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const supplier = await Supplier.findById(request.params.id);

    if (!supplier) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Supplier not found',
          code: 'SUPPLIER_NOT_FOUND'
        }
      });
    }

    // Only allow deletion of inactive suppliers
    if (supplier.isActive !== false) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete active supplier',
          code: 'SUPPLIER_IS_ACTIVE',
          details: 'Supplier must be deactivated before deletion'
        }
      });
    }

    // Check if supplier has outstanding debt
    if (supplier.currentDebt > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete supplier with outstanding debt',
          code: 'SUPPLIER_HAS_DEBT',
          details: {
            currentDebt: supplier.currentDebt,
            message: 'Please clear all debts before deleting this supplier or deactivate instead'
          }
        }
      });
    }

    // Check if supplier has active purchase orders
    const activePurchaseOrders = await PurchaseOrder.countDocuments({
      supplier: supplier._id,
      status: { $in: ['pending', 'approved', 'in-transit'] }
    });

    if (activePurchaseOrders > 0) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete supplier with active purchase orders',
          code: 'SUPPLIER_HAS_ACTIVE_ORDERS',
          details: {
            activePurchaseOrders,
            message: 'Please complete or cancel all active purchase orders before deleting, or deactivate the supplier instead'
          }
        }
      });
    }

    // Hard delete - remove from database
    await Supplier.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Supplier deleted successfully',
      data: {
        id: supplier._id,
        supplierCode: supplier.supplierCode,
        companyName: supplier.companyName
      }
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete supplier',
        details: error.message
      }
    });
  }
});

module.exports = suppliersRouter;
