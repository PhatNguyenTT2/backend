# POS Main Interface - User Guide

## Tổng quan
Giao diện chính của hệ thống Point of Sale (POS) cho phép nhân viên bán hàng thực hiện các giao dịch nhanh chóng và hiệu quả.

## Các thay đổi đã thực hiện

### 1. ✅ Sửa lỗi Import Service
**Trước:**
```javascript
import posAuthService from '../../services/posAuthService';
```

**Sau:**
```javascript
import posLoginService from '../../services/posLoginService';
```

### 2. ✅ Cải thiện Session Management

#### Auto-verification khi load
- Kiểm tra token trong localStorage
- Xác thực session với backend
- Tự động redirect về login nếu session không hợp lệ
- Hiển thị loading screen trong khi verify

#### Periodic session check
- Tự động verify session mỗi 5 phút
- Alert người dùng nếu session hết hạn
- Redirect về login page khi session không còn valid

### 3. ✅ Sửa lỗi Logout
**Trước:** Logout không hoạt động đúng
```javascript
try {
  await posAuthService.logout();
} catch (error) {
  console.error('Logout error:', error);
} finally {
  navigate('/pos-login');
}
```

**Sau:** Logout đúng cách với error handling
```javascript
try {
  await posLoginService.logout();
  navigate('/pos-login');
} catch (error) {
  console.error('Logout error:', error);
  // Navigate to login even if logout API fails
  navigate('/pos-login');
}
```

### 4. ✅ Hiển thị thông tin Employee đúng

**Trước:**
```javascript
{currentEmployee?.name} ({currentEmployee?.code})
```

**Sau:**
```javascript
{currentEmployee?.fullName || 'Employee'} ({currentEmployee?.userCode || 'N/A'})
```

Thêm badge hiển thị role:
```javascript
{currentEmployee?.role && (
  <span className="ml-2 px-2 py-0.5 bg-emerald-500 rounded text-[10px] font-semibold">
    {currentEmployee.role}
  </span>
)}
```

### 5. ✅ Real-time Clock
- Đồng hồ cập nhật mỗi giây
- Hiển thị ngày tháng năm đầy đủ
- Hiển thị giờ, phút, giây

### 6. ✅ Loading State
- Hiển thị spinner khi đang load
- Thông báo "Loading POS..." rõ ràng
- Không hiển thị UI nếu chưa xác thực xong

### 7. ✅ Keyboard Shortcuts

| Phím tắt | Chức năng |
|----------|-----------|
| `Ctrl/Cmd + K` | Focus vào ô tìm kiếm sản phẩm |
| `F2` | Focus vào ô tìm kiếm sản phẩm |
| `Ctrl/Cmd + L` | Logout |
| `Ctrl/Cmd + Delete` | Xóa toàn bộ giỏ hàng |
| `F9` | Tiến hành thanh toán |
| `Esc` | Đóng modal thanh toán |

### 8. ✅ UX Improvements

#### Search với icon
- Thêm icon kính lúp vào search box
- Placeholder có hướng dẫn phím tắt
- Focus state rõ ràng

#### Payment button
- Hiển thị phím tắt (F9) trên button
- Disabled state khi giỏ hàng trống

#### Error handling
- Alert khi session hết hạn
- Confirm dialog khi logout với giỏ hàng có sản phẩm
- Confirm dialog khi clear cart

## Cấu trúc Component

### State Management
```javascript
const [products, setProducts] = useState([]);           // Danh sách sản phẩm
const [categories, setCategories] = useState([]);       // Danh mục
const [selectedCategory, setSelectedCategory] = useState('all');
const [searchTerm, setSearchTerm] = useState('');      // Từ khóa tìm kiếm
const [cart, setCart] = useState([]);                  // Giỏ hàng
const [showPaymentModal, setShowPaymentModal] = useState(false);
const [currentEmployee, setCurrentEmployee] = useState(null);
const [currentTime, setCurrentTime] = useState(new Date());
const [loading, setLoading] = useState(true);          // Loading state
```

### Core Functions

