const mongoose = require('mongoose');

/**
 * Order Model
 * Manages customer orders from POS system
 * References: Customer (many-to-one), Employee (many-to-one)
 * Related: OrderDetail (one-to-many)
 */
const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^ORD\d{10}$/, 'Order number must follow format ORD2501000001']
    // Auto-generated in pre-save hook: ORD + YYMM + 6-digit sequence
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },

  orderDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Order date is required']
  },

  deliveryType: {
    type: String,
    enum: {
      values: ['delivery', 'pickup'],
      message: '{VALUE} is not a valid delivery type'
    },
    default: 'delivery'
  },

  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address must be at most 500 characters']
  },

  shippingFee: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Shipping fee cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  discountPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },

  total: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
    min: [0, 'Total cannot be negative'],
    get: function (value) {
      if (value) {
        return parseFloat(value.toString());
      }
      return 0;
    }
  },

  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'failed', 'refunded'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'pending'
  },

  status: {
    type: String,
    enum: {
      values: ['draft', 'pending', 'shipping', 'delivered', 'cancelled', 'refunded'],
      message: '{VALUE} is not a valid status'
    },
    default: 'draft'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ INDEXES ============
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1, orderDate: -1 });
orderSchema.index({ createdBy: 1, orderDate: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ total: -1 });

// ============ VIRTUALS ============
// Virtual: Order details relationship
orderSchema.virtual('details', {
  ref: 'OrderDetail',
  localField: '_id',
  foreignField: 'order'
});

// Virtual: Payments relationship
orderSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'referenceId',
  match: { referenceType: 'Order' }
});

// Virtual: Calculate subtotal from details (when populated)
orderSchema.virtual('subtotal').get(function () {
  if (this.details && Array.isArray(this.details)) {
    return this.details.reduce((sum, detail) => {
      const price = detail.unitPrice || 0;
      const quantity = detail.quantity || 0;
      return sum + (price * quantity);
    }, 0);
  }
  return 0;
});

// Virtual: Calculate discount amount
orderSchema.virtual('discountAmount').get(function () {
  const subtotal = this.subtotal || 0;
  const discountPercent = this.discountPercentage || 0;
  return parseFloat((subtotal * (discountPercent / 100)).toFixed(2));
});

// Virtual: Check if order is paid
orderSchema.virtual('isPaid').get(function () {
  return this.paymentStatus === 'paid';
});

// Virtual: Check if order is completed
orderSchema.virtual('isCompleted').get(function () {
  return this.status === 'delivered';
});

// Virtual: Check if order can be cancelled
orderSchema.virtual('canBeCancelled').get(function () {
  return ['draft', 'pending'].includes(this.status) &&
    this.paymentStatus !== 'paid';
});

// ============ INSTANCE METHODS ============
/**
 * Create a payment for this order
 * @param {Object} paymentData - Payment details (amount, paymentMethod, etc.)
 * @returns {Promise<Payment>} Created payment
 */
orderSchema.methods.addPayment = async function (paymentData) {
  const Payment = mongoose.model('Payment');
  return await Payment.create({
    ...paymentData,
    referenceType: 'Order',
    referenceId: this._id
  });
};

/**
 * Calculate total paid amount from all completed payments
 * @returns {Promise<Number>} Total paid amount
 */
orderSchema.methods.getTotalPaid = async function () {
  const Payment = mongoose.model('Payment');
  const payments = await Payment.find({
    referenceType: 'Order',
    referenceId: this._id,
    status: 'completed'
  });

  return payments.reduce((sum, payment) => {
    const amount = payment.amount || 0;
    return sum + (typeof amount === 'object' ? parseFloat(amount.toString()) : amount);
  }, 0);
};

/**
 * Calculate remaining balance
 * @returns {Promise<Number>} Remaining balance
 */
orderSchema.methods.getRemainingBalance = async function () {
  const totalPaid = await this.getTotalPaid();
  const total = this.total || 0;
  return Math.max(0, total - totalPaid);
};

// ============ MIDDLEWARE ============
/**
 * Pre-save hook: Store original status for comparison in inventory middleware
 */
