const mongoose = require('mongoose')
const Role = require('../models/role')
const config = require('../utils/config')

// Định nghĩa các roles mặc định
const defaultRoles = [
  {
    roleName: 'Administrator',
    description: 'Quản trị viên hệ thống - Có toàn quyền truy cập và quản lý',
    permissions: [
      // Quản lý nhân viên
      'manage_employees',
      'view_employees',
      'create_employee',
      'update_employee',
      'delete_employee',

      // Quản lý roles
      'manage_roles',
      'view_roles',
      'create_role',
      'update_role',
      'delete_role',

      // Quản lý sản phẩm
      'manage_products',
      'view_products',
      'create_product',
      'update_product',
      'delete_product',

      // Quản lý đơn hàng
      'manage_orders',
      'view_orders',
      'create_order',
      'update_order',
      'delete_order',
      'approve_order',
      'cancel_order',

      // Quản lý khách hàng
      'manage_customers',
      'view_customers',
      'create_customer',
      'update_customer',
      'delete_customer',

      // Quản lý nhà cung cấp
      'manage_suppliers',
      'view_suppliers',
      'create_supplier',
      'update_supplier',
      'delete_supplier',

      // Quản lý kho
      'manage_inventory',
      'view_inventory',
      'update_inventory',
      'view_inventory_movements',

      // Quản lý đơn mua hàng
      'manage_purchase_orders',
      'view_purchase_orders',
      'create_purchase_order',
      'update_purchase_order',
      'delete_purchase_order',
      'approve_purchase_order',

      // Quản lý thanh toán
      'manage_payments',
      'view_payments',
      'create_payment',
      'update_payment',
      'delete_payment',

      // Xem báo cáo
      'view_reports',
      'view_financial_reports',
      'view_sales_reports',
      'view_inventory_reports',

      // Quản lý danh mục
      'manage_categories',
      'view_categories',
      'create_category',
      'update_category',
      'delete_category',

      // Quản lý phòng ban
      'manage_departments',
      'view_departments',
      'create_department',
      'update_department',
      'delete_department',

      // Cấu hình hệ thống
      'manage_system_settings',
      'view_system_logs'
    ]
  },
  {
    roleName: 'Manager',
    description: 'Quản lý - Quản lý vận hành và nhân viên',
    permissions: [
      // Xem nhân viên
      'view_employees',
      'update_employee',

      // Quản lý sản phẩm
      'view_products',
      'create_product',
      'update_product',

      // Quản lý đơn hàng
      'manage_orders',
      'view_orders',
      'create_order',
      'update_order',
      'approve_order',
      'cancel_order',

      // Quản lý khách hàng
      'view_customers',
      'create_customer',
      'update_customer',

      // Quản lý nhà cung cấp
      'view_suppliers',
      'create_supplier',
      'update_supplier',

      // Quản lý kho
      'view_inventory',
      'update_inventory',
      'view_inventory_movements',

      // Quản lý đơn mua hàng
      'view_purchase_orders',
      'create_purchase_order',
      'update_purchase_order',
      'approve_purchase_order',

      // Quản lý thanh toán
      'view_payments',
      'create_payment',
      'update_payment',

      // Xem báo cáo
      'view_reports',
      'view_financial_reports',
      'view_sales_reports',
      'view_inventory_reports',

      // Quản lý danh mục
      'view_categories',
      'create_category',
      'update_category'
    ]
  },
  {
    roleName: 'Sales',
    description: 'Nhân viên bán hàng - Xử lý đơn hàng và khách hàng',
    permissions: [
      // Xem sản phẩm
      'view_products',

      // Quản lý đơn hàng
      'view_orders',
      'create_order',
      'update_order',

      // Quản lý khách hàng
      'view_customers',
      'create_customer',
      'update_customer',

      // Xem kho
      'view_inventory',

      // Xem thanh toán
      'view_payments',
      'create_payment',

      // Xem báo cáo bán hàng
      'view_sales_reports',

      // Xem danh mục
      'view_categories'
    ]
  }
]

async function setupRoles() {
  try {
    console.log('🔗 Connecting to MongoDB...')
    await mongoose.connect(config.MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    console.log('\n📋 Setting up default roles...\n')

    for (const roleData of defaultRoles) {
      // Kiểm tra xem role đã tồn tại chưa
      const existingRole = await Role.findOne({ roleName: roleData.roleName })

      if (existingRole) {
        console.log(`⚠️  Role "${roleData.roleName}" already exists. Updating permissions...`)

        // Cập nhật permissions và description
        existingRole.description = roleData.description
        existingRole.permissions = roleData.permissions
        await existingRole.save()

        console.log(`✅ Updated role: ${existingRole.roleName} (${existingRole.roleCode})`)
        console.log(`   - Description: ${existingRole.description}`)
        console.log(`   - Permissions: ${existingRole.permissions.length} permissions`)
      } else {
        // Tạo role mới
        const newRole = new Role({
          roleName: roleData.roleName,
          description: roleData.description,
          permissions: roleData.permissions
        })

        await newRole.save()
        console.log(`✅ Created role: ${newRole.roleName} (${newRole.roleCode})`)
        console.log(`   - Description: ${newRole.description}`)
        console.log(`   - Permissions: ${newRole.permissions.length} permissions`)
      }
      console.log('') // Dòng trống để dễ đọc
    }

    console.log('🎉 All roles have been set up successfully!\n')

    // Hiển thị tổng quan
    const allRoles = await Role.find().sort({ roleCode: 1 })
    console.log('📊 Summary of all roles:')
    console.log('┌─────────────┬──────────────────┬─────────────┐')
    console.log('│ Role Code   │ Role Name        │ Permissions │')
    console.log('├─────────────┼──────────────────┼─────────────┤')
    allRoles.forEach(role => {
      console.log(`│ ${role.roleCode.padEnd(11)} │ ${role.roleName.padEnd(16)} │ ${String(role.permissions.length).padStart(11)} │`)
    })
    console.log('└─────────────┴──────────────────┴─────────────┘')

  } catch (error) {
    console.error('❌ Error setting up roles:', error.message)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('\n🔌 Disconnected from MongoDB')
    process.exit(0)
  }
}

// Chạy script
setupRoles()
