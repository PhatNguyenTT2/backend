const mongoose = require('mongoose')
const Department = require('../models/department')
const config = require('../utils/config')

// Định nghĩa các departments mặc định
const defaultDepartments = [
  {
    departmentName: 'Administrator',
    description: 'Phòng Quản trị - Chịu trách nhiệm quản lý toàn bộ hệ thống, cấu hình, và giám sát hoạt động của công ty',
    location: 'Tầng 5 - Tòa nhà A',
    phone: '0283456789',
    email: 'admin@company.com',
    isActive: true
  },
  {
    departmentName: 'Sales',
    description: 'Phòng Kinh doanh - Chịu trách nhiệm bán hàng, chăm sóc khách hàng, và phát triển thị trường',
    location: 'Tầng 3 - Tòa nhà A',
    phone: '0283456790',
    email: 'sales@company.com',
    isActive: true
  },
  {
    departmentName: 'Inventory',
    description: 'Phòng Kho vận - Chịu trách nhiệm quản lý kho, nhập xuất hàng, và kiểm soát tồn kho',
    location: 'Tầng 1 - Tòa nhà B',
    phone: '0283456791',
    email: 'inventory@company.com',
    isActive: true
  }
]

async function setupDepartments() {
  try {
    console.log('🔗 Connecting to MongoDB...')
    await mongoose.connect(config.MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    console.log('\n🏢 Setting up default departments...\n')

    for (const deptData of defaultDepartments) {
      // Kiểm tra xem department đã tồn tại chưa
      const existingDept = await Department.findOne({
        departmentName: deptData.departmentName
      })

      if (existingDept) {
        console.log(`⚠️  Department "${deptData.departmentName}" already exists. Updating information...`)

        // Cập nhật thông tin department
        existingDept.description = deptData.description
        existingDept.location = deptData.location
        existingDept.phone = deptData.phone
        existingDept.email = deptData.email
        existingDept.isActive = deptData.isActive
        await existingDept.save()

        console.log(`✅ Updated department: ${existingDept.departmentName} (${existingDept.departmentCode})`)
        console.log(`   - Description: ${existingDept.description}`)
        console.log(`   - Location: ${existingDept.location}`)
        console.log(`   - Phone: ${existingDept.phone}`)
        console.log(`   - Email: ${existingDept.email}`)
        console.log(`   - Status: ${existingDept.isActive ? '✅ Active' : '❌ Inactive'}`)
      } else {
        // Tạo department mới
        const newDept = new Department({
          departmentName: deptData.departmentName,
          description: deptData.description,
          location: deptData.location,
          phone: deptData.phone,
          email: deptData.email,
          isActive: deptData.isActive
        })

        await newDept.save()
        console.log(`✅ Created department: ${newDept.departmentName} (${newDept.departmentCode})`)
        console.log(`   - Description: ${newDept.description}`)
        console.log(`   - Location: ${newDept.location}`)
        console.log(`   - Phone: ${newDept.phone}`)
        console.log(`   - Email: ${newDept.email}`)
        console.log(`   - Status: ${newDept.isActive ? '✅ Active' : '❌ Inactive'}`)
      }
      console.log('') // Dòng trống để dễ đọc
    }

    console.log('🎉 All departments have been set up successfully!\n')

    // Hiển thị tổng quan
    const allDepartments = await Department.find().sort({ departmentCode: 1 })
    console.log('📊 Summary of all departments:')
    console.log('┌──────────────┬──────────────────┬────────────────────────┬───────────────┬────────┐')
    console.log('│ Dept Code    │ Department Name  │ Location               │ Phone         │ Status │')
    console.log('├──────────────┼──────────────────┼────────────────────────┼───────────────┼────────┤')
    allDepartments.forEach(dept => {
      const status = dept.isActive ? '✅' : '❌'
      const location = dept.location ? dept.location.padEnd(22).substring(0, 22) : '-'.padEnd(22)
      const phone = dept.phone || '-'
      console.log(`│ ${dept.departmentCode.padEnd(12)} │ ${dept.departmentName.padEnd(16)} │ ${location} │ ${phone.padEnd(13)} │ ${status.padEnd(6)} │`)
    })
    console.log('└──────────────┴──────────────────┴────────────────────────┴───────────────┴────────┘')

    // Hiển thị thống kê
    console.log('\n📈 Statistics:')
    const stats = await Department.getStatistics()
    console.log(`   - Total departments: ${stats.totalDepartments}`)
    console.log(`   - Active departments: ${stats.activeDepartments}`)
    console.log(`   - Inactive departments: ${stats.inactiveDepartments}`)
    console.log(`   - Departments with manager: ${stats.departmentsWithManager}`)

  } catch (error) {
    console.error('❌ Error setting up departments:', error.message)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('\n🔌 Disconnected from MongoDB')
    process.exit(0)
  }
}

// Chạy script
setupDepartments()