orderSchema.pre('save', async function (next) {
  if (!this.isNew && this.isModified('status')) {
    // Fetch original document to compare status change
    const original = await this.constructor.findById(this._id).lean();
    this._originalStatus = original?.status;
  }
  next();
});

/**
 * Pre-save hook: Auto-generate orderNumber
 * Format: ORD[YYMM][SEQUENCE]
 * Example: ORD2501000001
 */
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    try {
      const Order = mongoose.model('Order');
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // YY
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const yearMonth = year + month; // YYMM

      // Find the last order number for the current month
      const lastOrder = await Order
        .findOne(
          { orderNumber: new RegExp(`^ORD${yearMonth}`) },
          { orderNumber: 1 }
        )
        .sort({ orderNumber: -1 })
        .lean();

      let sequenceNumber = 1;

      if (lastOrder && lastOrder.orderNumber) {
        // Extract the sequence number from the last order number
        const match = lastOrder.orderNumber.match(/\d{6}$/);
        if (match) {
          sequenceNumber = parseInt(match[0], 10) + 1;
        }
      }

      // Generate new order number: ORD + YYMM + 6-digit sequence
      this.orderNumber = `ORD${yearMonth}${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
      return next(error);
    }
  }

  // Auto-calculate total from order details
  // Only recalculate if total is not explicitly modified or is 0
  if (!this.isModified('total') || this.total === 0) {
    try {
      const OrderDetail = mongoose.model('OrderDetail');
      const details = await OrderDetail.find({ order: this._id });

      if (details && details.length > 0) {
        // Calculate subtotal from order details
        const subtotal = details.reduce((sum, detail) => {
          const itemTotal = detail.quantity * parseFloat(detail.unitPrice || 0);
          return sum + itemTotal;
        }, 0);

        // Apply discount percentage
        const discountPercent = parseFloat(this.discountPercentage || 0);
        const discountAmount = subtotal * (discountPercent / 100);

        // Add shipping fee
        const shippingFee = parseFloat(this.shippingFee || 0);

        // Calculate total: subtotal - discount + shipping
        this.total = subtotal - discountAmount + shippingFee;
      }
    } catch (error) {
      // If calculation fails, continue without setting total
      console.error('Error calculating order total:', error);
    }
  }

  next();
});

/**
 * Pre-save hook: Handle inventory changes when order status changes
 * - draft → pending: Reserve stock (subtract from shelf, add to reserved)
 * - draft → delivered: Direct sale (subtract from shelf) - POS flow
 * - pending → shipping: Keep reserved (no change)
 * - shipping → delivered: Complete sale (subtract from reserved)
 * - shipping → pending: Rollback to reserved (no change needed)
 * - pending/shipping → cancelled: Return stock (add to shelf, subtract from reserved)
 */
orderSchema.pre('save', async function (next) {
  // ⭐ ENHANCED LOGGING for debugging
  console.log('\n========== ORDER PRE-SAVE MIDDLEWARE ==========');
  console.log(`Order ID: ${this._id}`);
  console.log(`Order Number: ${this.orderNumber || 'N/A'}`);
  console.log(`isNew: ${this.isNew}`);
  console.log(`isModified('status'): ${this.isModified('status')}`);
  console.log(`Current status: ${this.status}`);
  console.log(`_originalStatus: ${this._originalStatus}`);

  // Only process if status is modified and not a new document
  if (!this.isModified('status') || this.isNew) {
    console.log('❌ SKIP: Status not modified or is new document');
    console.log('================================================\n');
    return next();
  }

  // ⭐ NEW: If _originalStatus is not set by controller, try to fetch it from DB
  if (!this._originalStatus) {
    console.log('⚠️ _originalStatus not set by controller, fetching from DB...');
    try {
      // ⭐ CRITICAL: Use the same session if available (for transactions)
      const query = this.constructor.findById(this._id);

      // Check if we're in a transaction by looking at the session
      if (this.$session()) {
        query.session(this.$session());
        console.log('  Using transaction session for query');
      }

      const original = await query.lean();
      if (original && original.status) {
        this._originalStatus = original.status;
        console.log(`✅ Retrieved _originalStatus from DB: ${this._originalStatus}`);
      } else {
        console.warn('⚠️ Could not retrieve original document from DB (might be new in transaction)');
        console.log('================================================\n');
        return next();
      }
    } catch (error) {
      console.error('❌ Error fetching original document:', error.message);
      console.log('================================================\n');
      return next();
    }
  }

  const oldStatus = this._originalStatus;
  const newStatus = this.status;

  console.log(`Status change detected: ${oldStatus} → ${newStatus}`);

  // No change in status
  if (oldStatus === newStatus) {
    console.log('❌ SKIP: No status change');
    console.log('================================================\n');
    return next();
  }

  console.log(`✅ Processing status change: ${oldStatus} → ${newStatus}`); try {
    const OrderDetail = mongoose.model('OrderDetail');
    const DetailInventory = mongoose.model('DetailInventory');
    const InventoryMovementBatch = mongoose.model('InventoryMovementBatch');
    const Employee = mongoose.model('Employee');

    // Get order details with batches
    // ⭐ CRITICAL: Use session for transaction-aware query
    const detailsQuery = OrderDetail.find({ order: this._id })
      .populate('batch')
      .populate('product');

    // Add session if we're in a transaction
    if (this.$session()) {
      detailsQuery.session(this.$session());
      console.log('  Using transaction session for OrderDetail query');
    }

    const details = await detailsQuery;

    console.log(`Found ${details.length} order detail(s)`);

    if (!details || details.length === 0) {
      console.warn('⚠️ No order details found for order:', this._id);
      console.log('================================================\n');
      return next();
    }

    // Get employee for movement logging
    const employee = this.createdBy;

    // CASE 1A: DRAFT → PENDING (Reserve stock from shelf - for Admin orders)
    if (oldStatus === 'draft' && newStatus === 'pending') {
      console.log('✅ MATCHED CASE: draft → pending (Admin order flow)');
      console.log('   Action: Reserve stock from shelf\n');

      for (const detail of details) {
        console.log(`  Processing: ${detail.product.name}`);
        console.log(`    Batch: ${detail.batch.batchCode}`);
        console.log(`    Quantity: ${detail.quantity}`);

        const detailInv = await DetailInventory.findOne({ batchId: detail.batch._id });

        if (!detailInv) {
          console.error(`  ❌ DetailInventory not found for batch ${detail.batch.batchCode}`);
          throw new Error(`DetailInventory not found for batch ${detail.batch.batchCode}`);
        }

        console.log(`    Before: quantityOnShelf=${detailInv.quantityOnShelf}, quantityReserved=${detailInv.quantityReserved}`);

        // Check sufficient stock on shelf
        if (detailInv.quantityOnShelf < detail.quantity) {
          console.error(`  ❌ Insufficient stock on shelf`);
          throw new Error(
            `Insufficient stock on shelf for batch ${detail.batch.batchCode}. ` +
            `Available: ${detailInv.quantityOnShelf}, Needed: ${detail.quantity}`
          );
        }

        // Move from shelf to reserved
        detailInv.quantityOnShelf -= detail.quantity;
        detailInv.quantityReserved += detail.quantity;
        await detailInv.save();

        console.log(`    After: quantityOnShelf=${detailInv.quantityOnShelf}, quantityReserved=${detailInv.quantityReserved}`);

        // Log movement
        const movement = await InventoryMovementBatch.create({
          batchId: detail.batch._id,
          inventoryDetail: detailInv._id,
          movementType: 'out',
          quantity: -detail.quantity,
          reason: `Reserved for order ${this.orderNumber || this._id}`,
          date: new Date(),
          performedBy: employee,
          notes: `Order status changed: ${oldStatus} → ${newStatus}. Stock moved from shelf to reserved.`
        });

        console.log(`    ✅ Movement created: ${movement.movementNumber}`);
        console.log(`    ✅ Reserved ${detail.quantity} units successfully\n`);
      }

      console.log('✅ All items reserved successfully');
    }

    // CASE 1B: DRAFT → DELIVERED (Direct POS sale - subtract from shelf immediately)
    else if (oldStatus === 'draft' && newStatus === 'delivered') {
      console.log('✅ MATCHED CASE: draft → delivered (POS direct sale)');
      console.log('   Action: Remove stock from shelf immediately\n');

      for (const detail of details) {
        console.log(`  Processing: ${detail.product.name}`);
        console.log(`    Batch: ${detail.batch.batchCode}`);
        console.log(`    Quantity: ${detail.quantity}`);

        const detailInv = await DetailInventory.findOne({ batchId: detail.batch._id });

        if (!detailInv) {
          console.error(`  ❌ DetailInventory not found for batch ${detail.batch.batchCode}`);
          throw new Error(`DetailInventory not found for batch ${detail.batch.batchCode}`);
        }

        console.log(`    Before: quantityOnShelf=${detailInv.quantityOnShelf}`);

        // Check sufficient stock on shelf
        if (detailInv.quantityOnShelf < detail.quantity) {
          console.error(`  ❌ Insufficient stock on shelf`);
          throw new Error(
            `Insufficient stock on shelf for batch ${detail.batch.batchCode}. ` +
            `Available: ${detailInv.quantityOnShelf}, Needed: ${detail.quantity}`
          );
        }

        // Subtract directly from shelf (POS direct sale)
        detailInv.quantityOnShelf -= detail.quantity;
        await detailInv.save();

        console.log(`    After: quantityOnShelf=${detailInv.quantityOnShelf}`);

        // Log movement (single log for direct sale)
        const movement = await InventoryMovementBatch.create({
          batchId: detail.batch._id,
          inventoryDetail: detailInv._id,
          movementType: 'out',
          quantity: -detail.quantity,
          reason: `POS direct sale - Order ${this.orderNumber || this._id}`,
          date: new Date(),
          performedBy: employee,
          notes: `POS sale completed. Stock sold directly from shelf (no reservation).`
        });

        console.log(`    ✅ Movement created: ${movement.movementNumber}`);
        console.log(`    ✅ POS sale: ${detail.quantity} units sold successfully\n`);
      }

      console.log('✅ All items sold successfully');
    }

    // CASE 2: PENDING/SHIPPING → DELIVERED (Complete sale - remove from reserved)
    else if ((oldStatus === 'pending' || oldStatus === 'shipping') && newStatus === 'delivered') {
      console.log('✅ MATCHED CASE: pending/shipping → delivered');
      console.log('   Action: Complete sale, remove from reserved\n');

      for (const detail of details) {
        const detailInv = await DetailInventory.findOne({ batchId: detail.batch._id });

        if (!detailInv) {
          throw new Error(`DetailInventory not found for batch ${detail.batch.batchCode}`);
        }

        // Check sufficient reserved stock
        if (detailInv.quantityReserved < detail.quantity) {
          console.warn(
            `⚠️ Reserved quantity mismatch for batch ${detail.batch.batchCode}. ` +
            `Reserved: ${detailInv.quantityReserved}, Expected: ${detail.quantity}`
          );
        }

        // Remove from reserved (stock is now sold)
        detailInv.quantityReserved -= detail.quantity;
        await detailInv.save();

        // Log movement
        await InventoryMovementBatch.create({
          batchId: detail.batch._id,
          inventoryDetail: detailInv._id,
          movementType: 'out',
          quantity: -detail.quantity,
          reason: `Sold via order ${this.orderNumber || this._id}`,
          date: new Date(),
          performedBy: employee,
          notes: `Order delivered. Stock removed from reserved.`
        });

        console.log(`✅ Completed sale of ${detail.quantity} units of ${detail.product.name} from batch ${detail.batch.batchCode}`);
      }
    }

    // CASE 3: PENDING → SHIPPING (Move to shipping - keep reserved)
    else if (oldStatus === 'pending' && newStatus === 'shipping') {
      console.log('📦 Order moved to shipping - stock remains reserved');
      // No inventory change needed, stock stays reserved
    }

    // CASE 4: SHIPPING → PENDING (Rollback shipping)
    else if (oldStatus === 'shipping' && newStatus === 'pending') {
      console.log('🔄 Rolling back shipping - stock remains reserved');
      // No inventory change needed, stock stays reserved
    }

    // CASE 5: (PENDING or SHIPPING) → CANCELLED (Return stock to shelf)
    else if ((oldStatus === 'pending' || oldStatus === 'shipping') && newStatus === 'cancelled') {
      console.log('❌ Cancelling order - returning stock to shelf...');

      for (const detail of details) {
        const detailInv = await DetailInventory.findOne({ batchId: detail.batch._id });

        if (!detailInv) {
          throw new Error(`DetailInventory not found for batch ${detail.batch.batchCode}`);
        }

        // Check sufficient reserved stock
        if (detailInv.quantityReserved < detail.quantity) {
          console.warn(
            `⚠️ Reserved quantity mismatch for batch ${detail.batch.batchCode}. ` +
            `Reserved: ${detailInv.quantityReserved}, Expected: ${detail.quantity}`
          );
        }

        // Return from reserved to shelf
        detailInv.quantityOnShelf += detail.quantity;
        detailInv.quantityReserved -= detail.quantity;
        await detailInv.save();

        // Log movement
        await InventoryMovementBatch.create({
          batchId: detail.batch._id,
          inventoryDetail: detailInv._id,
          movementType: 'in',
          quantity: detail.quantity,
          reason: `Order cancelled ${this.orderNumber || this._id}`,
          date: new Date(),
          performedBy: employee,
          notes: `Order cancelled. Stock returned from reserved to shelf.`
        });

        console.log(`✅ Returned ${detail.quantity} units of ${detail.product.name} to shelf for batch ${detail.batch.batchCode}`);
      }
    }

    // CASE 6: DRAFT → CANCELLED (No inventory change needed)
    else if (oldStatus === 'draft' && newStatus === 'cancelled') {
      console.log('❌ Cancelling draft order - no inventory change needed');
      // No inventory reserved yet, so no need to return anything
    }

    // CASE 7: DELIVERED → REFUNDED (Return sold stock to shelf)
    else if (oldStatus === 'delivered' && newStatus === 'refunded') {
      console.log('🔄 Refunding order - returning stock to shelf...');

      for (const detail of details) {
        const detailInv = await DetailInventory.findOne({ batchId: detail.batch._id });

        if (!detailInv) {
          throw new Error(`DetailInventory not found for batch ${detail.batch.batchCode}`);
        }

        // Return stock to shelf (refund means customer returned the items)
        detailInv.quantityOnShelf += detail.quantity;
        await detailInv.save();

        // Log movement
        await InventoryMovementBatch.create({
          batchId: detail.batch._id,
          inventoryDetail: detailInv._id,
          movementType: 'in',
          quantity: detail.quantity,
          reason: `Refunded from order ${this.orderNumber || this._id}`,
          date: new Date(),
          performedBy: employee,
          notes: `Order refunded. Stock returned to shelf.`
        });

        console.log(`✅ Refunded ${detail.quantity} units of ${detail.product.name} to shelf for batch ${detail.batch.batchCode}`);
      }
    }

    // CASE: Status change not handled
    else {
      console.log(`⚠️ Unhandled status change: ${oldStatus} → ${newStatus}`);
      console.log('   No inventory movement will be performed');
    }

    console.log('\n✅ Inventory middleware completed successfully');
    console.log('================================================\n');
    next();
  } catch (error) {
    console.error('\n❌ Error in order status change middleware:', error);
    console.error('Stack:', error.stack);
    console.log('================================================\n');
    next(error);
  }
});

// ============ JSON TRANSFORMATION ============
orderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;

    // Convert Decimal128 to number
    if (returnedObject.shippingFee && typeof returnedObject.shippingFee === 'object') {
      returnedObject.shippingFee = parseFloat(returnedObject.shippingFee.toString());
    }
    if (returnedObject.total && typeof returnedObject.total === 'object') {
      returnedObject.total = parseFloat(returnedObject.total.toString());
    }
  }
});

module.exports = mongoose.model('Order', orderSchema);
