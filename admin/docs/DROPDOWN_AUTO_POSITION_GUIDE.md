# Dropdown Auto-Position Guide

## Vấn đề

Khi dropdown menu hiển thị ở cuối trang hoặc gần rìa màn hình, nó sẽ bị cắt (overflow) và người dùng không thể nhìn thấy hoặc click vào các options.

## Giải pháp: Auto-Adjust Position

Tự động điều chỉnh vị trí dropdown dựa trên không gian khả dụng trong viewport.

---

## Implementation Pattern

### 1. Setup State và Refs

```javascript
import React, { useState, useRef, useEffect } from 'react';

export const YourComponent = () => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  // ... rest of component
};
```

### 2. Toggle Dropdown Function với Auto-Position

```javascript
const toggleDropdown = (dropdownId, event) => {
  if (activeDropdown === dropdownId) {
    setActiveDropdown(null);
  } else {
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Dropdown dimensions (adjust based on your dropdown size)
    // Formula: (number of items × 40px) + (number of dividers × 2px) + (container padding ~10px)
    const dropdownHeight = 130; // Example: 3 items × 40px + 10px = ~130px
    const dropdownWidth = 192; // w-48 = 12rem = 192px
    
    // Check if dropdown fits below button
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const fitsBelow = spaceBelow >= dropdownHeight;
    
    // Check if dropdown fits on the right side
    const spaceRight = viewportWidth - buttonRect.right;
    const fitsRight = spaceRight >= dropdownWidth;
    
    // Calculate vertical position
    let topPosition;
    if (fitsBelow) {
      // Position below button
      topPosition = buttonRect.bottom + 8;
    } else if (spaceAbove >= dropdownHeight) {
      // Position above button
      topPosition = buttonRect.top - dropdownHeight - 8;
    } else {
      // Not enough space either way, position with max visibility
      topPosition = Math.max(10, Math.min(buttonRect.bottom + 8, viewportHeight - dropdownHeight - 10));
    }
    
    // Calculate horizontal position
    let leftPosition;
    if (fitsRight) {
      // Align to right edge of button
      leftPosition = buttonRect.right - dropdownWidth;
    } else {
      // Align to right edge of viewport with padding
      leftPosition = Math.max(10, viewportWidth - dropdownWidth - 10);
    }

    setDropdownPosition({
      top: topPosition,
      left: leftPosition
    });
    setActiveDropdown(dropdownId);
  }
};
```

### 3. Close Dropdown on Outside Click

```javascript
useEffect(() => {
  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setActiveDropdown(null);
    }
  };

  if (activeDropdown) {
    document.addEventListener('mousedown', handleClickOutside);
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [activeDropdown]);
```

### 4. Render Button với Toggle

```javascript
<button
  onClick={(e) => toggleDropdown(`action-${itemId}`, e)}
  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
>
  {/* Three dots icon */}
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="3" cy="8" r="1.5" fill="#6B7280" />
    <circle cx="8" cy="8" r="1.5" fill="#6B7280" />
    <circle cx="13" cy="8" r="1.5" fill="#6B7280" />
  </svg>
</button>
```

### 5. Render Dropdown với Fixed Position

```javascript
{activeDropdown && (
  <div
    ref={dropdownRef}
    className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
    style={{
      top: `${dropdownPosition.top}px`,
      left: `${dropdownPosition.left}px`
    }}
  >
    {/* Dropdown menu items */}
    <button className="w-full px-4 py-2 text-left text-[12px] hover:bg-gray-50">
      Option 1
    </button>
    <button className="w-full px-4 py-2 text-left text-[12px] hover:bg-gray-50">
      Option 2
    </button>
  </div>
)}
```

---

## Key Points

### ⚠️ Important Notes

1. **Fixed Position**: Dropdown phải dùng `position: fixed` không phải `absolute`
2. **Z-Index**: Đảm bảo `z-index` đủ cao (e.g., `z-[9999]`)
3. **Dropdown Dimensions**: Cập nhật `dropdownHeight` và `dropdownWidth` phù hợp với dropdown của bạn
4. **Viewport Padding**: Luôn để padding tối thiểu 10px từ edges để tránh sát biên

### 🎯 Customization

**Điều chỉnh Dropdown Height:**
```javascript
// Calculate: (number of items × item height) + (dividers × 2px) + padding
// Each menu item: py-2 (16px) + text (12px) + gap (2px) + icon = ~40px
// Each divider: border-t with my-1 = ~2px
// Container padding: py-1 = ~10px

// Examples:
const dropdownHeight = 130;  // 3 items × 40px + 10px = 130px
const dropdownHeight = 170;  // 4 items × 40px + 10px = 170px  
const dropdownHeight = 210;  // 5 items × 40px + 10px = 210px (EmployeeList)
const dropdownHeight = 250;  // 6 items × 40px + 10px = 250px
const dropdownHeight = 290;  // 7 items × 40px + 10px = 290px

// With dividers:
const dropdownHeight = 212;  // 5 items × 40px + 2 dividers × 2px + 8px = 212px
```

