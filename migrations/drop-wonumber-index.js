/**
 * Migration: Drop old woNumber index from stockoutorders collection
 * 
 * This migration removes the obsolete woNumber_1 index that was causing
 * duplicate key errors after renaming the field to soNumber.
 * 
 * Background:
 * - StockOutOrder model was updated to use soNumber instead of woNumber
 * - Old index woNumber_1 still exists in database causing E11000 errors
 * - This migration drops the old index to resolve the conflict
 * 
 * How to run:
 * node migrations/drop-wonumber-index.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Mart23';

async function dropWoNumberIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('stockoutorders');

    // Check existing indexes
    console.log('\nCurrent indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Check if woNumber_1 index exists
    const woNumberIndex = indexes.find(idx => idx.name === 'woNumber_1');

    if (woNumberIndex) {
      console.log('\n❌ Found obsolete woNumber_1 index');
      console.log('Dropping woNumber_1 index...');

      await collection.dropIndex('woNumber_1');
      console.log('✅ Successfully dropped woNumber_1 index');
    } else {
      console.log('\n✅ No woNumber_1 index found (already dropped or never existed)');
    }

    // Verify soNumber_1 index exists
    const soNumberIndex = indexes.find(idx => idx.name === 'soNumber_1');
    if (soNumberIndex) {
      console.log('✅ soNumber_1 index exists (correct)');
    } else {
      console.log('⚠️  soNumber_1 index does not exist');
      console.log('Creating soNumber_1 index...');
      await collection.createIndex({ soNumber: 1 }, { unique: true });
      console.log('✅ Created soNumber_1 index');
    }

    // Display final indexes
    console.log('\nFinal indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run migration
dropWoNumberIndex()
  .then(() => {
    console.log('\n🎉 Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
  });
