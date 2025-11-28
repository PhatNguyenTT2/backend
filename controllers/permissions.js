const express = require('express')
const router = express.Router()
const { PERMISSIONS, ALL_PERMISSIONS, PERMISSION_LABELS } = require('../utils/constants')

// GET /api/permissions - Get all available permissions
router.get('/', async (request, response) => {
  try {
    response.status(200).json({
      success: true,
      data: {
        permissions: ALL_PERMISSIONS,
        labels: PERMISSION_LABELS,
        constants: PERMISSIONS
      }
    })
  } catch (error) {
    console.error('Error fetching permissions:', error)
    response.status(500).json({
      success: false,
      error: 'Failed to fetch permissions',
      details: error.message
    })
  }
})

module.exports = router
