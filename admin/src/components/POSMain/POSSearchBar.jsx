import React, { useState, useEffect, useRef } from 'react';

export const POSSearchBar = ({ onProductScanned, onSearchChange, searchTerm }) => {
  const [scanBuffer, setScanBuffer] = useState('');
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const scanTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Barcode scanner detection (simulated with productCode)
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if user is typing in other inputs
      if (e.target.tagName === 'INPUT' && e.target !== inputRef.current) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;

      // Fast typing detection (< 100ms between chars) = simulated barcode scan
      if (timeDiff < 100 && scanBuffer.length > 0) {
        // Continuing scan
        setScanBuffer(prev => prev + e.key);
      } else if (timeDiff >= 100 && timeDiff < 1000) {
        // Start new scan
        setScanBuffer(e.key);
      }

      setLastKeyTime(currentTime);

      // Auto-submit after 150ms of no input (scanner finished)
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      scanTimeoutRef.current = setTimeout(() => {
        const buffer = scanBuffer + e.key;

        // If buffer looks like productCode (PROD + 10 digits)
        if (/^PROD\d{10}$/i.test(buffer)) {
          console.log('ProductCode scanned:', buffer);

          if (onProductScanned) {
            onProductScanned(buffer.toUpperCase());
          }

          // Clear buffer and input
          setScanBuffer('');
          if (inputRef.current) {
            inputRef.current.value = '';
          }
        }
      }, 150);
    };

    const handleKeyDown = (e) => {
      // Handle Enter key in search input
      if (e.key === 'Enter' && e.target === inputRef.current) {
        const value = e.target.value.trim();

        // If looks like productCode
        if (/^PROD\d{10}$/i.test(value)) {
          e.preventDefault();

          if (onProductScanned) {
            onProductScanned(value.toUpperCase());
          }

          e.target.value = '';
          setScanBuffer('');
        }
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('keydown', handleKeyDown);

      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [scanBuffer, lastKeyTime, onProductScanned]);

  // Manual search change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setScanBuffer('');

    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id="product-search"
        type="text"
        defaultValue={searchTerm}
        onChange={handleInputChange}
        placeholder="Scan productCode or search products... (Ctrl+K or F2)"
        className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-lg text-[15px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-3"
      />
      <svg
        className="absolute left-3 top-3.5 text-gray-400"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
        <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Scanning indicator */}
      {scanBuffer.length > 0 && (
        <div className="absolute right-3 top-3 flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
          <svg className="animate-pulse" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="4" width="1" height="8" fill="currentColor" />
            <rect x="4" y="4" width="2" height="8" fill="currentColor" />
            <rect x="7" y="4" width="1" height="8" fill="currentColor" />
            <rect x="9" y="4" width="2" height="8" fill="currentColor" />
            <rect x="12" y="4" width="1" height="8" fill="currentColor" />
          </svg>
          Scanning...
        </div>
      )}
    </div>
  );
};
