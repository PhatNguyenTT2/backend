import React, { useState, useEffect } from 'react';
import { ReceiveBatchInfoForm } from './ReceiveBatchInfoForm';
import purchaseOrderService from '../../services/purchaseOrderService';
import detailPurchaseOrderService from '../../services/detailPurchaseOrderService';
import productBatchService from '../../services/productBatchService';
import detailInventoryService from '../../services/detailInventoryService';
import inventoryMovementBatchService from '../../services/inventoryMovementBatchService';

/**
 * ReceivePurchaseOrderModal
 * Modal để nhận hàng từ Purchase Order
 * - Hiển thị danh sách sản phẩm trong PO
 * - Cho phép nhập batch info cho từng sản phẩm
 * - Tạo batch + detail inventory + stock in movement
 * - Cập nhật PO status khi hoàn tất
 */
export const ReceivePurchaseOrderModal = ({
  isOpen,
  onClose,
  onSuccess,
  purchaseOrder
}) => {
  const [poDetails, setPODetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [receivingItem, setReceivingItem] = useState(null);
  const [receivedItems, setReceivedItems] = useState(new Set());
  const [apiError, setApiError] = useState('');

  // Load PO details when modal opens
  useEffect(() => {
    if (isOpen && purchaseOrder) {
      loadPODetails();
    }
  }, [isOpen, purchaseOrder]);

  const loadPODetails = async () => {
    try {
      setLoading(true);
      const response = await detailPurchaseOrderService.getDetailsByPurchaseOrder(
        purchaseOrder._id || purchaseOrder.id
      );

      const details = response.data?.detailPurchaseOrders || [];
      setPODetails(details);

      // Pre-populate receivedItems from details that already have a batch assigned
      // Items with batch field set have already been received (stock in completed)
      const alreadyReceived = new Set();
      details.forEach(detail => {
        if (detail.batch) {
          alreadyReceived.add(detail._id || detail.id);
        }
      });
      setReceivedItems(alreadyReceived);

    } catch (error) {
      console.error('Error loading PO details:', error);
      setApiError('Failed to load purchase order details');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveItem = async (batchData) => {
    try {
      setLoading(true);
      setApiError('');

      const { poDetail, quantityReceived, mfgDate, expiryDate, warehouseLocation, notes } = batchData;

      // Get product ID (handle both populated and non-populated cases)
      const productId = typeof poDetail.product === 'object'
        ? (poDetail.product._id || poDetail.product.id)
        : poDetail.product;

      // Get selling price (from populated product or fallback)
      const sellingPrice = poDetail.product?.unitPrice || poDetail.costPrice;

      console.log('Creating batch with data:', {
        productId,
        quantityReceived,
        costPrice: poDetail.costPrice,
        unitPrice: sellingPrice,
        mfgDate,
        expiryDate
      });

      // Step 1: Create new product batch
      const batchResponse = await productBatchService.createBatch({
        product: productId,
        quantity: quantityReceived,
        costPrice: poDetail.costPrice, // Giá nhập từ PO (cost from supplier)
        unitPrice: sellingPrice, // Giá bán của sản phẩm (selling price), fallback to cost
        mfgDate: mfgDate,
        expiryDate: expiryDate,
        status: 'active',
        promotionApplied: 'none',
        discountPercentage: 0,
        notes: notes || `Received from PO ${purchaseOrder.poNumber}`
      });

      const newBatch = batchResponse.data;

      // Step 2: Create DetailInventory for this batch (initial state with 0 quantity)
      const detailInventoryResponse = await detailInventoryService.createDetailInventory({
        batchId: newBatch._id || newBatch.id,
        quantityOnHand: 0,  // Start with 0, will be updated by movement
        quantityOnShelf: 0,
        quantityReserved: 0,
        location: warehouseLocation
      });

      const detailInventory = detailInventoryResponse.data;

      // Step 3: Create Stock In Movement (this will auto-update DetailInventory quantity)
      await inventoryMovementBatchService.createMovement({
        batchId: newBatch._id || newBatch.id,
        inventoryDetail: detailInventory._id || detailInventory.id,
        movementType: 'in',
        quantity: quantityReceived,
        reason: 'Purchase Order Receipt',
        purchaseOrderId: purchaseOrder._id || purchaseOrder.id,
        notes: notes || `Received from PO ${purchaseOrder.poNumber}`
      });

      // Step 4: Update DetailPurchaseOrder with batch reference (BEFORE updating PO status)
      await detailPurchaseOrderService.updateDetailPurchaseOrder(
        poDetail._id || poDetail.id,
        { batch: newBatch._id || newBatch.id }
      );

      // Mark item as received locally
      const newReceivedItems = new Set([...receivedItems, poDetail._id || poDetail.id]);
      setReceivedItems(newReceivedItems);
      setReceivingItem(null);

      // Check if all items are received
      const allReceived = poDetails.every(detail =>
        newReceivedItems.has(detail._id || detail.id)
      );

      if (allReceived) {
        // Update PO status to received (LAST STEP)
        await purchaseOrderService.receivePurchaseOrder(purchaseOrder._id || purchaseOrder.id);

        // Close modal and refresh
        onSuccess && onSuccess();
        onClose();
      }

    } catch (error) {
      console.error('Error receiving item:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      setApiError(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Failed to receive item'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalItems = poDetails.length;
  const receivedCount = receivedItems.size;
  const progressPercentage = totalItems > 0 ? (receivedCount / totalItems) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                Receive Purchase Order
              </h2>
              <p className="text-[13px] text-gray-600 font-['Poppins',sans-serif] mt-1">
                {purchaseOrder?.poNumber} - {purchaseOrder?.supplier?.companyName}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Step Progress Bar - Similar to TransferStockBulkModal */}
          <div className="mt-4 pb-2">
            <div className="flex items-center justify-center">
              {[
                { num: 1, label: 'View Items' },
                { num: 2, label: 'Enter Batch Info' },
                { num: 3, label: 'Complete' }
              ].map((stepInfo, index) => {
                // Determine current step based on state
                const currentStep = receivingItem ? 2 : (progressPercentage === 100 ? 3 : 1);
                const stepNum = stepInfo.num;

                return (
                  <div key={stepNum} className="flex items-center">
                    {/* Step Circle */}
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold transition-all duration-300 ${stepNum < currentStep
                        ? 'bg-emerald-500 text-white'
                        : stepNum === currentStep
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                        }`}>
                        {stepNum < currentStep ? (
                          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          stepNum
                        )}
                      </div>
                      <span className={`mt-2 text-[11px] font-medium whitespace-nowrap ${stepNum <= currentStep ? 'text-blue-600' : 'text-gray-400'
                        }`}>
                        {stepInfo.label}
                      </span>
                    </div>

                    {/* Connector Line */}
                    {index < 2 && (
                      <div className="w-20 h-1 mx-3 rounded-full overflow-hidden bg-gray-200">
                        <div
                          className={`h-full transition-all duration-500 ease-out ${stepNum < currentStep ? 'bg-emerald-500' : 'bg-gray-200'
                            }`}
                          style={{ width: stepNum < currentStep ? '100%' : '0%' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Item Progress Bar */}
          {totalItems > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {/* Progress Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Circular Progress Indicator */}
                  <div className="relative w-12 h-12">
                    <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="#e5e7eb"
                        strokeWidth="4"
                        fill="none"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke={progressPercentage === 100 ? '#10b981' : '#3b82f6'}
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPercentage / 100)}`}
                        className="transition-all duration-500 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-[11px] font-bold ${progressPercentage === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {progressPercentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Text */}
                  <div>
                    <p className="text-[13px] font-semibold font-['Poppins',sans-serif] text-gray-800">
                      {receivedCount} of {totalItems} items received
                    </p>
                    <p className="text-[11px] text-gray-500 font-['Poppins',sans-serif]">
                      {totalItems - receivedCount === 0
                        ? 'All items received!'
                        : `${totalItems - receivedCount} remaining`}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${progressPercentage === 100
                  ? 'bg-emerald-100 text-emerald-700'
                  : progressPercentage > 0
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                  {progressPercentage === 100 ? (
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Complete
                    </span>
                  ) : progressPercentage > 0 ? 'In Progress' : 'Not Started'}
                </div>
              </div>

              {/* Segmented Progress Bar */}
              <div className="flex items-center gap-1">
                {poDetails.map((detail, index) => (
                  <div
                    key={detail._id || index}
                    className={`flex-1 h-2 rounded-full transition-all duration-300 ${receivedItems.has(detail._id || detail.id)
                      ? 'bg-emerald-500'
                      : 'bg-gray-200'
                      }`}
                    title={`${detail.product?.name || 'Item'} - ${receivedItems.has(detail._id || detail.id) ? 'Received' : 'Pending'}`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] text-gray-500">Received</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-200"></div>
                  <span className="text-[10px] text-gray-500">Pending</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px] mb-4">
              {apiError}
            </div>
          )}

          {loading && !receivingItem ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : poDetails.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-[13px] font-['Poppins',sans-serif]">
                No items found in this purchase order
              </p>
            </div>
          ) : receivingItem ? (
            /* Show receiving form for selected item */
            <div>
              <button
                onClick={() => setReceivingItem(null)}
                className="flex items-center gap-2 text-[13px] text-gray-600 hover:text-gray-800 font-['Poppins',sans-serif] mb-4"
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 12L6 8L10 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Back to item list
              </button>

              <ReceiveBatchInfoForm
                poDetail={receivingItem}
                onSubmit={handleReceiveItem}
                onCancel={() => setReceivingItem(null)}
                loading={loading}
              />
            </div>
          ) : (
            /* Show list of items to receive */
            <div className="space-y-3">
              {poDetails.map((detail, index) => {
                const isReceived = receivedItems.has(detail._id || detail.id);

                return (
                  <div
                    key={detail._id || detail.id}
                    className={`border rounded-lg p-4 transition-all ${isReceived
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-gray-200 hover:border-emerald-300'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Item Number */}
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[12px] font-semibold font-['Poppins',sans-serif] text-gray-600">
                        {index + 1}
                      </div>

                      {/* Product Image */}
                      {detail.product?.image && (
                        <img
                          src={detail.product.image}
                          alt={detail.product?.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      )}

                      {/* Product Info */}
                      <div className="flex-1">
                        <h4 className="text-[14px] font-semibold font-['Poppins',sans-serif] text-[#212529]">
                          {detail.product?.name || 'Product'}
                        </h4>
                        <div className="flex items-center gap-4 mt-1 text-[12px] font-['Poppins',sans-serif] text-gray-600">
                          <span>Quantity: {detail.quantity}</span>
                          <span>•</span>
                          <span>Cost Price: {detail.costPrice?.toLocaleString('vi-VN')} đ</span>
                          <span>•</span>
                          <span>Total Cost: {(detail.quantity * detail.costPrice)?.toLocaleString('vi-VN')} đ</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      {isReceived ? (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path
                              d="M7 10L9 12L13 8M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span className="text-[13px] font-semibold font-['Poppins',sans-serif]">
                            Received
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReceivingItem(detail)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[13px] font-['Poppins',sans-serif] font-medium transition-colors flex items-center gap-2"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M8 12V4M8 4L5 7M8 4L11 7"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M2 12H14"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Receive
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!receivingItem && poDetails.length > 0 && (
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-['Poppins',sans-serif] text-gray-600">
                {receivedCount === totalItems ? (
                  <span className="text-emerald-600 font-semibold">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline mr-1 align-text-bottom"><path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    All items received! PO will be marked as received.
                  </span>
                ) : (
                  <span>
                    {totalItems - receivedCount} item(s) remaining to receive
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white text-[13px] font-['Poppins',sans-serif] font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};