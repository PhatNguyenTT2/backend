const categoriesRouter = require('express').Router()
const Category = require('../models/category')
const Product = require('../models/product')
const { userExtractor, isAdmin } = require('../utils/auth')

// GET /api/categories - Get all categories
categoriesRouter.get('/', async (request, response) => {
  try {
    const { include_inactive } = request.query

    // For admin panel: include inactive categories when requested
    const filter = {}
    if (include_inactive !== 'true') {
      filter.isActive = true
    }

    const categories = await Category.find(filter)
      .sort({ name: 1 })

    // Manually count products for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category._id,
          isActive: true
        })

        return {
          id: category._id,
          categoryCode: category.categoryCode,
          name: category.name,
          image: category.image,
          description: category.description,
          isActive: category.isActive,
          productCount,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        }
      })
    )

    response.status(200).json({
      success: true,
      data: {
        categories: categoriesWithCount
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch categories'
    })
  }
})

// GET /api/categories/stats/overview - Get category statistics (Admin only)
categoriesRouter.get('/stats/overview', userExtractor, isAdmin, async (request, response) => {
  try {
    const stats = await Category.getStatistics()

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

// GET /api/categories/code/:code - Get category by code
categoriesRouter.get('/code/:code', async (request, response) => {
  try {
    const category = await Category.findOne({
      categoryCode: request.params.code.toUpperCase()
    })

    if (!category) {
      return response.status(404).json({
        error: 'Category not found'
      })
    }

    // Get product count
    const productCount = await Product.countDocuments({
      category: category._id,
      isActive: true
    })

    response.status(200).json({
      success: true,
      data: {
        category: {
          id: category._id,
          categoryCode: category.categoryCode,
          name: category.name,
          image: category.image,
          description: category.description,
          isActive: category.isActive,
          productCount,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        }
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to fetch category'
    })
  }
})

// GET /api/categories/:id - Get single category
categoriesRouter.get('/:id', async (request, response) => {
  try {
    const category = await Category.findById(request.params.id)

    if (!category) {
      return response.status(404).json({
        error: 'Category not found'
      })
    }

    // Get product count
    const productCount = await Product.countDocuments({
      category: category._id,
      isActive: true
    })

    response.status(200).json({
      success: true,
      data: {
        category: {
          id: category._id,
          categoryCode: category.categoryCode,
          name: category.name,
          image: category.image,
          description: category.description,
          isActive: category.isActive,
          productCount,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid category ID'
      })
    }
    response.status(500).json({
      error: 'Failed to fetch category'
    })
  }
})

// POST /api/categories - Create new category (Admin only)
categoriesRouter.post('/', userExtractor, isAdmin, async (request, response) => {
  const { name, image, description } = request.body

  if (!name) {
    return response.status(400).json({
      error: 'Category name is required'
    })
  }

  try {
    const category = new Category({
      name,
      image,
      description,
      isActive: true
    })

    const savedCategory = await category.save()

    response.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        category: {
          id: savedCategory._id,
          categoryCode: savedCategory.categoryCode,
          name: savedCategory.name,
          image: savedCategory.image,
          description: savedCategory.description,
          isActive: savedCategory.isActive,
          createdAt: savedCategory.createdAt
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
        error: 'Category name already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to create category'
    })
  }
})

// PUT /api/categories/:id - Update category (Admin only)
categoriesRouter.put('/:id', userExtractor, isAdmin, async (request, response) => {
  const { name, image, description } = request.body

  try {
    const category = await Category.findById(request.params.id)

    if (!category) {
      return response.status(404).json({
        error: 'Category not found'
      })
    }

    // Use the updateCategory method from the model
    const updatedCategory = await category.updateCategory({
      name,
      image,
      description
    })

    response.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: {
        category: {
          id: updatedCategory._id,
          categoryCode: updatedCategory.categoryCode,
          name: updatedCategory.name,
          image: updatedCategory.image,
          description: updatedCategory.description,
          isActive: updatedCategory.isActive,
          updatedAt: updatedCategory.updatedAt
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
        error: 'Invalid category ID'
      })
    }
    if (error.code === 11000) {
      return response.status(400).json({
        error: 'Category name already exists'
      })
    }
    response.status(500).json({
      error: 'Failed to update category'
    })
  }
})

// PATCH /api/categories/:id/toggle - Toggle category active status (Admin only)
categoriesRouter.patch('/:id/toggle', userExtractor, isAdmin, async (request, response) => {
  try {
    const category = await Category.findById(request.params.id)

    if (!category) {
      return response.status(404).json({
        error: 'Category not found'
      })
    }

    // If trying to deactivate, check if category has active products
    if (category.isActive) {
      const activeProductCount = await Product.countDocuments({
        category: category._id,
        isActive: true
      })

      if (activeProductCount > 0) {
        return response.status(400).json({
          error: `Cannot deactivate category with ${activeProductCount} active product(s). Please deactivate all products first.`
        })
      }
    }

    // Use the toggleActive method from the model
    const updatedCategory = await category.toggleActive()

    response.status(200).json({
      success: true,
      message: `Category ${updatedCategory.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        category: {
          id: updatedCategory._id,
          categoryCode: updatedCategory.categoryCode,
          name: updatedCategory.name,
          isActive: updatedCategory.isActive,
          updatedAt: updatedCategory.updatedAt
        }
      }
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid category ID'
      })
    }
    response.status(500).json({
      error: 'Failed to toggle category status'
    })
  }
})

// DELETE /api/categories/:id - Delete category (Admin only)
categoriesRouter.delete('/:id', userExtractor, isAdmin, async (request, response) => {
  try {
    const category = await Category.findById(request.params.id)

    if (!category) {
      return response.status(404).json({
        error: 'Category not found'
      })
    }

    // Check if category is still active
    if (category.isActive !== false) {
      return response.status(400).json({
        error: 'Cannot delete active category. Please deactivate it first.'
      })
    }

    // Check if category has ANY products (active or inactive)
    const productCount = await Product.countDocuments({
      category: request.params.id
    })

    if (productCount > 0) {
      return response.status(400).json({
        error: `Cannot delete category with ${productCount} product(s). Please reassign or delete all products first.`
      })
    }

    await Category.findByIdAndDelete(request.params.id)

    response.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({
        error: 'Invalid category ID'
      })
    }
    response.status(500).json({
      error: 'Failed to delete category'
    })
  }
})

module.exports = categoriesRouter
