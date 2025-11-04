import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SortBy } from './SortBy';
// import { generateProductUrl } from '../../utils/productRouting';
// import productService from '../../services/productService';

export const ProductList = ({ filters = {}, onSortChange }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 12; // Fixed at 12 products per page
  const maxPagesToShow = 5; // Maximum number of page buttons to display
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    total_pages: 0,
    current_page: 1,
    per_page: 12
  });

  // Fetch products from API with filters
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build API params
        const params = {
          page: currentPage,
          per_page: perPage
        };

        // Add filters if present
        if (filters.categories && filters.categories.length > 0) {
          // Backend sẽ cần xử lý multiple categories
          // Tạm thời gửi category đầu tiên, hoặc có thể gửi comma-separated
          params.category = filters.categories[0]; // TODO: Backend support multiple
        }
        if (filters.minPrice !== null && filters.minPrice !== undefined) {
          params.min_price = filters.minPrice;
        }
        if (filters.maxPrice !== null && filters.maxPrice !== undefined) {
          params.max_price = filters.maxPrice;
        }
        if (filters.sortBy) {
          params.sort_by = filters.sortBy;
        }

        const result = await productService.getProducts(params);

        console.log('API Response:', result);
        console.log('Products:', result.data?.products);
        console.log('Filters applied:', params);

        if (result.success && result.data?.products) {
          const products = result.data.products;

          // Debug: Check product ID field
          console.log('First product:', products[0]);
          console.log('First product._id:', products[0]?._id);
          console.log('First product.id:', products[0]?.id);
          console.log('→ Backend uses "id" field (not "_id")!');

          setProducts(products);
          setPagination(result.data.pagination);
        } else {
          setError('No products available.');
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
        console.error('Error details:', err.response?.data);
        setError(err.response?.data?.error || 'Unable to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, perPage, filters]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle product click
  const handleProductClick = (product) => {
    console.log('Product clicked:', product);
    console.log('Product ID (id):', product.id);
    console.log('Product ID (_id):', product._id);
    console.log('Product Name:', product.name);

    // Backend uses "id" field (not "_id") due to toJSON transform
    const productId = product.id || product._id;
    const productUrl = generateProductUrl(productId, product.name);
    console.log('Generated URL:', productUrl);

    navigate(productUrl);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-semibold mb-2">Error Loading Products</p>
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SortBy
            value={filters.sortBy}
            onChange={onSortChange}
          />
        </div>
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Products Found</h3>
          <p className="text-gray-500 mb-4">There are no products available in the database.</p>
          <p className="text-sm text-gray-400">Add products to see them here.</p>
        </div>
      ) : (
        <>
          {/* Product Grid - 4 columns per row, matching Figma design */}
          <div className="grid grid-cols-4 gap-5">
            {products.map((product) => {
              const discount = productService.getDiscountPercent(product.price, product.originalPrice);
              // Backend uses "id" field (toJSON transform)
              const productId = product.id || product._id;
              const isHovered = hoveredProduct === productId;

              return (
                <div
                  key={productId}
                  className="bg-white border border-[#ececec] rounded-[15px] transition-all duration-300 hover:shadow-lg hover:border-emerald-500 cursor-pointer relative overflow-hidden"
                  onMouseEnter={() => setHoveredProduct(productId)}
                  onMouseLeave={() => setHoveredProduct(null)}
                  onClick={() => handleProductClick(product)}
                >
                  {/* Product Image Container */}
                  <div className="bg-white h-[206px] px-px pt-px overflow-hidden">
                    <div className="h-[181px] mx-[25px] mt-[25px] rounded-[15px] overflow-hidden flex items-center justify-center">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="max-w-full max-h-full object-contain transition-transform duration-300 hover:scale-110"
                        loading="lazy"
                      />
                    </div>

                    {/* Sale Badge - matching Figma design */}
                    {discount > 0 && (
                      <div className="absolute top-0 left-0 bg-[#67bcee] rounded-br-[20px] rounded-tl-[15px] w-[61.81px] h-[31px] flex items-center justify-center">
                        <span className="text-white text-[12px] font-bold font-['Lato',sans-serif]">
                          Sale
                        </span>
                      </div>
                    )}

                    {/* Discount Badge */}
                    {discount > 0 && (
                      <div className="absolute top-[35px] left-0 bg-[#f74b81] rounded-br-[20px] w-[85px] h-[26px] flex items-center justify-center">
                        <span className="text-white text-[12px] font-bold font-['Lato',sans-serif]">
                          -{discount}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-[20px] pt-[10px]">
                    {/* Category */}
                    <div className="text-[#adadad] text-[12px] font-['Lato',sans-serif] mb-[8px] leading-[24px]">
                      {product.category?.name || 'Uncategorized'}
                    </div>

                    {/* Title */}
                    <h3 className="text-[#253d4e] text-[16px] font-bold font-['Quicksand',sans-serif] leading-[24px] mb-[8px] line-clamp-2 min-h-[48px] flex items-center">
                      {product.name}
                    </h3>

                    {/* Rating */}
                    <div className="flex items-center gap-[7px] mb-[8px]">
                      <div className="flex gap-[2px]">
                        {[...Array(5)].map((_, index) => (
                          <svg
                            key={index}
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M6 0L7.34708 4.1534H11.7063L8.17963 6.69319L9.52671 10.8466L6 8.30681L2.47329 10.8466L3.82037 6.69319L0.293661 4.1534H4.65292L6 0Z"
                              fill={index < Math.floor(product.rating || 0) ? "#FDC040" : "#E0E0E0"}
                            />
                          </svg>
                        ))}
                      </div>
                      <span className="text-[#b6b6b6] text-[14px] font-['Lato',sans-serif]">
                        ({product.rating || 0})
                      </span>
                    </div>

                    {/* Vendor */}
                    <div className="text-[14px] font-['Lato',sans-serif] leading-[24px] mb-[20px]">
                      <span className="text-[#b6b6b6]">By </span>
                      <span className="text-[#3bb77e]">{product.vendor}</span>
                    </div>

                    {/* Price and Add Button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-[10px]">
                        <span className="text-[#3bb77e] text-[18px] font-bold font-['Quicksand',sans-serif] leading-[24px]">
                          ${(product.price || 0).toFixed(2)}
                        </span>
                        {product.originalPrice && (
                          <span className="text-[#adadad] text-[14px] font-bold font-['Quicksand',sans-serif] line-through leading-[24px]">
                            ${product.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Add to Cart Button - Figma design */}
                      <button
                        className={`transition-all duration-300 ${isHovered
                          ? 'bg-[#3bb77e] text-white shadow-lg'
                          : 'bg-[#def9ec] text-[#3bb77e]'
                          } rounded-[4px] w-[32px] h-[32px] flex items-center justify-center hover:scale-105`}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent product card click
                          console.log('Add to cart:', product.name);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="scale-y-[-100%]">
                          <path d="M15.5855 4.52445C15.4806 4.37056 15.3251 4.2572 15.1453 4.2029C14.9655 4.14859 14.7726 4.15598 14.597 4.22385L13.8033 4.51933L4.50048 2.47616C4.32892 2.42984 4.14717 2.44158 3.98286 2.50953C3.81855 2.57749 3.6809 2.69862 3.59048 2.85277L2.99976 4.05981L3.00048 4.95981H14.0008C14.2659 4.95981 14.5202 5.06517 14.7077 5.25271C14.8952 5.44024 15.0005 5.69457 15.0005 5.95981C15.0005 6.22504 14.8952 6.47937 14.7077 6.66691C14.5202 6.85444 14.2659 6.95981 14.0008 6.95981H3.51975L3.8128 8.00005H13.0005C13.2656 8.00005 13.5199 8.10541 13.7074 8.29295C13.8949 8.48048 14.0003 8.73481 14.0003 9.00005C14.0003 9.26528 13.8949 9.51961 13.7074 9.70715C13.5199 9.89468 13.2656 10.0001 13.0005 10.0001H4.22855L4.62855 11.4161C4.6737 11.5749 4.77314 11.7133 4.90798 11.8101C5.04283 11.9069 5.20567 11.9562 5.37119 11.9505L12.6328 11.9505C12.8979 11.9505 13.1522 12.0559 13.3397 12.2434C13.5272 12.4309 13.6326 12.6853 13.6326 12.9505C13.6326 13.2157 13.5272 13.4701 13.3397 13.6576C13.1522 13.8451 12.8979 13.9505 12.6328 13.9505L5.37119 13.9505C4.90414 13.9635 4.44887 13.8227 4.07759 13.5498C3.70631 13.2769 3.44071 12.887 3.32623 12.4401L1.37855 5.51933L0.597025 5.22292C0.421461 5.15505 0.286071 5.02271 0.22177 4.85841C0.157469 4.6941 0.169208 4.51235 0.254459 4.35777C0.33971 4.20318 0.490989 4.08675 0.674998 4.03244C0.859007 3.97813 1.05891 3.98552 1.23447 4.05339L2.22623 4.42581L2.59976 3.67933L3.37447 3.00133L12.6008 5.02677L13.0008 4.89005C13.1762 4.82178 13.3708 4.81419 13.5506 4.86843C13.7304 4.92268 13.8859 5.03619 13.9908 5.1902C14.0956 5.34421 14.1437 5.53061 14.1264 5.71667C14.1091 5.90274 14.0276 6.07747 13.8947 6.21005C13.7618 6.34263 13.5856 6.42528 13.3966 6.44261C13.2075 6.45994 13.0177 6.4109 12.8584 6.30197L15.5855 4.52445Z" fill="currentColor" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-center mt-8">
              <div className="flex items-center gap-2">
                {/* Previous button */}
                <button
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={!pagination.has_prev}
                  className={`px-3 py-2 rounded transition-colors ${!pagination.has_prev
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-[#3bb77e] hover:bg-[#def9ec]'
                    }`}
                >
                  ‹ Previous
                </button>

                {/* Page numbers */}
                {(() => {
                  const totalPages = pagination.total_pages;
                  const currentPage = pagination.current_page;

                  // Calculate start and end page numbers to display
                  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

                  // Adjust start if we're near the end
                  if (endPage - startPage < maxPagesToShow - 1) {
                    startPage = Math.max(1, endPage - maxPagesToShow + 1);
                  }

                  const pages = [];

                  // First page + ellipsis
                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => handlePageChange(1)}
                        className="px-3 py-2 rounded text-[#3bb77e] hover:bg-[#def9ec] transition-colors"
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(
                        <span key="ellipsis-start" className="px-2 text-gray-400">
                          ...
                        </span>
                      );
                    }
                  }

                  // Page numbers
                  for (let page = startPage; page <= endPage; page++) {
                    pages.push(
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 rounded transition-colors ${currentPage === page
                          ? 'bg-[#3bb77e] text-white'
                          : 'text-[#3bb77e] hover:bg-[#def9ec]'
                          }`}
                      >
                        {page}
                      </button>
                    );
                  }

                  // Ellipsis + last page
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(
                        <span key="ellipsis-end" className="px-2 text-gray-400">
                          ...
                        </span>
                      );
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => handlePageChange(totalPages)}
                        className="px-3 py-2 rounded text-[#3bb77e] hover:bg-[#def9ec] transition-colors"
                      >
                        {totalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}

                {/* Next button */}
                <button
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={!pagination.has_next}
                  className={`px-3 py-2 rounded transition-colors ${!pagination.has_next
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-[#3bb77e] hover:bg-[#def9ec]'
                    }`}
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};