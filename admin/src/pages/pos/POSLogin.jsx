import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import posAuthService from '../../services/posAuthService';

export const POSLogin = () => {
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear error when inputs change
  useEffect(() => {
    if (error) setError('');
  }, [employeeCode, pin]);

  // Handle number pad click
  const handleNumberClick = (num) => {
    if (pin.length < 6) {
      setPin(pin + num);
    }
  };

  // Handle backspace
  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  // Handle clear
  const handleClear = () => {
    setPin('');
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!employeeCode.trim()) {
      setError('Please enter employee code');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await posAuthService.login(employeeCode, pin);

      if (response.success) {
        navigate('/pos');
      } else {
        setError(response.error || 'Login failed');
      }
    } catch (err) {
      setError(err.error || err.message || 'Invalid employee code or PIN');
    } finally {
      setLoading(false);
    }
  };

  // Number pad buttons
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center p-4">
      {/* Back to Admin Login Button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 flex items-center gap-2 px-4 py-2 bg-white text-emerald-600 rounded-lg shadow-lg hover:shadow-xl hover:bg-emerald-50 transition-all group"
        title="Back to Admin Login"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="group-hover:-translate-x-1 transition-transform"
        >
          <path
            d="M19 12H5M5 12L12 19M5 12L12 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[14px] font-semibold font-['Poppins',sans-serif]">
          Admin Login
        </span>
      </button>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 text-white p-6 text-center">
          <div className="flex items-center justify-center mb-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
              <circle cx="7" cy="15" r="1" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-[24px] font-bold font-['Poppins',sans-serif]">
            POS System
          </h1>
          <p className="text-[14px] font-['Poppins',sans-serif] text-emerald-100 mt-1">
            Enter your credentials to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2" />
                <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-[13px] font-['Poppins',sans-serif] text-red-700">
                {error}
              </span>
            </div>
          )}

          {/* Employee Code Input */}
          <div className="mb-4">
            <label className="block text-[14px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-2">
              Employee Code
            </label>
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
              placeholder="USER2025000001"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-[16px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* PIN Input */}
          <div className="mb-4">
            <label className="block text-[14px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-2">
              PIN
            </label>
            <div className="relative">
              <input
                type="password"
                value={pin}
                readOnly
                placeholder="Enter PIN"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-[24px] font-['Poppins',sans-serif] tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                {pin.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-gray-400 hover:text-gray-600"
                    title="Clear"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {numbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberClick(num)}
                className="h-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg text-[24px] font-semibold font-['Poppins',sans-serif] text-gray-800 transition-colors"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="h-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg flex items-center justify-center transition-colors col-start-3"
              title="Backspace"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading || !employeeCode || pin.length < 4}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg text-[16px] font-bold font-['Poppins',sans-serif] transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>

          {/* Help Text */}
          <p className="text-center text-[12px] font-['Poppins',sans-serif] text-gray-500 mt-4">
            Contact your manager if you forgot your PIN
          </p>
        </form>
      </div>
    </div>
  );
};
