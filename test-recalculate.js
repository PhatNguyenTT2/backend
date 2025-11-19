/**
 * Test script to recalculate all inventory quantities
 * Run this to sync Inventory records with DetailInventory aggregated values
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Inventory = require('./models/inventory');
const Product = require('./models/product');
const ProductBatch = require('./models/productBatch');
const DetailInventory = require('./models/detailInventory');
const config = require('./utils/config');

const recalculateAll = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔄 Fetching all inventories...');
    const inventories = await Inventory.find({}).populate('product', 'productCode name');
    console.log(`📦 Found ${inventories.length} inventories\n`);

    const results = {
      total: inventories.length,
      succeeded: 0,
      failed: 0,
      details: []
    };

    for (const inventory of inventories) {
      try {
        const before = {
          onHand: inventory.quantityOnHand,
          onShelf: inventory.quantityOnShelf,
          reserved: inventory.quantityReserved
        };

        const updated = await Inventory.recalculateFromDetails(inventory.product._id);

        if (updated) {
          const after = {
            onHand: updated.quantityOnHand,
            onShelf: updated.quantityOnShelf,
            reserved: updated.quantityReserved
          };

          const changed =
            before.onHand !== after.onHand ||
            before.onShelf !== after.onShelf ||
            before.reserved !== after.reserved;

          results.succeeded++;
          results.details.push({
            productCode: inventory.product.productCode,
            productName: inventory.product.name,
            status: 'success',
            changed,
            before,
            after
          });

          if (changed) {
            console.log(`✅ ${inventory.product.productCode} - ${inventory.product.name}`);
            console.log(`   Before: OnHand=${before.onHand}, OnShelf=${before.onShelf}, Reserved=${before.reserved}`);
            console.log(`   After:  OnHand=${after.onHand}, OnShelf=${after.onShelf}, Reserved=${after.reserved}\n`);
          } else {
            console.log(`⏭️  ${inventory.product.productCode} - No changes needed`);
          }
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          productCode: inventory.product.productCode,
          productName: inventory.product.name,
          status: 'failed',
          error: error.message
        });
        console.error(`❌ ${inventory.product.productCode} - Error: ${error.message}\n`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total: ${results.total}`);
    console.log(`   Succeeded: ${results.succeeded}`);
    console.log(`   Failed: ${results.failed}`);

    const changedCount = results.details.filter(d => d.changed).length;
    console.log(`   Changed: ${changedCount}`);
    console.log(`   Unchanged: ${results.succeeded - changedCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

recalculateAll();
