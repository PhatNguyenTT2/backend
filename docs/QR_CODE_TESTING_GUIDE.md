# QR Code Testing Guide

## Overview
Complete guide for testing QR code scanning functionality in the POS system.

## Table of Contents
1. [Generating QR Codes](#1-generating-qr-codes)
2. [Testing Methods](#2-testing-methods)
3. [Test Scenarios](#3-test-scenarios)
4. [Troubleshooting](#4-troubleshooting)

---

## 1. Generating QR Codes

### Access QR Code Management Page
1. Navigate to **Product QR Codes** page (`/product-qr-codes`)
2. This page displays all active products in your inventory

### Generate Single QR Code
```
1. Find the product you want to generate a QR code for
2. Click the "Generate" button on the product card
3. QR code will be displayed in the card
4. Click "Download" to save the QR code image
```

### Generate All QR Codes
```
1. Click "Generate All QR Codes" button at the top
2. Wait for bulk generation to complete
3. All QR codes will be displayed on product cards
4. Click "Download All" to download all QR codes at once
```

### QR Code Format
- **Content**: Plain text containing the ProductCode
- **Example**: `PROD1234567890`
- **Pattern**: `PROD` + 10 digits
- **File Format**: PNG image (300x300px)

### Searching Products
```
Use the search bar to filter products by:
- Product Code (e.g., "PROD1234567890")
- Product Name (e.g., "Coca Cola")
```

---

## 2. Testing Methods

### Method 1: Camera Scanning (Real-time)

**Requirements:**
- Device with camera (laptop webcam, phone camera)
- HTTPS connection (for camera permissions) or localhost
- Printed QR code OR display QR code on another screen

**Steps:**
```
1. Navigate to POS page (/pos)
2. Click the QR code button (green button with QR icon)
3. Allow camera permissions when prompted
4. Point camera at the QR code
5. System will automatically detect and scan
6. Product will be added to cart
```

**Camera Selection:**
- If multiple cameras available, use dropdown to switch
- Back camera usually works better for scanning
- Front camera can be used for selfie-mode scanning

**Tips:**
- Hold QR code steady within the scanning frame
- Ensure good lighting
- Keep QR code flat (not bent/wrinkled)
- Distance: 10-30cm from camera
- Wait 1-2 seconds for detection

### Method 2: Image Upload

**Requirements:**
- Image file containing QR code (JPG, PNG, etc.)
- No camera needed

**Steps:**
```
1. Navigate to POS page (/pos)
2. Click the QR code button (green button with QR icon)
3. Click "Upload Image" button in the modal
4. Select an image file containing a QR code
5. System will scan the QR code from the image
6. Product will be added to cart
```

**Image Requirements:**
- Clear, well-lit QR code
- Minimal background noise
- QR code should be prominent in the image
- Recommended: Use downloaded QR code images

**Tips:**
- Take photo of printed QR code
- Screenshot of QR code on screen
- Use images downloaded from QR Code Management page

---

## 3. Test Scenarios

### Scenario 1: REGULAR Product (Single Batch)
**Product Type:** REGULAR  
**Expected Behavior:** Add directly to cart with quantity 1

**Test Steps:**
```
1. Generate QR code for a REGULAR product
2. Scan the QR code using camera or upload
3. Verify product appears in cart
4. Verify quantity = 1
5. Verify correct price is displayed
6. Scan again to increment quantity
```

**Expected Result:**
- ✅ Product added to cart
- ✅ Quantity increments on repeated scans
- ✅ Backend uses FEFO logic for batch selection

### Scenario 2: FRESH Product (Multiple Batches)
**Product Type:** FRESH  
**Expected Behavior:** Show batch selection modal

**Test Steps:**
```
1. Generate QR code for a FRESH product (e.g., vegetables, meat)
2. Scan the QR code using camera or upload
3. Batch selection modal should appear
4. Verify batches are sorted by expiry date (FEFO)
5. Select a batch
6. Verify product with selected batch appears in cart
```

**Expected Result:**
- ✅ Batch selection modal appears
- ✅ Batches displayed with expiry dates
- ✅ Quantity selector works correctly
- ✅ Selected batch added to cart

### Scenario 3: Invalid QR Code
**QR Code Content:** Not a valid ProductCode

**Test Steps:**
```
1. Create a QR code with invalid content (e.g., "https://example.com")
2. Scan the invalid QR code
3. Verify error message appears
```

**Expected Result:**
- ✅ Error message: "Invalid QR code. Expected ProductCode format: PROD##########"
- ✅ Scanner remains active
- ✅ Can scan again immediately

### Scenario 4: Product Not Found
**QR Code Content:** Valid format but product doesn't exist

**Test Steps:**
```
1. Create a QR code with valid format but non-existent ProductCode
   Example: PROD9999999999
2. Scan the QR code
3. Verify error handling
```

**Expected Result:**
- ✅ Error toast: "Product not found"
- ✅ Scanner closes
- ✅ Cart remains unchanged

### Scenario 5: Out of Stock Product
**QR Code Content:** Valid ProductCode but no stock

**Test Steps:**
```
1. Generate QR code for an out-of-stock product
2. Scan the QR code
3. Verify out-of-stock handling
```

**Expected Result:**
- ✅ Error toast or warning about stock
- ✅ Product not added to cart OR added with stock warning

### Scenario 6: Multiple Products in Sequence
**Test Steps:**
```
1. Scan Product A QR code
2. Verify Product A in cart
3. Scan Product B QR code
4. Verify Product B added to cart
5. Verify both products in cart with correct quantities
6. Scan Product A again
7. Verify Product A quantity incremented
```

**Expected Result:**
- ✅ Multiple products can be scanned in sequence
- ✅ Quantities update correctly
- ✅ No duplicate entries (same product increments quantity)

### Scenario 7: Camera Permission Denied
**Test Steps:**
```
1. Click QR scan button
2. Deny camera permission when prompted
3. Verify error handling
```

**Expected Result:**
- ✅ Error message: "Failed to access camera. Please check permissions."
- ✅ Modal closes OR shows permission instructions
- ✅ Can try again after granting permission

### Scenario 8: Switch Between Camera and Upload
**Test Steps:**
```
1. Open QR scanner modal (camera mode)
2. Click "Upload Image" button
3. Verify camera stops
4. Upload mode UI appears
5. Click "Use Camera" button
6. Verify camera starts again
```

**Expected Result:**
- ✅ Smooth transition between modes
- ✅ Camera stops when switching to upload
- ✅ No errors during mode switch

---

## 4. Troubleshooting

### Issue: Camera not starting
**Symptoms:**
- Black screen in scanner modal
- Error: "Failed to access camera"

**Solutions:**
```
1. Check browser permissions:
   - Chrome: Settings > Privacy > Camera > Allow
   - Firefox: Settings > Permissions > Camera > Allow

2. Check HTTPS:
   - Camera requires HTTPS in production
   - Localhost works without HTTPS

3. Check camera hardware:
   - Camera not covered/blocked
   - Camera drivers installed
   - Camera working in other apps

4. Try different browser:
   - Chrome recommended
   - Firefox, Edge also supported
```

### Issue: QR code not detecting
**Symptoms:**
- Camera running but not scanning
- QR code visible but not detected

**Solutions:**
```
1. Improve QR code visibility:
   - Better lighting
   - Higher contrast (print on white paper)
   - Larger QR code size
   - Flatten wrinkled codes

2. Adjust distance:
   - Too close: QR code out of focus
   - Too far: QR code too small
   - Optimal: 10-30cm

3. Hold steady:
   - Keep QR code within green frame
   - Hold still for 1-2 seconds
   - Avoid motion blur

4. Check QR code quality:
   - Re-generate QR code
   - Print at higher resolution
   - Use downloaded PNG files
```

### Issue: Wrong product added to cart
**Symptoms:**
- Scanned product A but product B added
- Unexpected product in cart

**Solutions:**
```
1. Verify QR code content:
   - Use QR code reader app to check content
   - Should match ProductCode format: PROD##########

2. Regenerate QR code:
   - Delete old QR code
   - Generate new one from Product QR Codes page

3. Clear browser cache:
   - Ctrl + Shift + Delete (Chrome)
   - Clear cached images and files
```

### Issue: File upload not working
**Symptoms:**
- Uploaded image but no detection
- Error: "Failed to read QR code from image"

**Solutions:**
```
1. Check image quality:
   - Clear, not blurry
   - Good lighting in photo
   - QR code prominent in image

2. Try different image:
   - Take new photo
   - Use downloaded QR code PNG
   - Try different angle/lighting

3. Check file format:
   - JPG, PNG supported
   - File not corrupted
   - File size reasonable (< 5MB)
```

### Issue: Batch selection modal not appearing
**Symptoms:**
- FRESH product scanned but added directly
- No batch selection shown

**Solutions:**
```
1. Verify product type:
   - Product should have type: "FRESH"
   - Check in Products page

2. Check available batches:
   - Product must have multiple batches
   - Batches must be in stock

3. Check console logs:
   - F12 > Console
   - Look for errors in handleProductScanned
```

---

## Testing Checklist

### Pre-Testing Setup
- [ ] Access Product QR Codes page (`/product-qr-codes`)
- [ ] Generate QR codes for at least 5 products:
  - [ ] 2-3 REGULAR products
  - [ ] 2-3 FRESH products
- [ ] Download all generated QR codes
- [ ] Print 2-3 QR codes on paper

### Camera Scanning Tests
- [ ] Test with printed QR code
- [ ] Test with QR code on screen
- [ ] Test with multiple cameras (if available)
- [ ] Test camera permission denial
- [ ] Test switching between cameras

### Image Upload Tests
- [ ] Upload downloaded QR code PNG
- [ ] Upload photo of printed QR code
- [ ] Upload screenshot of QR code
- [ ] Test invalid image file

### Product Type Tests
- [ ] Scan REGULAR product (direct add)
- [ ] Scan FRESH product (batch selection)
- [ ] Test batch selection modal
- [ ] Test quantity changes in batch modal

### Error Handling Tests
- [ ] Scan invalid QR code format
- [ ] Scan non-existent ProductCode
- [ ] Scan out-of-stock product
- [ ] Test with camera permission denied

### Integration Tests
- [ ] Scan multiple products in sequence
- [ ] Test cart quantity updates
- [ ] Complete full checkout with scanned products
- [ ] Verify order creation with scanned items

### Mode Switching Tests
- [ ] Switch from camera to upload mode
- [ ] Switch from upload to camera mode
- [ ] Multiple mode switches

---

## Best Practices

### For Developers
```
1. Always test with real QR codes before deployment
2. Test on different devices (laptop, tablet, phone)
3. Test on different browsers (Chrome, Firefox, Safari)
4. Test with different lighting conditions
5. Test with different QR code sizes
6. Monitor console logs during testing
7. Test error scenarios thoroughly
```

### For End Users
```
1. Generate QR codes in advance
2. Print QR codes on white paper with good printer
3. Keep printed QR codes clean and flat
4. Use proper lighting when scanning
5. Hold QR code steady within frame
6. Use image upload if camera scanning fails
7. Report any scanning issues to support
```

---

## Performance Metrics

### Expected Performance
- **QR Code Generation**: < 1 second per code
- **Bulk Generation (100 codes)**: < 10 seconds
- **Camera Initialization**: 1-3 seconds
- **Scan Detection Time**: 0.5-2 seconds
- **Product Addition to Cart**: < 500ms

### Optimization Tips
```
1. Pre-generate QR codes during product setup
2. Use high-quality camera for faster detection
3. Ensure good lighting for faster scans
4. Keep QR codes clean and undamaged
5. Use appropriate QR code size (300x300px recommended)
```

---

## Next Steps After Testing

### If Testing Successful
```
1. Train staff on QR code scanning
2. Print QR codes for all products
3. Attach QR codes to product shelves
4. Create QR code maintenance schedule
5. Deploy to production
```

### If Issues Found
```
1. Document specific issues
2. Reproduce issues consistently
3. Check error logs
4. Report to development team
5. Test fixes before re-deploying
```

---

## Support

### Common Questions

**Q: Do I need to print QR codes?**  
A: No, you can display QR codes on a screen and scan them. However, printed QR codes are recommended for permanent product labeling.

**Q: Can I use my phone's camera?**  
A: Yes! Access the POS page on your phone's browser and grant camera permissions.

**Q: How many times can I scan the same QR code?**  
A: Unlimited. Each scan adds the product to cart or increments quantity.

**Q: Can I edit QR codes after generation?**  
A: No. QR codes are static. If ProductCode changes, generate new QR codes.

**Q: What if I lose generated QR codes?**  
A: Simply regenerate them from the Product QR Codes page.

---

## Conclusion

This testing guide covers all aspects of QR code functionality. Follow the test scenarios systematically to ensure reliable QR code scanning in your POS system.

For additional support or questions, refer to:
- `QR_CODE_SCANNING_IMPLEMENTATION.md` - Technical implementation details
- Development team for technical issues
- User manual for operational guidelines
