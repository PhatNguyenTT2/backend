import React, { useState, useEffect } from 'react';
import { Heart, Share2 } from 'lucide-react';
import productService from '../../services/productService';

export const ProductInfo = ({ productId }) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedWeight, setSelectedWeight] = useState('60g');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch product from API
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;

      setLoading(true);
      setError(null);

      try {
        const result = await productService.getProductById(productId);
        if (result.success) {
          setProduct(result.data.product);
        }
      } catch (err) {
        console.error('Failed to fetch product:', err);
        setError('Unable to load product details.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white border border-[#ececec] rounded-[15px] p-8">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="mt-4 text-gray-600">Loading product...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !product) {
    return (
      <div className="bg-white border border-[#ececec] rounded-[15px] p-8">
        <div className="text-center py-12">
          <h2 className="text-[#7e7e7e] text-xl font-['Quicksand',sans-serif]">
            Product not found
          </h2>
          <p className="text-[#7e7e7e] text-base font-['Lato',sans-serif] mt-2">
            {error || 'The requested product could not be found.'}
          </p>
        </div>
      </div>
    );
  }

  const discount = productService.getDiscountPercent(product.price, product.originalPrice);

  // Product images - use product.images array if available, otherwise use main image
  const productImages = {
    main: product.image,
    thumbnails: product.images && product.images.length > 0
      ? product.images
      : [product.image, product.image, product.image, product.image]
  };

  const weights = ['50g', '60g', '80g', '100g', '150g'];

  const handleQuantityChange = (type) => {
    if (type === 'increase') {
      setQuantity(prev => prev + 1);
    } else if (type === 'decrease' && quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  return (
    <div className="bg-white border border-[#ececec] rounded-[15px] p-8">
      <div className="grid grid-cols-2 gap-8">
        {/* Left Column - Images */}
        <div className="space-y-6">
          {/* Main Image */}
          <div className="relative bg-white rounded-[16px] overflow-hidden border border-[#ececec] aspect-square flex items-center justify-center">
            {/* Sale Badge */}
            {discount > 0 && (
              <div className="absolute top-5 left-5 bg-[#f74b81] text-white text-sm font-bold px-3 py-1 rounded z-10">
                Sale Off
              </div>
            )}

            {/* Search Icon */}
            <button className="absolute top-5 right-5 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" stroke="#7E7E7E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 19L14.65 14.65" stroke="#7E7E7E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <img
              src={productImages.main}
              alt="Product"
              className="max-w-[80%] max-h-[80%] object-contain"
            />
          </div>

          {/* Thumbnail Images */}
          <div className="flex gap-5">
            {productImages.thumbnails.map((thumb, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`w-[118px] h-[118px] rounded-[17px] overflow-hidden border-2 transition-all ${selectedImage === index
                  ? 'border-[#a2d2c9]'
                  : 'border-transparent hover:border-gray-300'
                  }`}
              >
                <img
                  src={thumb}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right Column - Product Info */}
        <div className="space-y-6">
          {/* Title */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              {discount > 0 && (
                <span className="bg-[#f74b81] text-white text-xs font-bold px-2 py-1 rounded">
                  Sale Off
                </span>
              )}
            </div>
            <h1 className="text-[#253d4e] text-[40px] font-bold font-['Quicksand',sans-serif] leading-tight mb-3">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[...Array(5)].map((_, index) => (
                  <svg key={index} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 0L9.79611 5.52786H15.6085L10.9062 8.94427L12.7023 14.4721L8 11.0557L3.29772 14.4721L5.09383 8.94427L0.391548 5.52786H6.20389L8 0Z" fill={index < Math.floor(product.rating || 0) ? "#FDC040" : "#E0E0E0"} />
                  </svg>
                ))}
              </div>
              <span className="text-[#adadad] text-sm font-['Lato',sans-serif]">({product.reviewCount || 0} reviews)</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-4">
            <span className="text-[#3bb77e] text-[40px] font-bold font-['Quicksand',sans-serif]">
              ${(product.price || 0).toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-[#adadad] text-[24px] font-bold font-['Quicksand',sans-serif] line-through">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
            {discount > 0 && (
              <span className="bg-[#ffeaea] text-[#f74b81] text-sm font-bold px-3 py-1 rounded">
                {discount}% Off
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-[#7e7e7e] text-base font-['Lato',sans-serif] leading-relaxed">
            {product.description}
          </p>          {/* Size / Weight */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[#7e7e7e] text-sm font-['Lato',sans-serif] font-semibold">
                Size / Weight:
              </span>
              <div className="flex gap-2">
                {weights.map((weight) => (
                  <button
                    key={weight}
                    onClick={() => setSelectedWeight(weight)}
                    className={`px-4 py-2 rounded text-sm font-['Lato',sans-serif] font-semibold transition-all ${selectedWeight === weight
                      ? 'bg-[#3bb77e] text-white'
                      : 'bg-[#f2f3f4] text-[#7e7e7e] hover:bg-[#e8e9ea]'
                      }`}
                  >
                    {weight}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quantity and Actions */}
          <div className="flex items-center gap-4">
            {/* Quantity Selector */}
            <div className="flex items-center border-2 border-[#ececec] rounded-[5px] overflow-hidden">
              <button
                onClick={() => handleQuantityChange('decrease')}
                className="w-12 h-12 flex items-center justify-center text-[#7e7e7e] hover:bg-gray-50 transition-colors text-xl font-bold"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-12 text-center border-x-2 border-[#ececec] text-[#253d4e] font-bold outline-none"
              />
              <button
                onClick={() => handleQuantityChange('increase')}
                className="w-12 h-12 flex items-center justify-center text-[#7e7e7e] hover:bg-gray-50 transition-colors text-xl font-bold"
              >
                +
              </button>
            </div>

            {/* Add to Cart Button */}
            <button className="bg-[#3bb77e] hover:bg-[#2da56a] text-white px-8 h-[50px] rounded-[5px] flex items-center gap-3 transition-colors font-['Quicksand',sans-serif] font-bold text-base tracking-wide">
              <img
                src="https://www.figma.com/api/mcp/asset/ca0b62af-1e7e-4d79-af66-454918c8fbb0"
                alt="cart"
                className="w-4 h-4 scale-y-[-100%] brightness-0 invert"
              />
              Add to cart
            </button>

            {/* Wishlist Button */}
            <button className="w-[50px] h-[50px] border-2 border-[#ececec] rounded-[5px] flex items-center justify-center hover:border-[#3bb77e] hover:bg-[#f2fef9] transition-all group">
              <Heart className="w-5 h-5 text-[#7e7e7e] group-hover:text-[#3bb77e] transition-colors" />
            </button>

            {/* Share Button */}
            <button className="w-[50px] h-[50px] border-2 border-[#ececec] rounded-[5px] flex items-center justify-center hover:border-[#3bb77e] hover:bg-[#f2fef9] transition-all group">
              <Share2 className="w-5 h-5 text-[#7e7e7e] group-hover:text-[#3bb77e] transition-colors" />
            </button>
          </div>

          {/* Product Meta */}
          <div className="space-y-2 pt-4 border-t border-[#ececec]">
            {product.type && (
              <div className="flex items-center gap-2">
                <span className="text-[#7e7e7e] text-sm font-['Lato',sans-serif] min-w-[80px]">Type:</span>
                <span className="text-[#3bb77e] text-sm font-['Lato',sans-serif] font-semibold">{product.type}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[#7e7e7e] text-sm font-['Lato',sans-serif] min-w-[80px]">SKU:</span>
              <span className="text-[#253d4e] text-sm font-['Lato',sans-serif]">{product.sku}</span>
            </div>
            {product.mfgDate && (
              <div className="flex items-center gap-2">
                <span className="text-[#7e7e7e] text-sm font-['Lato',sans-serif] min-w-[80px]">MFG:</span>
                <span className="text-[#253d4e] text-sm font-['Lato',sans-serif]">
                  {new Date(product.mfgDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[#7e7e7e] text-sm font-['Lato',sans-serif] min-w-[80px]">Tags:</span>
                <div className="flex gap-2">
                  {product.tags.map((tag, index) => (
                    <span key={index} className="text-[#7e7e7e] text-sm font-['Lato',sans-serif]">
                      {tag}{index < product.tags.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {product.shelfLife && (
              <div className="flex items-center gap-2">
                <span className="text-[#7e7e7e] text-sm font-['Lato',sans-serif] min-w-[80px]">LIFE:</span>
                <span className="text-[#253d4e] text-sm font-['Lato',sans-serif]">{product.shelfLife}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[#7e7e7e] text-sm font-['Lato',sans-serif] min-w-[80px]">Stock:</span>
              <span className={`text-sm font-['Lato',sans-serif] font-semibold ${product.stock > 0 ? 'text-[#3bb77e]' : 'text-red-600'
                }`}>
                {product.stock > 0 ? `${product.stock} Items In Stock` : 'Out of Stock'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
