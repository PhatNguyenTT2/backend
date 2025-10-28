// Template generator for remaining products detail descriptions

const generateDetailDescription = (productName, productType, productCategory) => {
  const templates = {
    seafood: {
      intro: [
        `${productName} represents the finest in premium seafood quality. Sourced from pristine waters and prepared with meticulous attention to detail, this product delivers exceptional taste and nutritional value.`,
        `Each piece is carefully selected and processed to maintain optimal freshness and flavor. Perfect for special occasions or when you want to bring restaurant-quality seafood to your home kitchen.`
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Vacuum Sealed' },
        { label: 'Weight', value: '12 oz (340g)' },
        { label: 'Pieces per Package', value: '2-3 fillets' },
        { label: 'Omega-3 Content', value: 'High' },
        { label: 'Wild Caught', value: 'Yes' },
      ]
    },
    frozen: {
      intro: [
        `${productName} brings convenience and quality together in perfect harmony. Flash-frozen at peak freshness to lock in flavor and nutrients, this product is ready when you are.`,
        `Carefully prepared using traditional methods and modern freezing technology, ensuring every bite delivers the taste and texture you expect from premium frozen foods.`
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Frozen Package' },
        { label: 'Weight', value: '16 oz (454g)' },
        { label: 'Cook Time', value: '20-25 minutes' },
        { label: 'Storage', value: 'Keep Frozen' },
        { label: 'Shelf Life', value: '12 months frozen' },
      ]
    },
    dairy: {
      intro: [
        `${productName} delivers creamy richness and premium quality in every serving. Made from the finest ingredients and crafted with care to ensure consistent taste and texture.`,
        `Perfect for both everyday enjoyment and special recipes, this dairy product meets the highest standards of quality and freshness.`
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Refrigerated Container' },
        { label: 'Volume', value: '32 oz (946ml)' },
        { label: 'Fat Content', value: 'Varies by product' },
        { label: 'Pasteurized', value: 'Yes' },
        { label: 'Shelf Life', value: '14-21 days' },
      ]
    },
    organic: {
      intro: [
        `${productName} represents our commitment to organic farming and sustainable agriculture. Grown without synthetic pesticides or fertilizers, this product delivers pure, natural flavor.`,
        `Certified organic and carefully cultivated to maintain the highest standards of quality and environmental responsibility.`
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Eco-Friendly Package' },
        { label: 'Certification', value: 'USDA Organic' },
        { label: 'Pesticides', value: 'None Used' },
        { label: 'GMO Free', value: 'Yes' },
        { label: 'Farming Method', value: 'Sustainable' },
      ]
    }
  };

  const getTemplate = () => {
    if (productCategory.includes('Meat') || productCategory.includes('Seafood')) return templates.seafood;
    if (productType.includes('Frozen')) return templates.frozen;
    if (productCategory.includes('Dairy')) return templates.dairy;
    if (productType.includes('Organic')) return templates.organic;
    return templates.frozen; // default
  };

  const template = getTemplate();

  return {
    intro: template.intro,
    specifications: template.specifications,
    additionalDesc: `This ${productName.toLowerCase()} is prepared using time-tested methods and quality ingredients. Whether you're cooking for family or entertaining guests, this product delivers consistent results and exceptional taste.`,
    packaging: [
      `Our packaging is designed to preserve freshness and quality from our facility to your table. Easy-to-handle design makes storage and preparation convenient.`,
      `Clear labeling provides all necessary information including cooking instructions, nutritional facts, and storage recommendations for optimal results.`
    ],
    suggestedUse: [
      'Follow package instructions for best results',
      'Store according to package directions',
      'Use by expiration date for optimal quality'
    ],
    otherIngredients: [
      'Premium quality ingredients carefully selected',
      'No artificial preservatives when possible',
      'Processed in facilities that meet strict quality standards'
    ],
    warnings: [
      'Check package for allergen information',
      'Follow storage and cooking instructions carefully'
    ]
  };
};

// Export for use in products.js
export default generateDetailDescription;