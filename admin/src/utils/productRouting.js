// Helper functions for product routing

/**
 * Generate URL-friendly slug from product name
 * @param {string} name - Product name
 * @returns {string} - URL slug
 */
export const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim('-'); // Remove leading/trailing hyphens
};

/**
 * Generate product detail URL
 * @param {string|number} id - Product ID (MongoDB ObjectId or numeric)
 * @param {string} name - Product name
 * @returns {string} - Complete product detail URL
 */
export const generateProductUrl = (id, name) => {
  const slug = generateSlug(name);
  return `/products/${id}/${slug}`;
};

/**
 * Parse product ID from URL params
 * @param {object} params - React Router params
 * @returns {string} - Product ID (MongoDB ObjectId as string)
 */
export const getProductIdFromParams = (params) => {
  // Return as string to support MongoDB ObjectId
  return params.id;
};