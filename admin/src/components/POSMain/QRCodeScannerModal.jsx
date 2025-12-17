import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, CheckCircle2, Upload } from 'lucide-react';

export const QRCodeScannerModal = ({ isOpen, onClose, onScanSuccess, onScanError }) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { type: 'success' | 'error', message: string }
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [isFileMode, setIsFileMode] = useState(false); // Toggle between camera and file upload
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);

  // ⏱️ Simple timestamp tracking for cooldown (camera stays running)
  const lastScanTimeRef = useRef(0);

  // Initialize scanner when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initScanner = async () => {
      try {
        // Get available cameras
        const devices = await Html5Qrcode.getCameras();

        if (!devices || devices.length === 0) {
          onScanError?.('No cameras found on this device');
          return;
        }

        setCameras(devices);

        // Select back camera by default (or first camera)
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear')
        ) || devices[0];

        setSelectedCamera(backCamera.id);
        startScanning(backCamera.id);
      } catch (error) {
        console.error('Camera initialization error:', error);
        onScanError?.('Failed to access camera. Please check permissions.');
      }
    };

    initScanner();

    // Cleanup on unmount
    return () => {
      stopScanning();
    };
  }, [isOpen]);

  // Start QR code scanning
  const startScanning = async (cameraId) => {
    try {
      setScanning(true);

      // Initialize Html5Qrcode
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      }

      const qrCodeScanner = html5QrCodeRef.current;

      // Start scanning
      await qrCodeScanner.start(
        cameraId,
        {
          fps: 10, // Frames per second
          qrbox: { width: 250, height: 250 } // Scanning box size
        },
        // Success callback
        (decodedText) => {
          console.log('QR Code detected:', decodedText);
          handleScanSuccess(decodedText);
        },
        // Error callback (optional, for debugging)
        (errorMessage) => {
          // This fires very frequently during scanning, ignore
          // console.log('Scanning...', errorMessage);
        }
      );
    } catch (error) {
      console.error('Scanning start error:', error);
      setScanning(false);
      onScanError?.('Failed to start camera');
    }
  };

  // Stop scanning
  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
    } finally {
      setScanning(false);
    }
  };

  // Handle successful scan
  const handleScanSuccess = (decodedText) => {
    // ⏱️ CHECK COOLDOWN: Camera KHÔNG BAO GIỜ tắt, chỉ ignore callbacks
    const now = Date.now();
    if (now - lastScanTimeRef.current < 5000) {
      console.log('⚠️ Scan cooldown active, ignoring scan');
      return; // Bỏ qua scan này
    }

    // Validate ProductCode format: PROD + 10 digits
    const productCodePattern = /^PROD\d{10}$/i;

    if (!productCodePattern.test(decodedText)) {
      setScanResult({
        type: 'error',
        message: 'Invalid QR code. Expected ProductCode format: PROD##########'
      });

      // Clear error after 2 seconds
      setTimeout(() => setScanResult(null), 2000);
      return;
    }

    // Valid ProductCode - Scan hợp lệ → gọi API
    const productCode = decodedText.toUpperCase();
    lastScanTimeRef.current = now; // Update timestamp

    console.log('✅ Valid scan at', new Date(now).toLocaleTimeString());

    setScanResult({
      type: 'success',
      message: `Product ${productCode} scanned!`
    });

    // Call parent handler (add to cart with quantity = 1)
    onScanSuccess?.(productCode);

    // Clear success message after 2 seconds
    setTimeout(() => setScanResult(null), 2000);
  };

  // Handle camera change
  const handleCameraChange = async (cameraId) => {
    await stopScanning();
    setSelectedCamera(cameraId);
    startScanning(cameraId);
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      }

      const qrCodeScanner = html5QrCodeRef.current;

      // Scan file
      const decodedText = await qrCodeScanner.scanFile(file, true);
      console.log('QR Code from file:', decodedText);
      handleScanSuccess(decodedText);
    } catch (error) {
      console.error('File scan error:', error);
      setScanResult({
        type: 'error',
        message: 'Failed to read QR code from image'
      });

      setTimeout(() => setScanResult(null), 2000);
    }
  };

  // Toggle between camera and file mode
  const toggleMode = () => {
    if (isFileMode) {
      // Switch to camera mode
      setIsFileMode(false);
      if (selectedCamera) {
        startScanning(selectedCamera);
      }
    } else {
      // Switch to file mode
      stopScanning();
      setIsFileMode(true);
    }
  };

  // Close modal
  const handleClose = () => {
    stopScanning();
    setScanResult(null);
    setIsFileMode(false);
    lastScanTimeRef.current = 0; // Reset timestamp

    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Modal Container - Smaller size to show cart behind */}
      <div className="relative w-full max-w-lg flex flex-col bg-gray-900 bg-opacity-95 rounded-xl shadow-2xl overflow-hidden" style={{ height: '600px' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gray-900">
          <div>
            <h2 className="text-lg font-semibold text-white">Scan QR Code</h2>
            <p className="text-xs text-gray-400 mt-0.5">Scanner will continue after each scan</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera View or File Upload */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {isFileMode ? (
            /* File Upload Mode */
            <div className="flex flex-col items-center justify-center gap-6 text-white">
              <Upload size={64} className="text-emerald-400" />
              <h3 className="text-2xl font-semibold">Upload QR Code Image</h3>
              <p className="text-gray-400 text-center max-w-md">
                Select an image file containing a QR code to scan
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-lg font-semibold flex items-center gap-2"
              >
                <Upload size={20} />
                Choose Image
              </button>
              <div id="qr-reader" className="hidden"></div>
            </div>
          ) : (
            /* Camera Mode */
            <>
              {/* QR Reader Container */}
              <div id="qr-reader" className="w-full h-full"></div>

              {/* Scanning Overlay */}
              {scanning && !scanResult && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    {/* Scanning box border */}
                    <div className="w-52 h-52 border-4 border-emerald-500 rounded-lg animate-pulse"></div>

                    {/* Scanning line animation */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 animate-scan"></div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Scan Result Feedback */}
          {scanResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${scanResult.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
                }`}>
                {scanResult.type === 'success' ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <AlertCircle size={24} />
                )}
                <span className="text-base font-semibold">{scanResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-3 bg-gray-900 flex items-center justify-between gap-3">
          {/* Camera Selector (only in camera mode) */}
          {!isFileMode && cameras.length > 1 && (
            <div className="flex items-center gap-2">
              <Camera size={20} className="text-white" />
              <select
                value={selectedCamera || ''}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label || `Camera ${camera.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode Toggle Button */}
          <button
            onClick={toggleMode}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
          >
            {isFileMode ? (
              <>
                <Camera size={18} />
                Camera
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload
              </>
            )}
          </button>

          {/* Instructions */}
          <div className="text-xs text-gray-400 text-center flex-1">
            {isFileMode
              ? 'Upload QR image'
              : 'Position QR within frame'
            }
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