#### Authentication
```javascript
checkAuth()         // Xác thực session khi load
handleLogout()      // Xử lý logout
```

#### Cart Management
```javascript
addToCart(product)               // Thêm sản phẩm vào giỏ
updateQuantity(id, quantity)     // Cập nhật số lượng
removeFromCart(id)               // Xóa sản phẩm
clearCart()                      // Xóa toàn bộ giỏ
calculateTotals()                // Tính tổng tiền
```

#### Product Filtering
```javascript
filteredProducts    // Lọc sản phẩm theo category và search
```

## Flow hoạt động

### 1. Khởi tạo
```
Component Mount
    ↓
Check localStorage token
    ↓
Verify session với API
    ↓
Load employee info
    ↓
Set loading = false
    ↓
Render UI
```

### 2. Periodic Verification
```
Every 5 minutes
    ↓
Verify session
    ↓
If invalid → Alert + Redirect to login
```

### 3. Logout Flow
```
Click logout button
    ↓
Check if cart has items
    ↓
Confirm dialog (if cart not empty)
    ↓
Call logout API
    ↓
Clear localStorage
    ↓
Navigate to /pos-login
```

## Tích hợp API (Future)

### Products API
Thay thế mock data bằng API calls:
```javascript
useEffect(() => {
  const loadProducts = async () => {
    try {
      const response = await api.get('/products', {
        headers: posLoginService.getAuthHeader()
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };
  
  loadProducts();
}, []);
```

### Categories API
```javascript
useEffect(() => {
  const loadCategories = async () => {
    try {
      const response = await api.get('/categories', {
        headers: posLoginService.getAuthHeader()
      });
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };
  
  loadCategories();
}, []);
```

## Security Features

1. **Session Validation**
   - Verify token on mount
   - Periodic re-verification
   - Auto-logout on session expiry

2. **Protected Routes**
   - Redirect to login if not authenticated
   - Check localStorage before API call
   - Clear storage on logout

3. **User Context**
   - Display current user info
   - Show role badge
   - Track user actions (future)

## Best Practices

### 1. Always check authentication
```javascript
if (!posLoginService.isLoggedIn()) {
  navigate('/pos-login');
  return;
}
```

### 2. Handle errors gracefully
```javascript
try {
  await posLoginService.verifySession();
} catch (error) {
  console.error('Error:', error);
  navigate('/pos-login');
}
```

### 3. Confirm destructive actions
```javascript
if (!window.confirm('Are you sure?')) {
  return;
}
```

## Troubleshooting

### Issue: Session keeps expiring
**Solution:** Check JWT token expiry time in backend (currently 12h)

### Issue: Logout doesn't work
**Solution:** 
- Verify `posLoginService.logout()` is being called
- Check if API endpoint `/api/pos-login/logout` is accessible
- localStorage should be cleared even if API fails

### Issue: Employee info not displaying
**Solution:**
- Verify token is stored in localStorage
- Check API response format matches expected structure
- Console log `currentEmployee` state

### Issue: Keyboard shortcuts not working
**Solution:**
- Check if event listeners are properly attached
- Verify no input fields are focused (except search)
- Check browser console for errors

## Next Steps

1. **Payment Processing**
   - Implement actual payment methods
   - Receipt printing
   - Payment history

2. **Inventory Management**
   - Real-time stock updates
   - Low stock warnings
   - Automatic reordering

3. **Reporting**
   - Sales reports
   - Employee performance
   - Daily/Weekly/Monthly summaries

4. **Offline Mode**
   - Cache products for offline use
   - Queue transactions when offline
   - Sync when connection restored

5. **Customer Management**
   - Customer lookup
   - Loyalty points
   - Purchase history

## Version History

- **v1.1** (Current)
  - ✅ Fixed logout functionality
  - ✅ Added session verification
  - ✅ Added keyboard shortcuts
  - ✅ Added loading states
  - ✅ Real-time clock
  - ✅ Better error handling

- **v1.0** (Initial)
  - Basic POS interface
  - Cart management
  - Product filtering
  - Mock data
