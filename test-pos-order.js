/**
 * Test Script: POS Order with Payment
 * 
 * Purpose: Test the fixed POS order creation flow to verify:
 * 1. Order is created with status 'draft'
 * 2. Payment is created with status 'completed'
 * 3. Order status changes from 'draft' to 'delivered'
 * 4. DetailInventory is updated correctly (quantityOnShelf decreases)
 * 5. InventoryMovementBatch log is created
 * 
 * Prerequisites:
 * 1. Have an employee with POS access
 * 2. Have a product with inventory on shelf
 * 3. Have a customer (or use 'virtual-guest')
 */

require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import models
const Employee = require('./models/employee');
const UserAccount = require('./models/userAccount');
const Customer = require('./models/customer');
const Product = require('./models/product');
const ProductBatch = require('./models/productBatch');
const Inventory = require('./models/inventory'); // For auto-update hook
const DetailInventory = require('./models/detailInventory');
const InventoryMovementBatch = require('./models/inventoryMovementBatch');
const Order = require('./models/order');
const OrderDetail = require('./models/orderDetail');
const Payment = require('./models/payment');

const MONGODB_URI = process.env.MONGODB_URI;

async function testPOSOrder() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ========== STEP 1: Find Employee with POS Access ==========
    console.log('========== STEP 1: Find Employee ==========');
    const employee = await Employee.findOne({})
      .populate('userAccount')
      .lean();

    if (!employee) {
      throw new Error('No employee found in database');
    }

    console.log(`✅ Employee found: ${employee.fullName} (${employee._id})`);

    // Generate POS token
    const token = jwt.sign(
      {
        id: employee._id,
        userCode: employee.userAccount?.userCode || 'TEST',
        role: employee.userAccount?.role || null,
        isPOS: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    console.log(`✅ POS token generated\n`);

    // ========== STEP 2: Find Product with Stock on Shelf ==========
    console.log('========== STEP 2: Find Product with Stock ==========');

    // Find a batch with stock on shelf
    const batchWithStock = await DetailInventory.findOne({
      quantityOnShelf: { $gt: 0 }
    })
      .populate('batchId')
      .lean();

    if (!batchWithStock) {
      throw new Error('No batch found with stock on shelf');
    }

    const batch = await ProductBatch.findById(batchWithStock.batchId._id)
      .populate('product')
      .lean();

    const product = batch.product;

    console.log(`✅ Product found: ${product.name} (${product._id})`);
    console.log(`   Batch: ${batch.batchCode}`);
    console.log(`   Stock on shelf: ${batchWithStock.quantityOnShelf}`);
    console.log(`   Unit price: ${product.unitPrice || batch.unitPrice}\n`);

    // ========== STEP 3: Record Before State ==========
    console.log('========== STEP 3: Before State ==========');
    const beforeInventory = await DetailInventory.findOne({ batchId: batch._id });
    console.log(`DetailInventory BEFORE:`);
    console.log(`  quantityOnShelf: ${beforeInventory.quantityOnShelf}`);
    console.log(`  quantityReserved: ${beforeInventory.quantityReserved}`);
    console.log(`  quantityOnHand: ${beforeInventory.quantityOnHand}\n`);

    const beforeMovementCount = await InventoryMovementBatch.countDocuments({ batchId: batch._id });
    console.log(`InventoryMovementBatch count BEFORE: ${beforeMovementCount}\n`);

    // ========== STEP 4: Simulate POS Order Request ==========
    console.log('========== STEP 4: Simulate POS Order Request ==========');

    const quantityToOrder = Math.min(2, beforeInventory.quantityOnShelf); // Order 2 items or max available

    const orderRequest = {
      customer: 'virtual-guest',
      items: [
        {
          product: product._id.toString(),
          quantity: quantityToOrder,
          unitPrice: product.unitPrice || batch.unitPrice
        }
      ],
      deliveryType: 'pickup',
      paymentMethod: 'cash',
      notes: 'Test POS order'
    };

    console.log('Order request:', JSON.stringify(orderRequest, null, 2));
    console.log();

    // ========== STEP 5: Create Order with Payment ==========
    console.log('========== STEP 5: Create Order with Payment ==========');
    console.log('Calling createPOSOrder + Payment flow...\n');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Import the helper function
      const { allocateQuantityFEFO } = require('./utils/batchHelpers');
      const Customer = require('./models/customer');

      // Create virtual guest customer if needed
      let customerDoc = await Customer.findOne({
        email: 'virtual.guest@pos.system',
        customerType: 'guest'
      });

      if (!customerDoc) {
        customerDoc = new Customer({
          fullName: 'Virtual Guest',
          email: 'virtual.guest@pos.system',
          phone: '0000000000',
          gender: 'other',
          customerType: 'guest',
          totalSpent: 0,
          isActive: true
        });
        await customerDoc.save({ session });
        console.log('✅ Created virtual guest customer');
      }

      // Process items with FEFO
      const processedItems = [];
      for (const item of orderRequest.items) {
        const batchAllocations = await allocateQuantityFEFO(item.product, item.quantity);

        for (const allocation of batchAllocations) {
          processedItems.push({
            product: item.product,
            batch: allocation.batchId,
            quantity: allocation.quantity,
            unitPrice: item.unitPrice || allocation.unitPrice
          });
        }
      }

      // Calculate total
      const subtotal = processedItems.reduce((sum, item) => {
        return sum + (item.quantity * parseFloat(item.unitPrice || 0));
      }, 0);

      const discountPercentage = 0; // Guest has no discount
      const discountAmount = subtotal * (discountPercentage / 100);
      const total = subtotal - discountAmount;

      // Create order (draft)
      const order = new Order({
        customer: customerDoc._id,
        createdBy: employee._id,
        orderDate: new Date(),
        deliveryType: 'pickup',
        status: 'draft',
        paymentStatus: 'pending',
        shippingFee: 0,
        discountPercentage: discountPercentage,
        total: total
      });

      await order.save({ session });
      console.log(`✅ Order created: ${order.orderNumber} (status: ${order.status})`);

      // Create order details
      for (const item of processedItems) {
        const orderDetail = new OrderDetail({
          order: order._id,
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          batch: item.batch
        });
        await orderDetail.save({ session });
      }
      console.log(`✅ Order details created (${processedItems.length} items)`);

      // Create payment
      const payment = new Payment({
        referenceType: 'Order',
        referenceId: order._id,
        amount: order.total,
        paymentMethod: 'cash',
        paymentDate: new Date(),
        status: 'completed',
        createdBy: employee._id,
        notes: `Test POS Payment - ${order.orderNumber}`
      });

      await payment.save({ session });
      console.log(`✅ Payment created: ${payment.paymentNumber}\n`);

      // ⭐ CRITICAL: Update order status (draft → delivered)
      console.log('🔄 Updating order status: draft → delivered...');

      const orderToUpdate = await Order.findById(order._id).session(session);

      if (!orderToUpdate) {
        throw new Error('Order not found after creation');
      }

      console.log(`Current order status in DB: ${orderToUpdate.status}`);

      // ⭐ Set _originalStatus explicitly (SOLUTION 1)
      // We MUST set this to the current status from DB before changing it
      orderToUpdate._originalStatus = orderToUpdate.status; // This should be 'draft'
      orderToUpdate.status = 'delivered';
      orderToUpdate.paymentStatus = 'paid';

      // ⭐ Force Mongoose to track change
      orderToUpdate.markModified('status');

      console.log(`_originalStatus set to: ${orderToUpdate._originalStatus}`);
      console.log(`New status set to: ${orderToUpdate.status}`);
      console.log(`isModified('status'): ${orderToUpdate.isModified('status')}`);
      console.log('Triggering order.save() - middleware should run...\n');
      await orderToUpdate.save({ session });
      console.log('✅ Order status updated\n');      // Commit transaction
      console.log('✅ Committing transaction...');
      await session.commitTransaction();
      console.log('✅ Transaction committed\n');

      // ========== STEP 6: Verify After State ==========
      console.log('========== STEP 6: After State ==========');
      const afterInventory = await DetailInventory.findOne({ batchId: batch._id });
      console.log(`DetailInventory AFTER:`);
      console.log(`  quantityOnShelf: ${afterInventory.quantityOnShelf}`);
      console.log(`  quantityReserved: ${afterInventory.quantityReserved}`);
      console.log(`  quantityOnHand: ${afterInventory.quantityOnHand}\n`);

      const afterMovementCount = await InventoryMovementBatch.countDocuments({ batchId: batch._id });
      console.log(`InventoryMovementBatch count AFTER: ${afterMovementCount}\n`);

      // ========== STEP 7: Verify Changes ==========
      console.log('========== STEP 7: Verify Changes ==========');

      const shelfDifference = beforeInventory.quantityOnShelf - afterInventory.quantityOnShelf;
      const movementDifference = afterMovementCount - beforeMovementCount;

      console.log(`Expected shelf decrease: ${quantityToOrder}`);
      console.log(`Actual shelf decrease: ${shelfDifference}`);
      console.log(`Expected new movements: 1`);
      console.log(`Actual new movements: ${movementDifference}\n`);

      if (shelfDifference === quantityToOrder) {
        console.log('✅ PASS: Inventory updated correctly!');
      } else {
        console.log('❌ FAIL: Inventory NOT updated correctly!');
      }

      if (movementDifference === 1) {
        console.log('✅ PASS: Movement log created!');
      } else {
        console.log('❌ FAIL: Movement log NOT created!');
      }

      // Show the movement log
      if (movementDifference > 0) {
        console.log('\n========== Movement Log ==========');
        const movements = await InventoryMovementBatch.find({
          batchId: batch._id,
          createdAt: { $gte: new Date(Date.now() - 60000) } // Last minute
        }).sort({ createdAt: -1 }).limit(1);

        for (const movement of movements) {
          console.log(`Movement Number: ${movement.movementNumber}`);
          console.log(`Type: ${movement.movementType}`);
          console.log(`Quantity: ${movement.quantity}`);
          console.log(`Reason: ${movement.reason}`);
          console.log(`Notes: ${movement.notes}`);
        }
      }

    } catch (error) {
      console.error('\n❌ Transaction failed:', error.message);
      console.error('Stack:', error.stack);
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    console.log('\n========================================');
    console.log('✅ Test completed successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run test
testPOSOrder();
