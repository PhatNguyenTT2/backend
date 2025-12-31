const ProductBatch = require('../models/productBatch');
const Product = require('../models/product');
const SystemSettings = require('../models/systemSettings');

/**
 * Fresh Product Auto-Promotion Service
 * 
 * Automatically applies promotions to fresh products based on expiry date
 * Runs daily at configured time
 */
class FreshProductPromotionService {
  /**
   * Apply auto-promotion to eligible fresh product batches
   * This is the main function called by the scheduler
   * @returns {Promise<Object>} Result summary
   */
  static async applyAutoPromotions() {
    try {
      console.log('\n🌿 ======= FRESH PRODUCT AUTO-PROMOTION START =======');
      console.log(`⏰ Time: ${new Date().toLocaleString('vi-VN')}`);

      // Get settings
      const settings = await SystemSettings.getSettings();
      const promotionConfig = settings.freshProductPromotion;

      // Check if auto-promotion is enabled
      if (!promotionConfig.autoPromotionEnabled) {
        console.log('⏸️  Auto-promotion is DISABLED. Skipping...');
        return {
          success: false,
          message: 'Auto-promotion is disabled',
          applied: 0,
          removed: 0
        };
      }

      console.log('✅ Auto-promotion is ENABLED');
      console.log('📋 Configuration:', {
        promotionStartTime: promotionConfig.promotionStartTime,
        discountPercentage: promotionConfig.discountPercentage,
        applyToExpiringToday: promotionConfig.applyToExpiringToday,
        applyToExpiringTomorrow: promotionConfig.applyToExpiringTomorrow
      });

      // Find all fresh products
      const freshProducts = await Product.find({
        category: { $exists: true }
      }).populate('category');

      const freshProductIds = freshProducts
        .filter(p => p.category?.name?.toLowerCase() === 'fresh')
        .map(p => p._id);

      console.log(`\n🔍 Found ${freshProductIds.length} fresh products`);

      if (freshProductIds.length === 0) {
        console.log('⚠️  No fresh products found. Skipping...');
        return {
          success: true,
          message: 'No fresh products found',
          applied: 0,
          removed: 0
        };
      }

      // Calculate expiry date ranges
      const now = new Date();
      const ranges = this._calculateExpiryRanges(
        promotionConfig.applyToExpiringToday,
        promotionConfig.applyToExpiringTomorrow
      );

      console.log('\n📅 Expiry Date Ranges:');
      ranges.forEach(range => {
        console.log(`  - ${range.label}: ${range.start.toLocaleDateString('vi-VN')} to ${range.end.toLocaleDateString('vi-VN')}`);
      });

      // Find eligible batches
      const eligibleBatches = await this._findEligibleBatches(
        freshProductIds,
        ranges,
        now
      );

      console.log(`\n✨ Found ${eligibleBatches.length} eligible batches for promotion`);

      // Apply promotions
      const appliedResult = await this._applyPromotionsToBatches(
        eligibleBatches,
        promotionConfig.discountPercentage
      );

      // Remove promotions from expired batches
      const removedResult = await this._removeExpiredPromotions(freshProductIds, now);

      console.log('\n📊 Summary:');
      console.log(`  ✅ Applied promotions: ${appliedResult.count} batches`);
      console.log(`  ❌ Removed promotions: ${removedResult.count} batches`);
      console.log('🌿 ======= FRESH PRODUCT AUTO-PROMOTION END =======\n');

      return {
        success: true,
        message: 'Auto-promotion completed successfully',
        applied: appliedResult.count,
        removed: removedResult.count,
        appliedBatches: appliedResult.batches,
        removedBatches: removedResult.batches,
        timestamp: now
      };

    } catch (error) {
      console.error('❌ Error in applyAutoPromotions:', error);
      return {
        success: false,
        message: error.message,
        applied: 0,
        removed: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate expiry date ranges based on configuration
   * @private
   */
  static _calculateExpiryRanges(applyToExpiringToday, applyToExpiringTomorrow) {
    const now = new Date();
    const ranges = [];

    if (applyToExpiringToday) {
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      ranges.push({
        label: 'Expiring Today (within 24 hours)',
        start: now,
        end: in24Hours
      });
    }

    if (applyToExpiringTomorrow) {
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      ranges.push({
        label: 'Expiring Tomorrow (within 48 hours)',
        start: in24Hours,
        end: in48Hours
      });
    }

    return ranges;
  }

  /**
   * Find eligible batches for promotion
   * @private
   */
  static async _findEligibleBatches(freshProductIds, ranges, now) {
    const eligibleBatches = [];

    for (const range of ranges) {
      const batches = await ProductBatch.find({
        product: { $in: freshProductIds },
        status: 'active',
        expiryDate: {
          $gte: now, // Not expired yet
          $gte: range.start,
          $lte: range.end
        },
        quantity: { $gt: 0 } // Has quantity
      }).populate('product');

      console.log(`  📦 ${range.label}: ${batches.length} batches`);

      batches.forEach(batch => {
        console.log(`    - ${batch.batchCode} (${batch.product?.name}) - Expires: ${batch.expiryDate.toLocaleDateString('vi-VN')}`);
      });

      eligibleBatches.push(...batches);
    }

    return eligibleBatches;
  }

  /**
   * Apply promotions to eligible batches
   * @private
   */
  static async _applyPromotionsToBatches(batches, discountPercentage) {
    let appliedCount = 0;
    const appliedBatches = [];

    for (const batch of batches) {
      try {
        // Check if already has promotion with same or better discount
        if (batch.promotionApplied !== 'none') {
          if (batch.discountPercentage >= discountPercentage) {
            console.log(`    ⏭️  Batch ${batch.batchCode} already has ${batch.discountPercentage}% discount - skipping`);
            continue;
          }
          console.log(`    🔄 Batch ${batch.batchCode} has ${batch.discountPercentage}% discount - updating to ${discountPercentage}%`);
        }

        // Apply promotion
        batch.promotionApplied = 'discount';
        batch.discountPercentage = discountPercentage;
        await batch.save();

        // Calculate prices using unitPrice from model
        const originalPrice = parseFloat(batch.unitPrice?.toString() || batch.unitPrice || 0);
        const discountedPrice = originalPrice * (1 - discountPercentage / 100);

        appliedBatches.push({
          batchCode: batch.batchCode,
          productName: batch.product?.name || 'Unknown',
          originalPrice,
          discountedPrice,
          discountPercentage,
          quantity: batch.quantity,
          expiryDate: batch.expiryDate
        });

        console.log(`    ✅ Applied ${discountPercentage}% discount to batch ${batch.batchCode}`);
        appliedCount++;
      } catch (error) {
        console.error(`    ❌ Error applying promotion to batch ${batch.batchCode}:`, error.message);
      }
    }

    return { count: appliedCount, batches: appliedBatches };
  }

  /**
   * Remove promotions from expired batches
   * @private
   */
  static async _removeExpiredPromotions(freshProductIds, now) {
    try {
      console.log('\n🗑️  Checking for expired batches with promotions...');

      // Find expired batches that still have promotions
      const expiredBatches = await ProductBatch.find({
        product: { $in: freshProductIds },
        expiryDate: { $lt: now },
        promotionApplied: { $ne: 'none' }
      }).populate('product');

      console.log(`  Found ${expiredBatches.length} expired batches with promotions`);

      let removedCount = 0;
      const removedBatches = [];

      for (const batch of expiredBatches) {
        try {
          removedBatches.push({
            batchCode: batch.batchCode,
            productName: batch.product?.name || 'Unknown',
            expiryDate: batch.expiryDate
          });

          batch.promotionApplied = 'none';
          batch.discountPercentage = 0;
          batch.status = 'expired'; // Also update status
          await batch.save();

          console.log(`    ❌ Removed promotion from expired batch ${batch.batchCode}`);
          removedCount++;
        } catch (error) {
          console.error(`    ❌ Error removing promotion from batch ${batch.batchCode}:`, error.message);
        }
      }

      return { count: removedCount, batches: removedBatches };
    } catch (error) {
      console.error('❌ Error in _removeExpiredPromotions:', error);
      return 0;
    }
  }

  /**
   * Run manual promotion (for testing or manual trigger)
   * @returns {Promise<Object>} Result summary
   */
  static async runManualPromotion() {
    console.log('🔧 MANUAL TRIGGER - Running fresh product auto-promotion...');
    return await this.applyAutoPromotions();
  }

  /**
   * Get promotion statistics
   * @returns {Promise<Object>} Statistics
   */
  static async getPromotionStats() {
    try {
      // Find all fresh products
      const freshProducts = await Product.find({
        category: { $exists: true }
      }).populate('category');

      const freshProductIds = freshProducts
        .filter(p => p.category?.name?.toLowerCase() === 'fresh')
        .map(p => p._id);

      // Get batches with promotions
      const batchesWithPromotion = await ProductBatch.find({
        product: { $in: freshProductIds },
        status: 'active',
        promotionApplied: { $ne: 'none' }
      });

      // Get batches expiring soon (within 48 hours)
      const now = new Date();
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const batchesExpiringSoon = await ProductBatch.find({
        product: { $in: freshProductIds },
        status: 'active',
        expiryDate: {
          $gte: now,
          $lte: in48Hours
        }
      });

      // Get expired batches
      const expiredBatches = await ProductBatch.find({
        product: { $in: freshProductIds },
        expiryDate: { $lt: now }
      });

      return {
        totalFreshProducts: freshProductIds.length,
        activeBatchesWithPromotion: batchesWithPromotion.length,
        batchesExpiringSoon: batchesExpiringSoon.length,
        expiredBatches: expiredBatches.length,
        timestamp: now
      };
    } catch (error) {
      console.error('Error getting promotion stats:', error);
      return null;
    }
  }
}

module.exports = FreshProductPromotionService;
