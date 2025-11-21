# Employee Authentication Pattern

## Mục đích
Hướng dẫn cách lấy thông tin Employee hiện tại từ User đang đăng nhập để sử dụng trong các component cần trường `createdBy`, `performedBy`, hoặc các trường tham chiếu Employee khác.

## Pattern được sử dụng trong TransferStockBulkModal

### 1. Import các service cần thiết

```javascript
import authService from '../../services/authService';
import employeeService from '../../services/employeeService';
```

### 2. Khai báo state

```javascript
const [currentUser, setCurrentUser] = useState(null);
const [currentEmployee, setCurrentEmployee] = useState(null);
const [formData, setFormData] = useState({
  // ... other fields
  performedBy: '', // Hoặc createdBy
});
```

### 3. Fetch data trong useEffect

```javascript
useEffect(() => {
  if (isOpen) {
    fetchEmployeeData();
  }
}, [isOpen]);

const fetchEmployeeData = async () => {
  try {
    setLoading(true);

    // Bước 1: Lấy current user từ authService
    const user = authService.getUser();
    setCurrentUser(user);

    // Bước 2: Nếu user có employeeId, fetch thông tin employee
    if (user?.employeeId) {
      const employeeResponse = await employeeService.getEmployeeById(user.employeeId);
      
      if (employeeResponse.success && employeeResponse.data) {
        const employee = employeeResponse.data.employee;
        setCurrentEmployee(employee);
        
        // Bước 3: Set employeeId vào formData
        setFormData(prev => ({
          ...prev,
          performedBy: user.employeeId // Sử dụng _id của employee
        }));
      }
    }
  } catch (err) {
    console.error('Error fetching employee:', err);
  } finally {
    setLoading(false);
  }
};
```

### 4. Hiển thị trong form

```javascript
<div>
  <label className="block text-[13px] font-semibold text-[#212529] mb-2">
    Performed By
  </label>
  <input
    type="text"
    value={currentEmployee?.fullName || currentUser?.username || 'N/A'}
    disabled
    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-[13px] bg-gray-100 text-gray-600 cursor-not-allowed"
  />
  <p className="text-[11px] text-gray-500 mt-1">Current logged in employee</p>
</div>
```

### 5. Gửi data đến backend

```javascript
const handleSubmit = async () => {
  try {
    const requestData = {
      // ... other fields
      performedBy: formData.performedBy, // EmployeeId (ObjectId)
      // Backend sẽ validate và populate employee info
    };

    await someService.create(requestData);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## Các trường hợp sử dụng

### 1. Order Creation (createdBy)
```javascript
// AddOrderModal.jsx
const [currentEmployee, setCurrentEmployee] = useState(null);

useEffect(() => {
  if (isOpen) {
    const user = authService.getUser();
    if (user?.employeeId) {
      fetchEmployee(user.employeeId);
    }
  }
}, [isOpen]);

const fetchEmployee = async (employeeId) => {
  const response = await employeeService.getEmployeeById(employeeId);
  if (response.success) {
    setCurrentEmployee(response.data.employee);
  }
};

// Trong handleSubmit
const orderData = {
  customer: formData.customerId,
  createdBy: currentEmployee?._id, // Employee ObjectId
  // ... other fields
};
```

### 2. Inventory Movement (performedBy)
```javascript
// TransferStockModal.jsx - Pattern tương tự TransferStockBulkModal
const movementData = {
  performedBy: currentEmployee?._id,
  date: formData.date,
  // ... other fields
};
```

### 3. Purchase Order (approvedBy, createdBy)
```javascript
// PurchaseOrderModal.jsx
const poData = {
  createdBy: currentEmployee?._id,
  approvedBy: formData.approvedById, // Có thể chọn employee khác
  // ... other fields
};
```

## Backend xử lý

Backend controller thường có logic:

```javascript
// Validate employee if provided
let validatedCreatedBy = createdBy;
if (createdBy) {
  const employeeExists = await Employee.findById(createdBy);
  if (!employeeExists) {
    return response.status(404).json({
      success: false,
      error: {
        message: 'Employee not found',
        code: 'EMPLOYEE_NOT_FOUND'
      }
    });
  }
} else {
  // Fallback: tìm employee active đầu tiên
  const systemEmployee = await Employee.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!systemEmployee) {
    return response.status(400).json({
      success: false,
      error: {
        message: 'No active employee found',
        code: 'NO_EMPLOYEE_FOUND'
      }
    });
  }
  validatedCreatedBy = systemEmployee._id;
}
```

## Best Practices

### ✅ DO
- Luôn lấy employee từ `authService.getUser()` để đảm bảo đúng người đang đăng nhập
- Fetch thông tin employee đầy đủ để hiển thị `fullName`
- Set `employeeId` vào formData ngay khi fetch xong
- Disable input field hiển thị employee (read-only)
- Có fallback hiển thị `username` nếu không có employee

### ❌ DON'T
- Không hardcode employeeId
- Không cho phép user chọn employee khác (trừ trường hợp đặc biệt như `approvedBy`)
- Không gửi `fullName` mà phải gửi `employeeId` (ObjectId reference)
- Không quên validate employee existence trên backend

## Checklist khi implement

- [ ] Import `authService` và `employeeService`
- [ ] Khai báo state `currentUser` và `currentEmployee`
- [ ] Fetch employee trong `useEffect` khi modal/component mở
- [ ] Set `employeeId` vào formData field (`createdBy`, `performedBy`, etc.)
- [ ] Hiển thị `fullName` của employee trong UI (disabled input)
- [ ] Gửi `employeeId` (ObjectId) đến backend, không phải `fullName`
- [ ] Backend validate employee existence
- [ ] Backend có fallback tìm system employee nếu cần

## Error Handling

```javascript
const fetchEmployee = async (employeeId) => {
  try {
    const response = await employeeService.getEmployeeById(employeeId);
    
    if (!response.success) {
      console.warn('Employee not found, user may not be linked to employee');
      // Có thể cho phép tiếp tục hoặc show warning
      return;
    }
    
    setCurrentEmployee(response.data.employee);
    setFormData(prev => ({
      ...prev,
      createdBy: employeeId
    }));
  } catch (error) {
    console.error('Error fetching employee:', error);
    setErrors(prev => ({
      ...prev,
      employee: 'Failed to load employee information'
    }));
  }
};
```

## Tham khảo

- **TransferStockBulkModal.jsx**: Implementation đầy đủ với `performedBy`
- **Backend controller orders.js**: Pattern validate employee
- **authService.js**: Method `getUser()` để lấy current user
- **employeeService.js**: Method `getEmployeeById()` để fetch employee details
