import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { ProductInfo, ProductDetail } from '../../components/ProductDetail';

const DetailProduct = () => {
  const params = useParams();
  // MongoDB ObjectId is a string, not a number
  const productId = params.id || null;

  console.log('DetailProduct - URL params:', params);
  console.log('DetailProduct - Product ID:', productId);
  console.log('DetailProduct - Slug:', params.slug);

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Product List', href: '/products/view' },
    { label: 'Product Detail', href: null },
  ];

  // If no product ID, show error
  if (!productId) {
    return (
      <Layout>
        <div className="space-y-6">
          <Breadcrumb items={breadcrumbItems} />
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h2 className="text-red-600 text-xl font-bold mb-2">Invalid Product URL</h2>
            <p className="text-red-500 mb-4">Product ID is missing from the URL.</p>
            <a
              href="/products/view"
              className="inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Back to Products
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Product Info - Images and Details */}
        <ProductInfo productId={productId} />

        {/* Product Detail - Description Tabs */}
        <ProductDetail productId={productId} />
      </div>
    </Layout>
  );
};

export default DetailProduct;
