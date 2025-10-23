const suppliersRouter = require('express').Router()
const Supplier = require('../models/supplier')
const DetailSupplier = require('../models/detailSupplier')
const PurchaseOrder = require('../models/purchaseOrder')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/suppliers - Get all suppliers
suppliersRouter.get('/', userExtractor, async (request, response) => {
  try {
    const { is_active, search } = request.query

    let suppliers

    if (search) {
      // Use search method
      suppliers = await Supplier.searchSuppliers(search)
    } else {
      // Build filter
      const filter = {}
      if (is_active !== undefined) {
        filter.isActive = is_active === 'true'
      }

      suppliers = await Supplier.find(filter)
        .populate('detailSupplier')
        .sort({ companyName: 1 })
    }

    const suppliersData = suppliers.map(supplier => ({
      id: supplier._id,
      supplierCode: supplier.supplierCode,
      companyName: supplier.companyName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      isActive: supplier.isActive,
      detailSupplier: supplier.detailSupplier ? {
        id: supplier.detailSupplier._id,
        contactPerson: supplier.detailSupplier.contactPerson,
        paymentTerms: supplier.detailSupplier.paymentTerms,
        totalDebt: supplier.detailSupplier.totalDebt,
        rating: supplier.detailSupplier.rating
      } : null,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        suppliers: suppliersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch suppliers'
    })
  }
})

// GET /api/suppliers/active - Get active suppliers only
suppliersRouter.get('/active', userExtractor, async (request, response) => {
  try {
    const suppliers = await Supplier.findActiveSuppliers()

    const suppliersData = suppliers.map(supplier => ({
      id: supplier._id,
      supplierCode: supplier.supplierCode,
      companyName: supplier.companyName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      detailSupplier: supplier.detailSupplier ? {
        id: supplier.detailSupplier._id,
        contactPerson: supplier.detailSupplier.contactPerson,
        paymentTerms: supplier.detailSupplier.paymentTerms,
        totalDebt: supplier.detailSupplier.totalDebt,
        rating: supplier.detailSupplier.rating
      } : null,
      createdAt: supplier.createdAt
    }))

    response.status(200).json({
      success: true,
      data: {
        suppliers: suppliersData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch active suppliers'
    })
  }
})

// GET /api/suppliers/stats/overview - Get statistics
suppliersRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Supplier.getStatistics()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch statistics'
    })
  }
})

// GET /api/suppliers/:id - Get single supplier
suppliersRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const supplier = await Supplier.findById(request.params.id)
      .populate('detailSupplier')
      .populate({
        path: 'purchaseOrders',
        select: 'poNumber orderDate status totalPrice',
        options: { limit: 10, sort: { orderDate: -1 } }
      })

    if (!supplier) {
      return response.status(404).json({
        error: 'Supplier not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        supplier: {
          id: supplier._id,
          supplierCode: supplier.supplierCode,
          companyName: supplier.companyName,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isActive: supplier.isActive,
          detailSupplier: supplier.detailSupplier ? {
            id: supplier.detailSupplier._id,
            contactPerson: supplier.detailSupplier.contactPerson,
            paymentTerms: supplier.detailSupplier.paymentTerms,
            bankAccount: supplier.detailSupplier.bankAccount,
            taxCode: supplier.detailSupplier.taxCode,
            totalDebt: supplier.detailSupplier.totalDebt,
            rating: supplier.detailSupplier.rating,
            notes: supplier.detailSupplier.notes
          } : null,
          purchaseOrders: supplier.purchaseOrders ? supplier.purchaseOrders.map(po => ({
            id: po._id,
            poNumber: po.poNumber,
            orderDate: po.orderDate,
            status: po.status,
            totalPrice: po.totalPrice
          })) : [],
          createdAt: supplier.createdAt,
          updatedAt: supplier.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch supplier'
    })
  }
})

// GET /api/suppliers/code/:supplierCode - Get supplier by code
suppliersRouter.get('/code/:supplierCode', userExtractor, async (request, response) => {
  try {
    const supplier = await Supplier.findOne({ supplierCode: request.params.supplierCode })
      .populate('detailSupplier')

    if (!supplier) {
      return response.status(404).json({
        error: 'Supplier not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        supplier: {
          id: supplier._id,
          supplierCode: supplier.supplierCode,
          companyName: supplier.companyName,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isActive: supplier.isActive,
          detailSupplier: supplier.detailSupplier ? {
            contactPerson: supplier.detailSupplier.contactPerson,
            paymentTerms: supplier.detailSupplier.paymentTerms,
            totalDebt: supplier.detailSupplier.totalDebt,
            rating: supplier.detailSupplier.rating
          } : null,
          createdAt: supplier.createdAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch supplier'
    })
  }
})

// POST /api/suppliers - Create new supplier (Admin only)
suppliersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    companyName,
    email,
    phone,
    address
  } = request.body

  if (!companyName) {
    return response.status(400).json({
      error: 'Company name is required'
    })
  }

  if (!email) {
    return response.status(400).json({
      error: 'Email is required'
    })
  }

  if (!phone) {
    return response.status(400).json({
      error: 'Phone number is required'
    })
  }

  try {
    const supplier = new Supplier({
      companyName,
      email,
      phone,
      address
    })

    const savedSupplier = await supplier.save()

    response.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: {
        supplier: {
          id: savedSupplier._id,
          supplierCode: savedSupplier.supplierCode,
          companyName: savedSupplier.companyName,
          email: savedSupplier.email,
          phone: savedSupplier.phone,
          address: savedSupplier.address,
          isActive: savedSupplier.isActive,
          createdAt: savedSupplier.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return response.status(400).json({
        error: `${field === 'email' ? 'Email' : 'Supplier code'} already exists`
      })
    }
    response.status(500).json({
      error: 'Failed to create supplier'
    })
  }
})

