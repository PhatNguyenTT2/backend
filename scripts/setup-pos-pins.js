const mongoose = require('mongoose');
const config = require('../utils/config');
const logger = require('../utils/logger');
const Employee = require('../models/employee');
const UserAccount = require('../models/userAccount');
const posAuthService = require('../services/posAuthService');

/**
 * Setup POS PIN cho tất cả employees có role Sales Staff hoặc Cashier
 * Default PIN: 1234 (user phải đổi sau lần đầu login)
 */
const setupPOSPins = async () => {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    logger.info('Connected to MongoDB');

    logger.info('\n🔐 Setting up POS PINs for employees...\n');

    // Tìm tất cả roles có quyền POS
    const Role = require('../models/role');
    const posRoles = await Role.find({ canAccessPOS: true });

    if (posRoles.length === 0) {
      logger.warn('No roles with POS access found. Please run setup-complete-roles.js first.');
      return;
    }

    logger.info(`Found ${posRoles.length} roles with POS access:`);
    posRoles.forEach(role => {
      logger.info(`  - ${role.roleName} (Level ${role.level})`);
    });

    const posRoleIds = posRoles.map(r => r._id);

    // Tìm tất cả user accounts với POS roles
    const userAccounts = await UserAccount.find({
      role: { $in: posRoleIds },
      isActive: true
    }).populate('role', 'roleName canAccessPOS');

    logger.info(`\nFound ${userAccounts.length} active user accounts with POS access\n`);

    if (userAccounts.length === 0) {
      logger.warn('No employees found with POS roles. Create some employees first.');
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const userAccount of userAccounts) {
      try {
        // Find employee
        const employee = await Employee.findOne({ userAccount: userAccount._id });

        if (!employee) {
          logger.warn(`  ⚠️  No employee profile for ${userAccount.username}`);
          skipCount++;
          continue;
        }

        // Check if PIN already exists
        const authStatus = await posAuthService.getPOSAuthStatus(employee._id);

        if (authStatus.hasAuth) {
          logger.info(`  ⏭️  ${userAccount.userCode} - ${employee.fullName} (${userAccount.role.roleName}): Already has PIN`);
          skipCount++;
          continue;
        }

        // Setup default PIN: 1234
        const defaultPin = '1234';
        await posAuthService.setPosPin(employee._id, defaultPin);

        logger.info(`  ✅ ${userAccount.userCode} - ${employee.fullName} (${userAccount.role.roleName}): PIN setup successful`);
        successCount++;

      } catch (error) {
        logger.error(`  ❌ ${userAccount.userCode}: ${error.message}`);
        errorCount++;
      }
    }

    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('📊 Setup Summary:');
    logger.info(`   ✅ Success: ${successCount}`);
    logger.info(`   ⏭️  Skipped: ${skipCount}`);
    logger.info(`   ❌ Errors:  ${errorCount}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (successCount > 0) {
      logger.info('\n⚠️  IMPORTANT: All new PINs are set to 1234');
      logger.info('   Users MUST change their PIN on first login\n');
    }

  } catch (error) {
    logger.error('Error setting up POS PINs:', error.message);
  } finally {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  }
};

/**
 * Setup PIN cho một employee cụ thể
 */
const setupPinForEmployee = async (employeeCode, customPin = '1234') => {
  try {
    await mongoose.connect(config.MONGODB_URI);

    // Find user account
    const userAccount = await UserAccount.findOne({
      userCode: employeeCode,
      isActive: true
    }).populate('role', 'roleName canAccessPOS');

    if (!userAccount) {
      logger.error(`Employee code ${employeeCode} not found or inactive`);
      return;
    }

    if (!userAccount.role.canAccessPOS) {
      logger.error(`Employee ${employeeCode} does not have POS access (Role: ${userAccount.role.roleName})`);
      return;
    }

    // Find employee
    const employee = await Employee.findOne({ userAccount: userAccount._id });

    if (!employee) {
      logger.error(`No employee profile found for ${employeeCode}`);
      return;
    }

    // Setup PIN
    await posAuthService.setPosPin(employee._id, customPin);

    logger.info(`✅ PIN setup successful for ${employeeCode} - ${employee.fullName}`);
    logger.info(`   PIN: ${customPin}`);

  } catch (error) {
    logger.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
};

/**
 * Reset PIN cho employee (admin function)
 */
const resetEmployeePin = async (employeeCode) => {
  try {
    await mongoose.connect(config.MONGODB_URI);

    // Find user account
    const userAccount = await UserAccount.findOne({
      userCode: employeeCode
    });

    if (!userAccount) {
      logger.error(`Employee code ${employeeCode} not found`);
      return;
    }

    // Find employee
    const employee = await Employee.findOne({ userAccount: userAccount._id });

    if (!employee) {
      logger.error(`No employee profile found for ${employeeCode}`);
      return;
    }

    // Reset to default PIN
    const defaultPin = '1234';
    await posAuthService.setPosPin(employee._id, defaultPin);

    // Reset failed attempts
    await posAuthService.resetFailedAttempts(employee._id);

    logger.info(`✅ PIN reset successful for ${employeeCode} - ${employee.fullName}`);
    logger.info(`   New PIN: ${defaultPin}`);
    logger.info(`   Failed attempts cleared`);
    logger.info(`   ⚠️  User must change PIN on next login`);

  } catch (error) {
    logger.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
};

// Run based on command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'setup-all') {
  // Setup all employees
  setupPOSPins();
} else if (command === 'setup' && args[1]) {
  // Setup specific employee: node setup-pos-pins.js setup USER2025000001 [custom-pin]
  const employeeCode = args[1];
  const customPin = args[2] || '1234';
  setupPinForEmployee(employeeCode, customPin);
} else if (command === 'reset' && args[1]) {
  // Reset employee PIN: node setup-pos-pins.js reset USER2025000001
  const employeeCode = args[1];
  resetEmployeePin(employeeCode);
} else {
  logger.info('Usage:');
  logger.info('  npm run setup:pos-pins              - Setup PINs for all employees');
  logger.info('  node scripts/setup-pos-pins.js setup-all');
  logger.info('  node scripts/setup-pos-pins.js setup USER2025000001 [custom-pin]');
  logger.info('  node scripts/setup-pos-pins.js reset USER2025000001');
  process.exit(0);
}
