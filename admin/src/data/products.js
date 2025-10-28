// Shared product data across components

// Product images from Figma design
export const PRODUCT_IMAGES = {
  1: "https://www.figma.com/api/mcp/asset/0c995e0e-5422-4f78-8811-4bedf5e98433",
  2: "https://www.figma.com/api/mcp/asset/cf8b1c79-f3fa-4d54-b8d5-09c91ad96992",
  3: "https://www.figma.com/api/mcp/asset/5d070664-bc86-4eb3-8f00-39e11d83bdba",
  4: "https://www.figma.com/api/mcp/asset/38f1291e-0655-4669-92a7-f26025c7b0a4",
  5: "https://www.figma.com/api/mcp/asset/1784331e-c6f3-477d-84ed-9af4dcdafed6",
  6: "https://www.figma.com/api/mcp/asset/392f63cb-d79e-4d4f-9bbb-553671bf7c84",
  7: "https://www.figma.com/api/mcp/asset/c0cd52fc-afbd-4fec-92f5-f4fc4be35096",
  8: "https://www.figma.com/api/mcp/asset/81dd1fd3-63d5-4bbc-8ea6-876ac442bb34",
  9: "https://www.figma.com/api/mcp/asset/27ef38eb-c8bf-416e-b46c-b09eb0b56080",
  10: "https://www.figma.com/api/mcp/asset/1136d3d6-8327-47f2-b8fa-2da8f9afa825",
  11: "https://www.figma.com/api/mcp/asset/dfee1f73-b070-4898-bd8d-e2fa454c3b5d",
  12: "https://www.figma.com/api/mcp/asset/ba0cd317-3129-4ad2-ac6f-49a67075b92d",
  13: "https://www.figma.com/api/mcp/asset/d3059143-78ad-4b03-9746-d4f6a84817fa",
  14: "https://www.figma.com/api/mcp/asset/6605c5f3-6bbc-4cc2-bd33-9b7d969a480a",
  15: "https://www.figma.com/api/mcp/asset/1c1c7616-72a4-4bc5-97ce-113b44013604",
};

