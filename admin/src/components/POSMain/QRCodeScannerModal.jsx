import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';

export const QRCodeScannerModal = ({ isOpen, onClose, onScanSuccess, onScanError }) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { type: 'success' | 'error', message: string }
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const html5QrCodeRef = useRef(null);

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

    // Valid ProductCode
    const productCode = decodedText.toUpperCase();

    setScanResult({
      type: 'success',
      message: `Product ${productCode} scanned!`
    });

    // Stop scanning
    stopScanning();

    // Delay to show feedback, then close and call parent handler
    setTimeout(() => {
      onScanSuccess?.(productCode);
      handleClose();
    }, 800);
  };

  // Handle camera change
  const handleCameraChange = async (cameraId) => {
    await stopScanning();
    setSelectedCamera(cameraId);
    startScanning(cameraId);
  };

  // Close modal
  const handleClose = () => {
    stopScanning();
    setScanResult(null);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90">
      {/* Modal Container */}
      <div className="relative w-full h-full max-w-2xl max-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gray-900">
          <h2 className="text-xl font-semibold text-white">Scan QR Code</h2>
          <button
            onClick={handleClose}
            className="p-2 text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Camera View */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {/* QR Reader Container */}
          <div id="qr-reader" className="w-full h-full"></div>

          {/* Scanning Overlay */}
          {scanning && !scanResult && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative">
                {/* Scanning box border */}
                <div className="w-64 h-64 border-4 border-emerald-500 rounded-lg animate-pulse"></div>

                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 animate-scan"></div>
              </div>
            </div>
          )}

          {/* Scan Result Feedback */}
          {scanResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className={`px-8 py-6 rounded-xl shadow-2xl flex items-center gap-4 ${scanResult.type === 'success'
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                }`}>
                {scanResult.type === 'success' ? (
                  <CheckCircle2 size={32} />
                ) : (
                  <AlertCircle size={32} />
                )}
                <span className="text-lg font-semibold">{scanResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-gray-900 flex items-center justify-between">
          {/* Camera Selector */}
          {cameras.length > 1 && (
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

          {/* Instructions */}
          <div className="text-sm text-gray-400 text-center flex-1">
            Position the QR code within the frame
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
