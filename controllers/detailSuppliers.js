const detailSuppliersRouter = require('express').Router()
const DetailSupplier = require('../models/detailSupplier')
const Supplier = require('../models/supplier')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/detail-suppliers - Get all detail suppliers
detailSuppliersRouter.get('/', userExtractor, isAdmin, async (request, response) => {
  try {
    const { supplier_id, payment_terms, has_debt } = request.query

    // Build filter
    const filter = {}
    if (supplier_id) {
      filter.supplier = supplier_id
    }
    if (payment_terms) {
      filter.paymentTerms = payment_terms
    }
    if (has_debt === 'true') {
      filter.currentDebt = { $gt: 0 }
    }

    const detailSuppliers = await DetailSupplier.find(filter)
      .sort({ createdAt: -1 })

    const detailsData = detailSuppliers.map(detail => ({
      id: detail._id,
      supplierId: detail.supplier,
      bankName: detail.bankName,
      accountNumber: detail.accountNumber,
      bankAccountInfo: detail.bankAccountInfo,
      paymentTerms: detail.paymentTerms,
      creditLimit: detail.creditLimit,
      currentDebt: detail.currentDebt,
      availableCredit: detail.availableCredit,
      notes: detail.notes,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    }))

    response.status(200).json({
      success: true,
      data: {
        detailSuppliers: detailsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch detail suppliers'
    })
  }
})

// GET /api/detail-suppliers/with-debt - Get suppliers with debt
detailSuppliersRouter.get('/with-debt', userExtractor, isAdmin, async (request, response) => {
  try {
    const suppliersWithDebt = await DetailSupplier.findSuppliersWithDebt()

    // Filter out null suppliers (inactive or deleted)
    const validSuppliers = suppliersWithDebt.filter(detail => detail.supplier !== null)

    const detailsData = validSuppliers.map(detail => ({
      id: detail._id,
      supplierId: detail.supplier?._id || detail.supplier,
      currentDebt: detail.currentDebt,
      creditLimit: detail.creditLimit,
      availableCredit: detail.availableCredit,
      paymentTerms: detail.paymentTerms
    }))

    response.status(200).json({
      success: true,
      data: {
        suppliersWithDebt: detailsData
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch suppliers with debt'
    })
  }
})

// GET /api/detail-suppliers/stats/debt - Get debt statistics
detailSuppliersRouter.get('/stats/debt', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await DetailSupplier.getDebtStatistics()

    response.status(200).json({
      success: true,
      data: {
        statistics: stats
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch debt statistics'
    })
  }
})

// GET /api/detail-suppliers/:id - Get single detail supplier
detailSuppliersRouter.get('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const detail = await DetailSupplier.getWithSupplier(request.params.id)

    if (!detail) {
      return response.status(404).json({
        error: 'Detail supplier not found'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        detailSupplier: {
          id: detail._id,
          supplierId: detail.supplier?._id || detail.supplier,
          bankName: detail.bankName,
          accountNumber: detail.accountNumber,
          bankAccountInfo: detail.bankAccountInfo,
          paymentTerms: detail.paymentTerms,
          creditLimit: detail.creditLimit,
          currentDebt: detail.currentDebt,
          availableCredit: detail.availableCredit,
          notes: detail.notes,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch detail supplier'
    })
  }
})

// GET /api/detail-suppliers/supplier/:supplierId - Get detail by supplier ID
detailSuppliersRouter.get('/supplier/:supplierId', userExtractor, isAdmin, async (request, response) => {
  try {
    const detail = await DetailSupplier.findOne({ supplier: request.params.supplierId })

    if (!detail) {
      return response.status(404).json({
        error: 'Detail supplier not found for this supplier'
      })
    }

    response.status(200).json({
      success: true,
      data: {
        detailSupplier: {
          id: detail._id,
          supplierId: detail.supplier,
          bankName: detail.bankName,
          accountNumber: detail.accountNumber,
          bankAccountInfo: detail.bankAccountInfo,
          paymentTerms: detail.paymentTerms,
          creditLimit: detail.creditLimit,
          currentDebt: detail.currentDebt,
          availableCredit: detail.availableCredit,
          notes: detail.notes,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt
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
      error: 'Failed to fetch detail supplier'
    })
  }
})

// POST /api/detail-suppliers - Create new detail supplier (Admin only)
detailSuppliersRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const {
    supplierId,
    bankName,
    accountNumber,
    paymentTerms,
    creditLimit,
    notes
  } = request.body

  if (!supplierId) {
    return response.status(400).json({
      error: 'Supplier ID is required'
    })
  }

  try {
    // Verify supplier exists
    const supplier = await Supplier.findById(supplierId)
    if (!supplier) {
      return response.status(400).json({
        error: 'Supplier not found'
      })
    }

    // Use createForSupplier method with transaction
    const detail = await DetailSupplier.createForSupplier(supplierId, {
      bankName,
      accountNumber,
      paymentTerms: paymentTerms || 'net30',
      creditLimit: creditLimit || 0,
      notes
    })

    response.status(201).json({
      success: true,
      message: 'Detail supplier created successfully',
      data: {
        detailSupplier: {
          id: detail._id,
          supplierId: detail.supplier,
          bankName: detail.bankName,
          accountNumber: detail.accountNumber,
          paymentTerms: detail.paymentTerms,
          creditLimit: detail.creditLimit,
          currentDebt: detail.currentDebt,
          availableCredit: detail.availableCredit,
          notes: detail.notes,
          createdAt: detail.createdAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.message === 'Supplier not found' || error.message === 'Detail supplier already exists for this supplier') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Detail supplier already exists for this supplier'
      })
    }
    response.status(500).json({
      error: 'Failed to create detail supplier'
    })
  }
})

// PUT /api/detail-suppliers/:id - Update detail supplier (Admin only)
detailSuppliersRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const {
    bankName,
    accountNumber,
    paymentTerms,
    creditLimit,
    notes
  } = request.body

  try {
    const detail = await DetailSupplier.findById(request.params.id)

    if (!detail) {
      return response.status(404).json({
        error: 'Detail supplier not found'
      })
    }

    // Update fields
    if (bankName !== undefined) detail.bankName = bankName
    if (accountNumber !== undefined) detail.accountNumber = accountNumber
    if (paymentTerms !== undefined) {
      const validTerms = ['cod', 'net15', 'net30', 'net60', 'net90']
      if (!validTerms.includes(paymentTerms)) {
        return response.status(400).json({
          error: 'Invalid payment terms. Must be one of: cod, net15, net30, net60, net90'
        })
      }
      detail.paymentTerms = paymentTerms
    }
    if (creditLimit !== undefined) {
      if (creditLimit < 0) {
        return response.status(400).json({
          error: 'Credit limit cannot be negative'
        })
      }
      if (creditLimit < detail.currentDebt) {
        return response.status(400).json({
          error: 'New credit limit cannot be less than current debt'
        })
      }
      detail.creditLimit = creditLimit
    }
    if (notes !== undefined) detail.notes = notes

    const updatedDetail = await detail.save()

    response.status(200).json({
      success: true,
      message: 'Detail supplier updated successfully',
      data: {
        detailSupplier: {
          id: updatedDetail._id,
          bankName: updatedDetail.bankName,
          accountNumber: updatedDetail.accountNumber,
          paymentTerms: updatedDetail.paymentTerms,
          creditLimit: updatedDetail.creditLimit,
          currentDebt: updatedDetail.currentDebt,
          availableCredit: updatedDetail.availableCredit,
          notes: updatedDetail.notes,
          updatedAt: updatedDetail.updatedAt
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
        error: 'Invalid detail supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update detail supplier'
    })
  }
})

// PATCH /api/detail-suppliers/:id/financial - Update financial details (Admin only)
detailSuppliersRouter.patch('/:id/financial', userExtractor, isAdmin, async (request, response) => {
  const updates = request.body

  const allowedUpdates = ['bankName', 'accountNumber', 'paymentTerms', 'notes']
  const requestedUpdates = Object.keys(updates)
  const isValidOperation = requestedUpdates.every(update => allowedUpdates.includes(update))

  if (!isValidOperation) {
    return response.status(400).json({
      error: 'Invalid updates. Only bankName, accountNumber, paymentTerms, and notes can be updated through this endpoint'
    })
  }

  try {
    const detail = await DetailSupplier.findById(request.params.id)

    if (!detail) {
      return response.status(404).json({
        error: 'Detail supplier not found'
      })
    }

    const updatedDetail = await detail.updateFinancialDetails(updates)

    response.status(200).json({
      success: true,
      message: 'Financial details updated successfully',
      data: {
        detailSupplier: {
          id: updatedDetail._id,
          bankName: updatedDetail.bankName,
          accountNumber: updatedDetail.accountNumber,
          bankAccountInfo: updatedDetail.bankAccountInfo,
          paymentTerms: updatedDetail.paymentTerms,
          notes: updatedDetail.notes,
          updatedAt: updatedDetail.updatedAt
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
        error: 'Invalid detail supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update financial details'
    })
  }
})

// PATCH /api/detail-suppliers/:id/add-debt - Add debt (Admin only)
detailSuppliersRouter.patch('/:id/add-debt', userExtractor, isAdmin, async (request, response) => {
  const { amount } = request.body

  if (!amount || amount <= 0) {
    return response.status(400).json({
      error: 'Valid debt amount (greater than 0) is required'
    })
  }

  try {
    const detail = await DetailSupplier.findById(request.params.id)

    if (!detail) {
      return response.status(404).json({
        error: 'Detail supplier not found'
      })
    }

    const updatedDetail = await detail.addDebt(amount)

    response.status(200).json({
      success: true,
      message: 'Debt added successfully',
      data: {
        detailSupplier: {
          id: updatedDetail._id,
          supplierId: updatedDetail.supplier,
          currentDebt: updatedDetail.currentDebt,
          creditLimit: updatedDetail.creditLimit,
          availableCredit: updatedDetail.availableCredit,
          updatedAt: updatedDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Debt amount must be positive' || error.message.includes('Credit limit exceeded')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to add debt'
    })
  }
})

// PATCH /api/detail-suppliers/:id/pay-debt - Pay debt (Admin only)
detailSuppliersRouter.patch('/:id/pay-debt', userExtractor, isAdmin, async (request, response) => {
  const { amount } = request.body

  if (!amount || amount <= 0) {
    return response.status(400).json({
      error: 'Valid payment amount (greater than 0) is required'
    })
  }

  try {
    const detail = await DetailSupplier.findById(request.params.id)

    if (!detail) {
      return response.status(404).json({
        error: 'Detail supplier not found'
      })
    }

    const updatedDetail = await detail.payDebt(amount)

    response.status(200).json({
      success: true,
      message: 'Debt payment recorded successfully',
      data: {
        detailSupplier: {
          id: updatedDetail._id,
          supplierId: updatedDetail.supplier,
          currentDebt: updatedDetail.currentDebt,
          creditLimit: updatedDetail.creditLimit,
          availableCredit: updatedDetail.availableCredit,
          updatedAt: updatedDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Payment amount must be positive' || error.message.includes('exceeds current debt')) {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to pay debt'
    })
  }
})

// PATCH /api/detail-suppliers/:id/credit-limit - Update credit limit (Admin only)
detailSuppliersRouter.patch('/:id/credit-limit', userExtractor, isAdmin, async (request, response) => {
  const { creditLimit } = request.body

  if (creditLimit === undefined || creditLimit < 0) {
    return response.status(400).json({
      error: 'Valid credit limit (non-negative) is required'
    })
  }

  try {
    const detail = await DetailSupplier.findById(request.params.id)

    if (!detail) {
      return response.status(404).json({
        error: 'Detail supplier not found'
      })
    }

    const updatedDetail = await detail.updateCreditLimit(creditLimit)

    response.status(200).json({
      success: true,
      message: 'Credit limit updated successfully',
      data: {
        detailSupplier: {
          id: updatedDetail._id,
          creditLimit: updatedDetail.creditLimit,
          currentDebt: updatedDetail.currentDebt,
          availableCredit: updatedDetail.availableCredit,
          updatedAt: updatedDetail.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.message === 'Credit limit cannot be negative' || error.message === 'New credit limit cannot be less than current debt') {
      return response.status(400).json({
        error: error.message
      })
    }
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to update credit limit'
    })
  }
})

// DELETE /api/detail-suppliers/:id - Delete detail supplier (Admin only)
detailSuppliersRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const detail = await DetailSupplier.findById(request.params.id)

    if (!detail) {
      return response.status(404).json({
        error: 'Detail supplier not found'
      })
    }

    // Check if there's any outstanding debt
    if (detail.currentDebt > 0) {
      return response.status(400).json({
        error: 'Cannot delete detail supplier with outstanding debt. Please clear the debt first.'
      })
    }

    await DetailSupplier.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Detail supplier deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid detail supplier ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete detail supplier'
    })
  }
})

module.exports = detailSuppliersRouter