// Complete product database
export const ALL_PRODUCTS = [
  {
    id: 1,
    name: "Seeds of Change Organic Quinoa, Brown",
    category: "Baking material",
    image: PRODUCT_IMAGES[1],
    price: 28.85,
    originalPrice: 32.8,
    rating: 4.0,
    reviews: 32,
    vendor: "NestFood",
    description: "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Aliquam rem officia, corrupti reiciendis minima nisi modi, quasi, odio minus dolore impedit fuga eum eligendi.",
    sku: "FWM15VKT",
    mfg: "Jun 4.2022",
    tags: ["Snack", "Organic", "Brown"],
    life: "70 days",
    stock: 8,
    type: "Organic",
    detailDescription: {
      intro: [
        "Uninhibited carnally hired played in whimpered dear gorilla koala depending and much yikes off far quetzal goodness and from for grimaced goodness unaccountably and meadowlark near unblushingly crucial scallop tightly neurotic hungrily some and dear furiously this apart.",
        "Spluttered narrowly yikes left moth in yikes bowed this that grizzly much hello on spoon-fed that alas rethought much decently richly and wow against the frequent fluidly at formidable acceptably flapped besides and much circa far over the bucolically hey precarious goldfinch mastodon goodness gnashed a jellyfish and one however because."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Bottle' },
        { label: 'Color', value: 'Green, Pink, Powder Blue, Purple' },
        { label: 'Quantity Per Case', value: '100ml' },
        { label: 'Ethyl Alcohol', value: '70%' },
        { label: 'Piece In One', value: 'Carton' },
      ],
      additionalDesc: "Laconic overheard dear woodchuck wow this outrageously taut beaver hey hello far meadowlark imitatively egregiously hugged that yikes minimally unanimous pouted flirtatiously as beaver beheld above forward energetic across this jeepers beneficently cockily less a the raucously that magic upheld far so the this where crud then below after jeez enchanting drunkenly more much wow callously irrespective limpet.",
      packaging: [
        "Less lion goodness that euphemistically robin expeditiously bluebird smugly scratched far while thus cackled sheepishly rigid after due one assenting regarding censorious while occasional or this more crane went more as this less much amid overhung anathematic because much held one exuberantly sheep goodness so where rat wry well concomitantly.",
        "Scallop or far crud plain remarkably far by thus far iguana lewd precociously and and less rattlesnake contrary caustic wow this near alas and next and pled the yikes articulate about as less cackled dalmatian in much less well jeering for the thanks blindly sentimental whimpered less across objectively fanciful grimaced wildly some wow and rose jeepers outgrew lugubrious luridly irrationally attractively dachshund."
      ],
      suggestedUse: [
        'Refrigeration not necessary.',
        'Stir before serving',
      ],
      otherIngredients: [
        'Organic raw pecans, organic raw cashews.',
        'This butter was produced using a LTG (Low Temperature Grinding) process',
        'Made in machinery that processes tree nuts but does not process peanuts, gluten, dairy or soy',
      ],
      warnings: [
        'Oil separation occurs naturally. May contain pieces of shell.'
      ]
    }
  },
  {
    id: 2,
    name: "All Natural Italian-Style Chicken Meatballs",
    category: "Meats",
    image: PRODUCT_IMAGES[2],
    price: 52.85,
    originalPrice: 55.8,
    rating: 4.0,
    reviews: 28,
    vendor: "Stouffer",
    description: "High-quality chicken meatballs made with all natural ingredients and Italian herbs.",
    sku: "STF298KL",
    mfg: "Mar 15.2022",
    tags: ["Meat", "Italian", "Natural"],
    life: "45 days",
    stock: 12,
    type: "Natural",
    detailDescription: {
      intro: [
        "Crafted with premium all-natural ingredients, these Italian-style chicken meatballs deliver authentic Mediterranean flavors in every bite. Made using traditional Italian recipes passed down through generations.",
        "Each meatball is carefully seasoned with aromatic herbs including basil, oregano, and garlic, then slow-cooked to perfection. The result is a tender, juicy texture that melts in your mouth while maintaining its rich, savory taste."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Frozen Package' },
        { label: 'Weight', value: '2 lbs (32 oz)' },
        { label: 'Serving Size', value: '4 meatballs (85g)' },
        { label: 'Protein Content', value: '18g per serving' },
        { label: 'Storage', value: 'Keep Frozen' },
      ],
      additionalDesc: "These meatballs are perfect for pasta dishes, sandwiches, or served as appetizers. The all-natural preparation ensures no artificial preservatives, colors, or flavors are used, making them a healthier choice for your family meals.",
      packaging: [
        "Each package is vacuum-sealed to preserve freshness and flavor. The resealable packaging allows for convenient storage and portion control.",
        "Our eco-friendly packaging is designed to minimize environmental impact while ensuring the product stays fresh from freezer to table."
      ],
      suggestedUse: [
        'Cook from frozen - do not thaw',
        'Heat in oven at 350°F for 15-20 minutes',
        'Can be microwaved for quick preparation'
      ],
      otherIngredients: [
        'Ground chicken, breadcrumbs, eggs, Italian herbs',
        'Natural seasonings: garlic, onion, basil, oregano',
        'No artificial preservatives or additives'
      ],
      warnings: [
        'Keep frozen until ready to cook',
        'Cook thoroughly to internal temperature of 165°F'
      ]
    }
  },
  {
    id: 3,
    name: "Angie's Boomchickapop Sweet & Salty",
    category: "Baking material",
    image: PRODUCT_IMAGES[3],
    price: 48.85,
    originalPrice: 52.8,
    rating: 4.0,
    reviews: 45,
    vendor: "StarKist",
    description: "Delicious sweet and salty popcorn perfect for snacking anytime.",
    sku: "ANG487PQ",
    mfg: "Aug 20.2022",
    tags: ["Snack", "Sweet", "Salty"],
    life: "60 days",
    stock: 15,
    type: "Snack",
    detailDescription: {
      intro: [
        "Experience the perfect balance of sweet and salty in every kernel with Angie's Boomchickapop. This gourmet popcorn combines the rich sweetness of caramel with just the right touch of sea salt.",
        "Made with simple, wholesome ingredients and popped to perfection, this snack delivers a satisfying crunch and irresistible flavor that keeps you coming back for more."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Resealable Bag' },
        { label: 'Net Weight', value: '6 oz (170g)' },
        { label: 'Serving Size', value: '1 cup (28g)' },
        { label: 'Calories', value: '150 per serving' },
        { label: 'Gluten Free', value: 'Yes' },
      ],
      additionalDesc: "This artisanal popcorn is made in small batches to ensure maximum freshness and flavor. The sweet and salty combination makes it perfect for movie nights, parties, or whenever you need a delicious snack.",
      packaging: [
        "The resealable bag design keeps the popcorn fresh and crunchy for extended periods. Perfect for on-the-go snacking or sharing with friends and family.",
        "Our packaging is designed with sustainability in mind, using recyclable materials wherever possible while maintaining product freshness."
      ],
      suggestedUse: [
        'Store in a cool, dry place',
        'Reseal bag after opening to maintain freshness',
        'Perfect for sharing or individual snacking'
      ],
      otherIngredients: [
        'Non-GMO popcorn, cane sugar, sea salt',
        'Natural vanilla flavor, coconut oil',
        'No artificial colors or preservatives'
      ],
      warnings: [
        'May contain traces of nuts',
        'Keep away from direct sunlight'
      ]
    }
  },
  {
    id: 4,
    name: "Foster Farms Takeout Crispy Classic",
    category: "Meats",
    image: PRODUCT_IMAGES[4],
    price: 17.85,
    originalPrice: 19.8,
    rating: 4.0,
    reviews: 23,
    vendor: "NestFood",
    description: "Crispy and delicious chicken perfect for quick meals.",
    sku: "FF789XY",
    mfg: "Sep 10.2022",
    tags: ["Chicken", "Crispy", "Quick"],
    life: "30 days",
    stock: 6,
    type: "Frozen",
    detailDescription: {
      intro: [
        "Foster Farms Takeout Crispy Classic brings restaurant-quality fried chicken to your home. Each piece is carefully breaded and seasoned with our signature blend of herbs and spices.",
        "Perfect for busy weeknights or weekend gatherings, this crispy chicken delivers the taste and texture you crave without the hassle of deep frying at home."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Frozen Box' },
        { label: 'Weight', value: '24 oz (680g)' },
        { label: 'Pieces per Package', value: '8-10 pieces' },
        { label: 'Cook Time', value: '25-30 minutes' },
        { label: 'Temperature', value: 'Keep Frozen' },
      ],
      additionalDesc: "Our crispy coating locks in the chicken's natural juices while providing the perfect crunch. Made with premium chicken and cooked using advanced freezing technology to preserve flavor and texture.",
      packaging: [
        "Individually quick-frozen pieces ensure optimal freshness and prevent freezer burn. The sturdy packaging protects the coating during storage and transport.",
        "Easy-to-follow cooking instructions are printed on the package for perfect results every time."
      ],
      suggestedUse: [
        'Preheat oven to 375°F before cooking',
        'Cook directly from frozen - no thawing required',
        'Internal temperature should reach 165°F'
      ],
      otherIngredients: [
        'Fresh chicken, wheat flour, seasoning blend',
        'Natural spices and herbs for authentic flavor',
        'No artificial preservatives added'
      ],
      warnings: [
        'Keep frozen until ready to cook',
        'Cook thoroughly before serving'
      ]
    }
  },
  {
    id: 5,
    name: "Blue Diamond Almonds Lightly Salted",
    category: "Baking material",
    image: PRODUCT_IMAGES[5],
    price: 23.85,
    originalPrice: 25.8,
    rating: 4.0,
    reviews: 67,
    vendor: "NestFood",
    description: "Premium lightly salted almonds, perfect for healthy snacking.",
    sku: "BD456MN",
    mfg: "Jul 5.2022",
    tags: ["Nuts", "Healthy", "Salted"],
    life: "180 days",
    stock: 20,
    type: "Natural",
    detailDescription: {
      intro: [
        "Blue Diamond Almonds Lightly Salted offers the perfect balance of natural almond flavor with just a hint of sea salt. These premium California almonds are carefully selected for their superior taste and crunch.",
        "Packed with protein, healthy fats, and essential nutrients, these almonds make an ideal snack for health-conscious consumers who don't want to compromise on taste."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Resealable Can' },
        { label: 'Net Weight', value: '16 oz (454g)' },
        { label: 'Serving Size', value: '1 oz (28 almonds)' },
        { label: 'Protein', value: '6g per serving' },
        { label: 'Origin', value: 'California USA' },
      ],
      additionalDesc: "These almonds are dry roasted to perfection and lightly seasoned with sea salt. The careful roasting process enhances the natural almond flavor while maintaining their nutritional benefits.",
      packaging: [
        "The convenient resealable can keeps almonds fresh and makes them perfect for on-the-go snacking, office breaks, or adding to your favorite recipes.",
        "Sturdy packaging ensures the almonds maintain their crunch and don't get crushed during transport or storage."
      ],
      suggestedUse: [
        'Great for snacking straight from the can',
        'Perfect addition to salads and yogurt',
        'Store in a cool, dry place after opening'
      ],
      otherIngredients: [
        'Dry roasted almonds, sea salt',
        'No artificial flavors or preservatives',
        'Gluten-free and non-GMO verified'
      ],
      warnings: [
        'Contains tree nuts (almonds)',
        'May contain traces of other nuts'
      ]
    }
  },
  {
    id: 6,
    name: "Chobani Complete Vanilla Greek Yogurt",
    category: "Milks & Dairies",
    image: PRODUCT_IMAGES[6],
    price: 54.85,
    originalPrice: 59.8,
    rating: 4.0,
    reviews: 89,
    vendor: "NestFood",
    description: "Rich and creamy Greek yogurt with natural vanilla flavor.",
    sku: "CHO123VG",
    mfg: "Feb 28.2022",
    tags: ["Yogurt", "Greek", "Vanilla"],
    life: "21 days",
    stock: 25,
    type: "Dairy",
    detailDescription: {
      intro: [
        "Chobani Complete Vanilla Greek Yogurt delivers rich, creamy texture with the perfect hint of natural vanilla. Made with live and active cultures, this yogurt supports digestive health while satisfying your taste buds.",
        "Packed with protein and probiotics, this Greek yogurt is an excellent choice for breakfast, snacks, or as an ingredient in your favorite recipes."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Plastic Container' },
        { label: 'Weight', value: '32 oz (907g)' },
        { label: 'Protein', value: '15g per serving' },
        { label: 'Live Cultures', value: '5 billion CFU' },
        { label: 'Fat Content', value: 'Non-fat' },
      ],
      additionalDesc: "Our Greek yogurt is strained to remove excess whey, resulting in a thicker, creamier texture with double the protein of regular yogurt. The natural vanilla flavor comes from real vanilla extract.",
      packaging: [
        "The recyclable plastic container is designed for easy scooping and storage. The secure lid keeps the yogurt fresh and prevents spills in your refrigerator.",
        "Each container is clearly labeled with nutritional information and expiration date for your convenience and food safety."
      ],
      suggestedUse: [
        'Refrigerate at 40°F or below',
        'Consume within 7 days of opening',
        'Perfect for smoothies, parfaits, or eating plain'
      ],
      otherIngredients: [
        'Cultured pasteurized skim milk, natural vanilla flavor',
        'Live and active cultures (S. thermophilus, L. bulgaricus)',
        'No artificial sweeteners or preservatives'
      ],
      warnings: [
        'Contains milk - not suitable for those with dairy allergies',
        'Keep refrigerated at all times'
      ]
    }
  },
  {
    id: 7,
    name: "Canada Dry Ginger Ale – 2 L Bottle",
    category: "Baking material",
    image: PRODUCT_IMAGES[7],
    price: 32.85,
    originalPrice: 33.8,
    rating: 4.0,
    reviews: 156,
    vendor: "NestFood",
    description: "Refreshing ginger ale with natural ginger flavor.",
    sku: "CD789GA",
    mfg: "Oct 1.2022",
    tags: ["Beverage", "Ginger", "Refreshing"],
    life: "365 days",
    stock: 50,
    type: "Beverage",
    detailDescription: {
      intro: [
        "Canada Dry Ginger Ale has been America's favorite ginger ale since 1904. Made with real ginger extract, this crisp and refreshing beverage delivers the perfect balance of ginger spice and carbonation.",
        "Whether enjoyed on its own or used as a mixer, Canada Dry Ginger Ale provides that distinctive ginger taste that has made it a household favorite for over a century."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Plastic Bottle' },
        { label: 'Volume', value: '2 Liters (67.6 fl oz)' },
        { label: 'Calories', value: '90 per 8 fl oz serving' },
        { label: 'Carbonation', value: 'Naturally carbonated' },
        { label: 'Caffeine', value: 'Caffeine-free' },
      ],
      additionalDesc: "Our signature ginger ale is made with natural ginger flavor and carbonated water. The refreshing taste makes it perfect for any occasion, from casual meals to special celebrations.",
      packaging: [
        "The 2-liter bottle is perfect for families and gatherings. The sturdy plastic construction is lightweight and shatterproof for safe handling.",
        "Resealable cap maintains carbonation and freshness between servings. Easy-grip design makes pouring simple and mess-free."
      ],
      suggestedUse: [
        'Serve chilled over ice for best taste',
        'Great mixer for cocktails and mocktails',
        'Store in a cool place away from direct sunlight'
      ],
      otherIngredients: [
        'Carbonated water, high fructose corn syrup',
        'Natural ginger flavor, citric acid',
        'No artificial colors or preservatives'
      ],
      warnings: [
        'Contains sugar - not suitable for diabetics',
        'Shake gently before opening to prevent overflow'
      ]
    }
  },
  {
    id: 8,
    name: "Encore Seafoods Stuffed Alaskan Salmon",
    category: "Meats",
    image: PRODUCT_IMAGES[8],
    price: 35.85,
    originalPrice: 37.8,
    rating: 4.0,
    reviews: 34,
    vendor: "NestFood",
    description: "Premium Alaskan salmon stuffed with delicious seafood mixture.",
    sku: "ENC567AS",
    mfg: "Nov 12.2022",
    tags: ["Seafood", "Salmon", "Premium"],
    life: "7 days",
    stock: 4,
    type: "Fresh",
    detailDescription: {
      intro: [
        "Encore Seafoods Stuffed Alaskan Salmon represents the finest in premium seafood quality. Wild-caught from the pristine waters of Alaska and stuffed with our signature seafood mixture for an elevated dining experience.",
        "Each salmon fillet is hand-selected and expertly prepared, then stuffed with a delicious blend of crab meat, herbs, and seasonings. Perfect for special dinners or when you want to impress your guests."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Vacuum Sealed' },
        { label: 'Weight', value: '8 oz (227g) per fillet' },
        { label: 'Pieces per Package', value: '2 stuffed fillets' },
        { label: 'Wild Caught', value: 'Alaska' },
        { label: 'Stuffing', value: 'Crab & Herb Mix' },
      ],
      additionalDesc: "Our Alaskan salmon is sustainably sourced and stuffed with premium crab meat, breadcrumbs, and aromatic herbs. The combination creates a restaurant-quality dish that's easy to prepare at home.",
      packaging: [
        "Vacuum-sealed packaging preserves freshness and prevents freezer burn. Each fillet is individually wrapped for convenience and portion control.",
        "Clear cooking instructions and storage guidelines are provided on the package to ensure perfect results every time."
      ],
      suggestedUse: [
        'Thaw in refrigerator before cooking',
        'Bake at 400°F for 20-25 minutes',
        'Internal temperature should reach 145°F'
      ],
      otherIngredients: [
        'Wild Alaskan salmon, crab meat, breadcrumbs',
        'Fresh herbs: dill, parsley, chives',
        'Natural seasonings and binding agents'
      ],
      warnings: [
        'Contains shellfish and fish allergens',
        'Keep frozen until ready to cook'
      ]
    }
  },
  {
    id: 9,
    name: "Gorton's Beer Battered Fish Fillets",
    category: "Meats",
    image: PRODUCT_IMAGES[9],
    price: 23.85,
    originalPrice: 25.8,
    rating: 4.0,
    reviews: 78,
    vendor: "Old El Paso",
    description: "Crispy beer battered fish fillets, easy to prepare.",
    sku: "GOR890BF",
    mfg: "Apr 18.2022",
    tags: ["Fish", "Battered", "Frozen"],
    life: "90 days",
    stock: 18,
    type: "Frozen",
    detailDescription: {
      intro: [
        "Gorton's Beer Battered Fish Fillets bring pub-style fish and chips to your home kitchen. Made with premium white fish and coated in our signature beer batter for that perfect crispy crunch.",
        "Each fillet is individually quick-frozen to preserve flavor and texture. Simply bake from frozen for a delicious meal that's ready in minutes."
      ],
      specifications: [
        { label: 'Type Of Packing', value: 'Frozen Box' },
        { label: 'Weight', value: '18.3 oz (519g)' },
        { label: 'Pieces per Package', value: '6 fillets' },
        { label: 'Cook Time', value: '22-24 minutes' },
        { label: 'Fish Type', value: 'Alaska Pollock' },
      ],
      additionalDesc: "Our beer batter recipe creates a light, crispy coating that seals in the fish's natural moisture and flavor. Perfect with tartar sauce and a side of chips for an authentic pub experience.",
      packaging: [
        "Resealable box keeps remaining fillets fresh in the freezer. Individual fillets allow you to cook only what you need.",
        "Easy-to-follow cooking instructions ensure perfect results whether you bake, fry, or air fry these delicious fillets."
      ],
      suggestedUse: [
        'Cook from frozen - do not thaw',
        'Preheat oven to 425°F',
        'Great for fish and chips or fish sandwiches'
      ],
      otherIngredients: [
        'Alaska Pollock fillets, wheat flour, beer',
        'Cornstarch, salt, baking powder',
        'Natural flavors and seasonings'
      ],
      warnings: [
        'Contains fish and wheat allergens',
        'Cook to internal temperature of 165°F'
      ]
    }
  },
  {
    id: 10,
    name: "Haagen-Dazs Caramel Cone Ice Cream",
    category: "Milks & Dairies",
    image: PRODUCT_IMAGES[10],
    price: 22.85,
    originalPrice: 24.8,
    rating: 4.0,
    reviews: 123,
    vendor: "Tyson",
    description: "Premium ice cream with caramel swirls and cone pieces.",
    sku: "HD234CC",
    mfg: "May 25.2022",
    tags: ["Ice Cream", "Caramel", "Premium"],
    life: "180 days",
    stock: 14,
    type: "Frozen"
  },
  {
    id: 11,
    name: "Fresh Organic Broccoli Crowns",
    category: "Vegetables",
    image: PRODUCT_IMAGES[11],
    price: 15.85,
    originalPrice: 17.8,
    rating: 4.0,
    reviews: 45,
    vendor: "NestFood",
    description: "Fresh organic broccoli crowns, rich in vitamins and minerals.",
    sku: "FOB345BC",
    mfg: "Dec 1.2022",
    tags: ["Vegetable", "Organic", "Fresh"],
    life: "7 days",
    stock: 30,
    type: "Organic"
  },
  {
    id: 12,
    name: "Fresh Organic Strawberries",
    category: "Fresh Fruits",
    image: PRODUCT_IMAGES[12],
    price: 28.85,
    originalPrice: 32.8,
    rating: 4.0,
    reviews: 67,
    vendor: "NestFood",
    description: "Sweet and juicy organic strawberries, perfect for desserts.",
    sku: "FOS678ST",
    mfg: "Jun 15.2022",
    tags: ["Fruit", "Organic", "Sweet"],
    life: "5 days",
    stock: 22,
    type: "Organic"
  },
  {
    id: 13,
    name: "Fresh Organic Bananas",
    category: "Fresh Fruits",
    image: PRODUCT_IMAGES[13],
    price: 12.85,
    originalPrice: 15.8,
    rating: 4.0,
    reviews: 89,
    vendor: "NestFood",
    description: "Fresh organic bananas, great source of potassium and energy.",
    sku: "FOB901BN",
    mfg: "Nov 20.2022",
    tags: ["Fruit", "Organic", "Potassium"],
    life: "10 days",
    stock: 40,
    type: "Organic"
  },
  {
    id: 14,
    name: "Fresh Organic Carrots",
    category: "Vegetables",
    image: PRODUCT_IMAGES[14],
    price: 8.85,
    originalPrice: 10.8,
    rating: 4.0,
    reviews: 56,
    vendor: "NestFood",
    description: "Crisp and sweet organic carrots, perfect for cooking or snacking.",
    sku: "FOC234CR",
    mfg: "Oct 30.2022",
    tags: ["Vegetable", "Organic", "Sweet"],
    life: "14 days",
    stock: 35,
    type: "Organic"
  },
  {
    id: 15,
    name: "Organic Whole Milk",
    category: "Milks & Dairies",
    image: PRODUCT_IMAGES[15],
    price: 18.85,
    originalPrice: 22.8,
    rating: 4.0,
    reviews: 234,
    vendor: "NestFood",
    description: "Fresh organic whole milk from grass-fed cows.",
    sku: "OWM567ML",
    mfg: "Dec 5.2022",
    tags: ["Milk", "Organic", "Whole"],
    life: "14 days",
    stock: 28,
    type: "Organic"
  },
];

/**
 * Get product by ID
 * @param {number} id - Product ID
 * @returns {object|null} - Product object or null if not found
 */
export const getProductById = (id) => {
  return ALL_PRODUCTS.find(product => product.id === id) || null;
};

/**
 * Calculate discount percentage
 * @param {number} price - Current price
 * @param {number} originalPrice - Original price
 * @returns {number} - Discount percentage
 */
export const getDiscountPercent = (price, originalPrice) => {
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};