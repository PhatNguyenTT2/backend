const suppliersRouter = require('express').Router()
const Supplier = require('../models/supplier')
const Product = require('../models/product')
const { userExtractor } = require('../utils/auth')

// GET /api/suppliers - Get all suppliers with filtering, sorting, and pagination
suppliersRouter.get('/', async (request, response) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      paymentTerms,
      isActive,
      search
    } = request.query

    // Build filter object
    const filter = {}

    if (paymentTerms) {
      filter.paymentTerms = paymentTerms
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true'
    }

    // Search by company name, email, phone, or supplier code
    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { supplierCode: { $regex: search, $options: 'i' } }
      ]
    }

    const pageNum = parseInt(page)
    const perPage = parseInt(limit)
    const skip = (pageNum - 1) * perPage

    const suppliers = await Supplier
      .find(filter)
      .sort(sort)
      .limit(perPage)
      .skip(skip)
      .populate('productsSupplied', 'name sku')

    const total = await Supplier.countDocuments(filter)
    const totalPages = Math.ceil(total / perPage)

    response.json({
      success: true,
      data: {
        suppliers,
        pagination: {
          current_page: pageNum,
          per_page: perPage,
          total,
          total_pages: totalPages,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1
        }
      }
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/suppliers/stats - Get supplier statistics
suppliersRouter.get('/stats', async (request, response) => {
  try {
    const totalSuppliers = await Supplier.countDocuments()
    const activeSuppliers = await Supplier.countDocuments({ isActive: true })

    // Top suppliers by purchase amount
    const topSuppliers = await Supplier
      .find()
      .sort('-totalPurchaseAmount')
      .limit(10)
      .select('supplierCode companyName totalPurchaseAmount totalPurchaseOrders rating')

    // Suppliers with high debt
    const highDebtSuppliers = await Supplier
      .find({ currentDebt: { $gt: 0 } })
      .sort('-currentDebt')
      .limit(10)
      .select('supplierCode companyName currentDebt creditLimit')

    response.json({
      totalSuppliers,
      activeSuppliers,
      topSuppliers,
      highDebtSuppliers
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/suppliers/:id - Get supplier by ID
suppliersRouter.get('/:id', async (request, response) => {
  try {
    const supplier = await Supplier
      .findById(request.params.id)
      .populate('productsSupplied', 'name sku price')

    if (!supplier) {
      return response.status(404).json({ error: 'Supplier not found' })
    }

    response.json(supplier)
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// GET /api/suppliers/:id/products - Get supplier products
suppliersRouter.get('/:id/products', async (request, response) => {
  try {
    const { page = 1, limit = 10 } = request.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({ error: 'Supplier not found' })
    }

    const products = await Product
      .find({ _id: { $in: supplier.productsSupplied } })
      .limit(parseInt(limit))
      .skip(skip)

    const total = supplier.productsSupplied.length

    response.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

// POST /api/suppliers - Create new supplier
suppliersRouter.post('/', userExtractor, async (request, response) => {
  try {
    const {
      supplierCode,
      companyName,
      contactPerson,
      email,
      phone,
      address,
      taxId,
      bankAccount,
      paymentTerms,
      creditLimit,
      notes
    } = request.body

    // Validate required fields
    if (!companyName || !email || !phone) {
      return response.status(400).json({
        error: 'Company name, email, and phone are required'
      })
    }

    // Check if email already exists
    const existingSupplier = await Supplier.findOne({ email })
    if (existingSupplier) {
      return response.status(400).json({
        error: 'Email already exists'
      })
    }

    // Check if taxId already exists
    if (taxId) {
      const existingTaxId = await Supplier.findOne({ taxId })
      if (existingTaxId) {
        return response.status(400).json({
          error: 'Tax ID already exists'
        })
      }
    }

    // Check if supplierCode is provided and already exists
    if (supplierCode) {
      const existingCode = await Supplier.findOne({ supplierCode })
      if (existingCode) {
        return response.status(400).json({
          error: 'Supplier code already exists'
        })
      }
    }

    const supplier = new Supplier({
      supplierCode,
      companyName,
      contactPerson,
      email,
      phone,
      address,
      taxId,
      bankAccount,
      paymentTerms,
      creditLimit,
      notes
    })

    const savedSupplier = await supplier.save()
    response.status(201).json(savedSupplier)
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/suppliers/:id - Update supplier
suppliersRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      phone,
      address,
      taxId,
      bankAccount,
      paymentTerms,
      creditLimit,
      notes,
      isActive
    } = request.body

    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({ error: 'Supplier not found' })
    }

    // Check if email is being changed and if it already exists
    if (email && email !== supplier.email) {
      const existingSupplier = await Supplier.findOne({ email })
      if (existingSupplier) {
        return response.status(400).json({
          error: 'Email already exists'
        })
      }
    }

    // Check if taxId is being changed and if it already exists
    if (taxId && taxId !== supplier.taxId) {
      const existingTaxId = await Supplier.findOne({ taxId })
      if (existingTaxId) {
        return response.status(400).json({
          error: 'Tax ID already exists'
        })
      }
    }

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      request.params.id,
      {
        companyName,
        contactPerson,
        email,
        phone,
        address,
        taxId,
        bankAccount,
        paymentTerms,
        creditLimit,
        notes,
        isActive
      },
      { new: true, runValidators: true }
    )

    response.json(updatedSupplier)
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/suppliers/:id/rating - Update supplier rating
suppliersRouter.put('/:id/rating', userExtractor, async (request, response) => {
  try {
    const { rating } = request.body

    if (rating === undefined || rating < 0 || rating > 5) {
      return response.status(400).json({
        error: 'Rating must be between 0 and 5'
      })
    }

    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({ error: 'Supplier not found' })
    }

    await supplier.updateRating(rating)

    response.json({
      message: 'Rating updated successfully',
      rating: supplier.rating
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/suppliers/:id/debt/add - Add debt
suppliersRouter.put('/:id/debt/add', userExtractor, async (request, response) => {
  try {
    const { amount } = request.body

    if (!amount || amount <= 0) {
      return response.status(400).json({
        error: 'Amount must be a positive number'
      })
    }

    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({ error: 'Supplier not found' })
    }

    await supplier.addDebt(amount)

    response.json({
      message: 'Debt added successfully',
      currentDebt: supplier.currentDebt
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/suppliers/:id/debt/pay - Pay debt
suppliersRouter.put('/:id/debt/pay', userExtractor, async (request, response) => {
  try {
    const { amount } = request.body

    if (!amount || amount <= 0) {
      return response.status(400).json({
        error: 'Amount must be a positive number'
      })
    }

    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({ error: 'Supplier not found' })
    }

    await supplier.payDebt(amount)

    response.json({
      message: 'Debt paid successfully',
      currentDebt: supplier.currentDebt
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// PUT /api/suppliers/:id/products/add - Add product to supplier
suppliersRouter.put('/:id/products/add', userExtractor, async (request, response) => {
  try {
    const { productId } = request.body

    if (!productId) {
      return response.status(400).json({
        error: 'Product ID is required'
      })
    }

    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({ error: 'Supplier not found' })
    }

    const product = await Product.findById(productId)

    if (!product) {
      return response.status(404).json({ error: 'Product not found' })
    }

    if (!supplier.productsSupplied.includes(productId)) {
      supplier.productsSupplied.push(productId)
      await supplier.save()
    }

    response.json({
      message: 'Product added to supplier successfully',
      productsSupplied: supplier.productsSupplied
    })
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

// DELETE /api/suppliers/:id - Delete supplier (soft delete by default)
suppliersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    const { permanent = false } = request.query

    const supplier = await Supplier.findById(request.params.id)

    if (!supplier) {
      return response.status(404).json({ error: 'Supplier not found' })
    }

    if (permanent === 'true') {
      // Permanent delete
      await Supplier.findByIdAndDelete(request.params.id)
      response.json({ message: 'Supplier deleted permanently' })
    } else {
      // Soft delete
      supplier.isActive = false
      await supplier.save()
      response.json({ message: 'Supplier deactivated successfully' })
    }
  } catch (error) {
    response.status(500).json({ error: error.message })
  }
})

module.exports = suppliersRouter