// PUT /api/suppliers/:id - Update supplier (Admin only)
suppliersRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const {
    companyName,
    email,
    phone,
    address
  } = request.body

  try {
    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({
        error: 'Supplier not found'
      })
    }

    // Update fields
    if (companyName !== undefined) {
      if (!companyName.trim()) {
        return response.status(400).json({
          error: 'Company name cannot be empty'
        })
      }
      supplier.companyName = companyName
    }

    if (email !== undefined) {
      if (!email.trim()) {
        return response.status(400).json({
          error: 'Email cannot be empty'
        })
      }
      supplier.email = email
    }

    if (phone !== undefined) {
      if (!phone.trim()) {
        return response.status(400).json({
          error: 'Phone number cannot be empty'
        })
      }
      supplier.phone = phone
    }

    if (address !== undefined) {
      supplier.address = address
    }

    const updatedSupplier = await supplier.save()

    response.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: {
        supplier: {
          id: updatedSupplier._id,
          supplierCode: updatedSupplier.supplierCode,
          companyName: updatedSupplier.companyName,
          email: updatedSupplier.email,
          phone: updatedSupplier.phone,
          address: updatedSupplier.address,
          isActive: updatedSupplier.isActive,
          updatedAt: updatedSupplier.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Email already exists'
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update supplier'
    })
  }
})

// PATCH /api/suppliers/:id/profile - Update supplier profile (Admin only)
suppliersRouter.patch('/:id/profile', userExtractor, isAdmin, async (request, response) => {
  const updates = request.body

  const allowedUpdates = ['companyName', 'phone', 'address']
  const requestedUpdates = Object.keys(updates)
  const isValidOperation = requestedUpdates.every(update => allowedUpdates.includes(update))

  if (!isValidOperation) {
    return response.status(400).json({
      error: 'Invalid updates. Only companyName, phone, and address can be updated through this endpoint'
    })
  }

  try {
    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({
        error: 'Supplier not found'
      })
    }

    const updatedSupplier = await supplier.updateProfile(updates)

    response.status(200).json({
      success: true,
      message: 'Supplier profile updated successfully',
      data: {
        supplier: {
          id: updatedSupplier._id,
          supplierCode: updatedSupplier.supplierCode,
          companyName: updatedSupplier.companyName,
          phone: updatedSupplier.phone,
          address: updatedSupplier.address,
          updatedAt: updatedSupplier.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update supplier profile'
    })
  }
})

// PATCH /api/suppliers/:id/toggle - Toggle supplier active status (Admin only)
suppliersRouter.patch('/:id/toggle', userExtractor, isAdmin, async (request, response) => {
  try {
    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({
        error: 'Supplier not found'
      })
    }

    const updatedSupplier = supplier.isActive
      ? await supplier.deactivate()
      : await supplier.activate()

    response.status(200).json({
      success: true,
      message: `Supplier ${updatedSupplier.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        supplier: {
          id: updatedSupplier._id,
          supplierCode: updatedSupplier.supplierCode,
          companyName: updatedSupplier.companyName,
          isActive: updatedSupplier.isActive,
          updatedAt: updatedSupplier.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to toggle supplier status'
    })
  }
})

// PATCH /api/suppliers/:id/activate - Activate supplier (Admin only)
suppliersRouter.patch('/:id/activate', userExtractor, isAdmin, async (request, response) => {
  try {
    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({
        error: 'Supplier not found'
      })
    }

    const updatedSupplier = await supplier.activate()

    response.status(200).json({
      success: true,
      message: 'Supplier activated successfully',
      data: {
        supplier: {
          id: updatedSupplier._id,
          supplierCode: updatedSupplier.supplierCode,
          companyName: updatedSupplier.companyName,
          isActive: updatedSupplier.isActive,
          updatedAt: updatedSupplier.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to activate supplier'
    })
  }
})

// PATCH /api/suppliers/:id/deactivate - Deactivate supplier (Admin only)
suppliersRouter.patch('/:id/deactivate', userExtractor, isAdmin, async (request, response) => {
  try {
    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({
        error: 'Supplier not found'
      })
    }

    const updatedSupplier = await supplier.deactivate()

    response.status(200).json({
      success: true,
      message: 'Supplier deactivated successfully',
      data: {
        supplier: {
          id: updatedSupplier._id,
          supplierCode: updatedSupplier.supplierCode,
          companyName: updatedSupplier.companyName,
          isActive: updatedSupplier.isActive,
          updatedAt: updatedSupplier.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to deactivate supplier'
    })
  }
})

// DELETE /api/suppliers/:id - Delete supplier (Admin only)
suppliersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({
        error: 'Supplier not found'
      })
    }

    // Check if supplier has any purchase orders
    const purchaseOrderCount = await PurchaseOrder.countDocuments({ supplier: supplier._id })
    if (purchaseOrderCount > 0) {
      return response.status(400).json({
        error: 'Cannot delete supplier with existing purchase orders. Please deactivate instead.'
      })
    }

    // Delete associated detail supplier
    await DetailSupplier.findOneAndDelete({ supplier: supplier._id })

    await Supplier.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Supplier deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete supplier'
    })
  }
})

module.exports = suppliersRouter
