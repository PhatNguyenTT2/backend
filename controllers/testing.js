const testingRouter = require('express').Router();

/**
 * Testing Controller
 * Helper endpoints for testing purposes only
 * Only available in test environment
 */

// Simple health check
testingRouter.get('/health', async (request, response) => {
  response.json({ success: true, message: 'Testing router is working' });
});

module.exports = testingRouter;
