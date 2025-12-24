/**
 * Migration Script: Add maxCapacity to existing LocationMaster records
 * Date: 2025-12-24
 * Description: Sets default maxCapacity = 100 for all existing locations
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const LocationMaster = require('../models/locationMaster');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb';

async function migrate() {
  try {
    console.log('🚀 Starting migration: Add maxCapacity to LocationMaster');
    console.log(`📡 Connecting to MongoDB: ${MONGODB_URI}`);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all locations that don't have maxCapacity field
    const locationsToUpdate = await LocationMaster.find({
      maxCapacity: { $exists: false }
    });

    console.log(`📊 Found ${locationsToUpdate.length} locations without maxCapacity`);

    if (locationsToUpdate.length === 0) {
      console.log('✨ No locations to update. Migration complete!');
      return;
    }

    // Update all locations to have maxCapacity = 100
    const result = await LocationMaster.updateMany(
      { maxCapacity: { $exists: false } },
      { $set: { maxCapacity: 100 } }
    );

    console.log(`✅ Updated ${result.modifiedCount} locations`);
    console.log('✨ Migration completed successfully!');

    // Display updated locations
    const updatedLocations = await LocationMaster.find({}).select('name locationCode maxCapacity');
    console.log('\n📋 Current locations:');
    updatedLocations.forEach(loc => {
      console.log(`   - ${loc.name} (${loc.locationCode}): maxCapacity = ${loc.maxCapacity}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✅ Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
