import React, { useState, useEffect } from 'react';
// import productService from '../../services/productService';

export const ProductDetail = ({ productId }) => {
  const [activeTab, setActiveTab] = useState('description');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch product from API
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;

      setLoading(true);
      try {
        const result = await productService.getProductById(productId);
        if (result.success) {
          setProduct(result.data.product);
        }
      } catch (err) {
        console.error('Failed to fetch product details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Check if product has description
  const hasDescription = product?.detailDescription && product?.detailDescription?.intro && product?.detailDescription?.intro.length > 0;
  const content = product?.detailDescription;

  const tabs = [
    { id: 'description', label: 'Description' },
    { id: 'vendor', label: 'Vendor' },
    { id: 'reviews', label: `Reviews (${product?.reviewCount || 0})` },
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="border border-[#ececec] rounded-[15px] bg-white p-8">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="mt-4 text-gray-600">Loading details...</p>
          </div>
        </div>
      </div>
    );
  }

  // If no product, show empty state
  if (!product) {
    return (
      <div className="border border-[#ececec] rounded-[15px] bg-white p-8">
        <p className="text-center text-gray-500">Product details not available.</p>
      </div>
    );
  }

  return (
    <div className="border border-[#ececec] rounded-[15px] bg-white">
      {/* Tabs */}
      <div className="flex gap-3 px-[51px] pt-[41px] pb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`h-[45px] px-8 rounded-[30px] border border-[#ececec] font-['Quicksand',sans-serif] font-bold text-[17px] leading-[17px] transition-colors ${activeTab === tab.id
              ? 'bg-white text-[#3bb77e]'
              : 'bg-white text-[#7e7e7e] hover:text-[#3bb77e]'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-[51px] pb-[51px]">
        {activeTab === 'description' && (
          <>
            {!hasDescription ? (
              <div className="py-8 text-center text-[#7e7e7e] text-[16px] font-['Lato',sans-serif]">
                Description content coming soon...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Intro Paragraphs */}
                {content.intro && content.intro.length > 0 && (
                  <div className="space-y-4">
                    {content.intro.map((paragraph, index) => (
                      <p key={index} className="text-[#7e7e7e] text-[16px] font-['Lato',sans-serif] leading-[24px]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}

                {/* Specifications List */}
                {content.specifications && content.specifications.length > 0 && (
                  <div className="space-y-3">
                    {content.specifications.map((spec, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-1.5 h-1.5 bg-[#9b9b9b] rounded-full flex-shrink-0" />
                        <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif] min-w-[165px]">
                          {spec.label}
                        </span>
                        <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif]">
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Separator */}
                {content.additionalDesc && (
                  <>
                    <div className="h-px bg-[#7e7e7e] opacity-25" />
                    <p className="text-[#7e7e7e] text-[16px] font-['Lato',sans-serif] leading-[24px]">
                      {content.additionalDesc}
                    </p>
                  </>
                )}

                {/* Packaging & Delivery Section */}
                {content.packaging && content.packaging.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-[#253d4e] text-[24px] font-bold font-['Quicksand',sans-serif] leading-[28.8px]">
                      Packaging & Delivery
                    </h3>
                    <div className="h-px bg-[#7e7e7e] opacity-25" />
                    {content.packaging.map((paragraph, index) => (
                      <p key={index} className="text-[#7e7e7e] text-[16px] font-['Lato',sans-serif] leading-[24px]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}

                {/* Suggested Use Section */}
                {content.suggestedUse && content.suggestedUse.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-[#253d4e] text-[24px] font-bold font-['Quicksand',sans-serif] leading-[28.8px]">
                      Suggested Use
                    </h3>
                    <div className="space-y-3">
                      {content.suggestedUse.map((item, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <div className="w-1.5 h-1.5 bg-[#9b9b9b] rounded-full flex-shrink-0" />
                          <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif]">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Ingredients Section */}
                {content.otherIngredients && content.otherIngredients.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-[#253d4e] text-[24px] font-bold font-['Quicksand',sans-serif] leading-[28.8px]">
                      Other Ingredients
                    </h3>
                    <div className="space-y-3">
                      {content.otherIngredients.map((item, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="w-1.5 h-1.5 bg-[#9b9b9b] rounded-full flex-shrink-0 mt-2" />
                          <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif]">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings Section */}
                {content.warnings && content.warnings.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-[#253d4e] text-[24px] font-bold font-['Quicksand',sans-serif] leading-[28.8px]">
                      Warnings
                    </h3>
                    <div className="space-y-3">
                      {content.warnings.map((item, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="w-1.5 h-1.5 bg-[#9b9b9b] rounded-full flex-shrink-0 mt-2" />
                          <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif]">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'vendor' && (
          <div className="space-y-6">
            {/* Vendor Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-[#253d4e] text-[24px] font-bold font-['Quicksand',sans-serif] leading-[28.8px] mb-4">
                Vendor Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif] font-semibold min-w-[120px]">
                    Vendor Name:
                  </span>
                  <span className="text-[#3bb77e] text-[16px] font-['Lato',sans-serif] font-bold">
                    {product?.vendor || 'N/A'}
                  </span>
                </div>

                {product?.type && (
                  <div className="flex items-center gap-3">
                    <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif] font-semibold min-w-[120px]">
                      Product Type:
                    </span>
                    <span className="text-[#253d4e] text-[14px] font-['Lato',sans-serif]">
                      {product.type}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif] font-semibold min-w-[120px]">
                    SKU:
                  </span>
                  <span className="text-[#253d4e] text-[14px] font-['Lato',sans-serif]">
                    {product?.sku || 'N/A'}
                  </span>
                </div>

                {product?.category && (
                  <div className="flex items-center gap-3">
                    <span className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif] font-semibold min-w-[120px]">
                      Category:
                    </span>
                    <span className="text-[#3bb77e] text-[14px] font-['Lato',sans-serif]">
                      {product.category.name || product.category}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Vendor Info */}
            <div>
              <p className="text-[#7e7e7e] text-[14px] font-['Lato',sans-serif] leading-[22px]">
                This product is supplied by <span className="font-bold text-[#3bb77e]">{product?.vendor}</span>.
                All products are quality checked and guaranteed fresh.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="py-8 text-center text-[#7e7e7e] text-[16px] font-['Lato',sans-serif]">
            Reviews content coming soon...
          </div>
        )}
      </div>
    </div>
  );
};
