const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },

  // Customer info
  customer: {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
    },
    email: {
      type: String,
      required: [true, 'Customer email is required'],
    },
    phone: {
      type: String,
      required: [true, 'Customer phone is required'],
    }
  },

  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Delivery type
  deliveryType: {
    type: String,
    enum: ['delivery', 'pickup'],
    default: 'delivery'
  },

  // Shipping address (only required for delivery type)
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'Vietnam'
    }
  },

  // Order items(embedded subdocument)
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required']
    },
    productName: String,
    productImage: String,
    price: {
      type: Number,
      required: [true, 'Price is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    subtotal: {
      type: Number,
      required: [true, 'Total is required']
    }
  }],

  // Pricing
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required']
  },

  shippingFee: {
    type: Number,
    default: 0
  },

  tax: {
    type: Number,
    default: 0
  },

  discount: {
    type: Number,
    default: 0
  },

  discountType: {
    type: String,
    enum: ['none', 'retail', 'wholesale', 'vip'],
    default: 'none'
  },

  discountPercentage: {
    type: Number,
    default: 0
  },

  total: {
    type: Number,
    required: [true, 'Total is required']
  },

  // Payment
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'e_wallet'],
    default: 'cash'
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },

  paidAt: Date,

  // Order status
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipping', 'delivered', 'cancelled'],
    default: 'pending'
  },

  // Tracking
  trackingNumber: String,

  // Timestamps cho các stage
  processingAt: Date,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,

  // Notes
  customerNote: String,
  adminNote: String

}, {
  timestamps: true
});

// Auto-generate order number
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    this.orderNumber = `ORD${year}${month}${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

// Index
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

orderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

module.exports = mongoose.model('Order', orderSchema);