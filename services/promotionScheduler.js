const cron = require('node-cron');
const FreshProductPromotionService = require('./freshProductPromotionService');
const SystemSettings = require('../models/systemSettings');

/**
 * Promotion Scheduler
 * Manages scheduled jobs for fresh product auto-promotion
 */
class PromotionScheduler {
  constructor() {
    this.job = null;
    this.currentSchedule = null;
  }

  /**
   * Initialize and start the scheduler
   * Reads settings from database and creates cron job
   */
  async init() {
    try {
      console.log('🚀 Initializing Fresh Product Promotion Scheduler...');

      // Get settings
      const settings = await SystemSettings.getSettings();
      const promotionConfig = settings.freshProductPromotion;

      if (!promotionConfig.autoPromotionEnabled) {
        console.log('⏸️  Auto-promotion is DISABLED in settings');
        return;
      }

      // Parse time (format: "HH:MM")
      const [hours, minutes] = promotionConfig.promotionStartTime.split(':').map(Number);

      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.error('❌ Invalid promotion start time:', promotionConfig.promotionStartTime);
        return;
      }

      // Create cron schedule: "minutes hours * * *" (every day at specified time)
      const cronSchedule = `${minutes} ${hours} * * *`;
      this.currentSchedule = cronSchedule;

      console.log(`⏰ Scheduling auto-promotion to run daily at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      console.log(`📅 Cron expression: ${cronSchedule}`);

      // Create cron job
      this.job = cron.schedule(cronSchedule, async () => {
        console.log('\n⏰ SCHEDULED JOB TRIGGERED');
        await FreshProductPromotionService.applyAutoPromotions();
      }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh' // Vietnam timezone
      });

      console.log('✅ Promotion scheduler started successfully');

      // Show stats
      const stats = await FreshProductPromotionService.getPromotionStats();
      if (stats) {
        console.log('\n📊 Current Stats:');
        console.log(`  - Fresh products: ${stats.totalFreshProducts}`);
        console.log(`  - Active batches with promotion: ${stats.activeBatchesWithPromotion}`);
        console.log(`  - Batches expiring soon (48h): ${stats.batchesExpiringSoon}`);
        console.log(`  - Expired batches: ${stats.expiredBatches}`);
      }

    } catch (error) {
      console.error('❌ Error initializing promotion scheduler:', error);
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.job) {
      this.job.stop();
      console.log('⏸️  Promotion scheduler stopped');
    }
  }

  /**
   * Restart the scheduler with new settings
   */
  async restart() {
    console.log('🔄 Restarting promotion scheduler...');
    this.stop();
    await this.init();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.job !== null,
      currentSchedule: this.currentSchedule,
      timezone: 'Asia/Ho_Chi_Minh'
    };
  }

  /**
   * Run promotion immediately (manual trigger)
   */
  async runNow() {
    console.log('🔧 Manual trigger requested...');
    return await FreshProductPromotionService.runManualPromotion();
  }
}

// Create singleton instance
const promotionScheduler = new PromotionScheduler();

module.exports = promotionScheduler;
