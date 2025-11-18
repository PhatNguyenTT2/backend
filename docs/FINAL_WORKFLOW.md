Customer:
 	- Checkout
 	- Cancel Transaction
 	- Return Order 
Sales:
*
 	- Login POS (by posPIN)
 	- Logout (by clicking 'Logout' button)
*
 	- Add Customer
*
 	- Create Order:
 		+ Add Customer (to the Order) (by CustomerCode, can be Phone).
 		+ Add Product: Scan Barcode to get BarcodeId:
			if (BarcodeId.length... ) then
    				-> fresh goods
    				use BarcodeId to get ProductId, PriceEmbedded, BatchEmbedded    
				Product = query_Product(ProductId)
				weight = PriceEmbedded / Product.unitPrice
    				assign weight to quantity of the product on the invoice    
    				if (ProductBatch.promotionApplied == "none") then
        				price = PriceEmbedded
    				else	
        				price = PriceEmbedded * (1 - ProductBatch.discountPercentage)
    				add line of the product:
    					ProductId
    					BatchId
    					quantity = weight
    					unitPrice = price / weight  (đơn giá/kg sau khi giảm giá)
    					totalPrice = price
			else
    				-> universal goods
    				BarcodeId is ProductId
    				Product = query_Product(BarcodeId)
    				quantity = 1 
    				if (Product.promotionApplied == "none") then
        				unitPrice = Product.unitPrice
    				else
        				unitPrice = Product.unitPrice * (1 - Product.discountPercentage)
    				totalPrice = unitPrice * quantity
    				add line of the product:
    					ProductId
    					Batch = batch store tương ứng
    					quantity
    					unitPrice
    					totalPrice
 		+ Delete Product
 		+ Edit Product Amount (Add, Reduce) (If isVariableWeight=true, weight: readonly, can't be edited)
 		+ Calculate Total (automatically)
*
 	- Hold Orders (to handle others)
 	- Remove Hold Orders
 	- Query Order (By OrderNumber on the Bill)
 	- Return the Order that have been queried (by clicking 'return' button): return universal product to the batch store			System
									 	 return fresh goods to it's batch

*
 	- Payment (by clicking 'Payment' button):
  		For each OrderDetail:
    			if (Product.productType == 'fresh'):
      				Update DetailInventory:
          			batch = OrderDetail.batch
          			quantityOnShelf -= OrderDetail.quantity
    			else:
      				Update DetailInventory:
          			batch = Batch Store
          			quantityOnShelf -= OrderDetail.quantity

 		+ Print Receipt (automatically)				System

Manager:
*
 	- Login Admin Dashboard (by Username and Password)
 	- Logout (by clicking 'Logout' button)
*
 	- Manage export (from warehouse to store: actually from other batch to batch store):
  		Step 1: Select Product
    			Show list products
  		Step 2: Select Batch warehouse
  		Step 3: Enter quantity to export 
 			System validate: quantity <=	 warehouse batch quantity
  		Step 4: Confirm
    			System:
        			- Update DetailInventory warehouse batch: quantity -= exportQuantity
        			- Update DetailInventory batch store: quantity += exportQuantity
        			- Create InventoryMovementBatch record
  		Step 5: Complete
    			Show success message
    			Refresh inventory view
 	- View Inventory Status (TWO VIEWS: in store (batch store for universal, track by batch for fresh), in warehouse)
 	-> View Batch Inventory Status in every Product (all batch except batch store): If a Batch will expire soon (the time to expire day can be adjust by Admin) and it still in warehouse, MOVE IT TO THE STORE AUTOMATICALLY.					System
 	- Alert when a Batch is expired, create Disposal Record:
 		+ Select Batch
 		+ Reason: expired, damaged, lost
 		+ Timestamp (automatically added by the system)
 		+ By whom (automatically added by the system)
 		+ After that:
			universal goods: staff will come to check how much that batch is in the store, recalculate the quantity of products in the batch store: new quantity = old quantity
			fresh goods
 	- View Disposal History
 	- Create Inventory Adjustment (Adjust Inventory by ProductBatch)
 	- View Batch Movement History (if the Batch is moved by the system due to is about to expire, staff: system)
*
 	- Manage Supplier
 	- Manage import Product Batch (from Supplier) (to warehouse) (must have that Product in the system before)
*
 	- Manage Product Category
 	- Manage Product:
 		+ Add Product: universal goods -> Barcode: ProductCode by Manufacturer
 			       fresh goods -> Autogenerate shorter ProductCode (to be embedded on the barcode of every single product) (5 digit)
 		+ Update Product
 	- Manage Batch of Product
    		+ Delete Batch→ If batch in any OrderDetail → WARN

*
 	- View Orders
*
 	- Manage Customer
 	- Generate Financial Statement:
 		+ Revenue Report
 		+ Product Report
 		+ Sales Report
*
 	- View global expire alert threshold
 	- View per-product expire alert threshold (fresh goods and universal goods)
Admin:
*
 	- Login Admin Dashboard (by Username and Password)
 	- Logout (by clicking 'Logout' button)
*
 	- Manage Role
 	- Edit Role Permissions
 	- Set global expire alert threshold
 	- Set per-product expire alert threshold (fresh goods and universal goods)
*
 	- Manage Account and Authorization