**Điều chỉnh Dropdown Width:**
```javascript
const dropdownWidth = 256; // w-64 = 16rem = 256px
```

**Thay đổi Padding:**
```javascript
const VIEWPORT_PADDING = 10; // Khoảng cách tối thiểu từ edge
topPosition = Math.max(VIEWPORT_PADDING, topPosition);
leftPosition = Math.max(VIEWPORT_PADDING, leftPosition);
```

---

## Files đã áp dụng

✅ **e:\UIT\backend\admin\src\components\DetailInventoryList\DetailInventoryList.jsx**
- Dropdown actions menu cho batch inventory management

---

## Files cần áp dụng

⏳ **Các components có dropdown menu:**

1. `e:\UIT\backend\admin\src\components\InventoryList\InventoryList.jsx`
   - Inventory management actions dropdown

2. `e:\UIT\backend\admin\src\components\ProductList\ProductList.jsx` (nếu có)
   - Product actions dropdown

3. `e:\UIT\backend\admin\src\components\OrderList\OrderList.jsx` (nếu có)
   - Order actions dropdown

4. Bất kỳ component nào có:
   - Actions menu với icon 3 dots
   - Context menu
   - Dropdown options

---

## Testing Checklist

Khi implement, test các trường hợp sau:

- [ ] Dropdown ở giữa trang (should open below)
- [ ] Dropdown ở cuối trang (should open above)
- [ ] Dropdown ở góc phải màn hình (should align left)
- [ ] Dropdown ở góc trái màn hình (should align right)
- [ ] Click outside để đóng dropdown
- [ ] Resize window với dropdown đang mở
- [ ] Scroll page với dropdown đang mở (dropdown should stay fixed)

---

## Alternative Solutions

### Option 2: React Portal (For complex cases)

```javascript
import { createPortal } from 'react-dom';

// Render dropdown at body level
{activeDropdown && createPortal(
  <div
    ref={dropdownRef}
    className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[9999]"
    style={{
      top: `${dropdownPosition.top}px`,
      left: `${dropdownPosition.left}px`
    }}
  >
    {/* Menu items */}
  </div>,
  document.body
)}
```

### Option 3: Floating UI Library (For production)

```bash
npm install @floating-ui/react
```

```javascript
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/react';

const { refs, floatingStyles } = useFloating({
  placement: 'bottom-end',
  middleware: [
    offset(4),
    flip(), // Auto flip if no space
    shift({ padding: 10 }) // Keep in viewport
  ],
  whileElementsMounted: autoUpdate
});

<button ref={refs.setReference}>...</button>
<div ref={refs.setFloating} style={floatingStyles}>...</div>
```

---

## Migration Guide

### Before (Old Code):
```javascript
const toggleDropdown = (dropdownId, event) => {
  const buttonRect = event.currentTarget.getBoundingClientRect();
  const leftPosition = buttonRect.right - 160;
  
  setDropdownPosition({
    top: buttonRect.bottom + 8,
    left: leftPosition
  });
  setActiveDropdown(dropdownId);
};
```

### After (With Auto-Position):
```javascript
const toggleDropdown = (dropdownId, event) => {
  const buttonRect = event.currentTarget.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  const dropdownHeight = 200;
  const dropdownWidth = 192;
  
  const spaceBelow = viewportHeight - buttonRect.bottom;
  const spaceAbove = buttonRect.top;
  const fitsBelow = spaceBelow >= dropdownHeight;
  
  const spaceRight = viewportWidth - buttonRect.right;
  const fitsRight = spaceRight >= dropdownWidth;
  
  let topPosition = fitsBelow 
    ? buttonRect.bottom + 8 
    : (spaceAbove >= dropdownHeight 
        ? buttonRect.top - dropdownHeight - 8
        : Math.max(10, Math.min(buttonRect.bottom + 8, viewportHeight - dropdownHeight - 10)));
  
  let leftPosition = fitsRight
    ? buttonRect.right - dropdownWidth
    : Math.max(10, viewportWidth - dropdownWidth - 10);

  setDropdownPosition({ top: topPosition, left: leftPosition });
  setActiveDropdown(dropdownId);
};
```

---

## Support

Nếu gặp vấn đề:
1. Check console logs
2. Verify dropdown dimensions match actual size
3. Ensure z-index is high enough
4. Check for parent overflow hidden styles

---

**Last Updated:** December 25, 2025
**Author:** Development Team
