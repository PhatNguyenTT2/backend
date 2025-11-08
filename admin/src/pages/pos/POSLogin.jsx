import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import posLoginService from '../../services/posLoginService';

export const POSLogin = () => {
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [minutesLocked, setMinutesLocked] = useState(null);

  // Check if already logged in
  useEffect(() => {
    if (posLoginService.isLoggedIn()) {
      navigate('/pos');
    }
  }, [navigate]);

  // Clear error when inputs change
  useEffect(() => {
    if (error) {
      setError('');
      setAttemptsRemaining(null);
      setMinutesLocked(null);
    }
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

    // Validation
    if (!employeeCode.trim()) {
      setError('Please enter employee code');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    if (pin.length > 6) {
      setError('PIN must be at most 6 digits');
      return;
    }

    setLoading(true);
    setError('');
    setAttemptsRemaining(null);
    setMinutesLocked(null);

    try {
      const response = await posLoginService.login(employeeCode, pin);

      if (response.success) {
        // Login successful, navigate to POS
        navigate('/pos');
      } else {
        // Handle different error codes
        const errorData = response.error;

        if (typeof errorData === 'object') {
          setError(errorData.message || 'Login failed');

          // Handle specific error codes
          if (errorData.code === 'INVALID_PIN' && errorData.attemptsRemaining !== undefined) {
            setAttemptsRemaining(errorData.attemptsRemaining);
          } else if (errorData.code === 'PIN_LOCKED' && errorData.minutesLeft) {
            setMinutesLocked(errorData.minutesLeft);
          }
        } else {
          setError(errorData || 'Login failed');
        }

        // Clear PIN on error
        setPin('');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setPin('');
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
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2" />
                  <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div className="flex-1">
                  <span className="text-[13px] font-['Poppins',sans-serif] text-red-700 block">
                    {error}
                  </span>
                  {attemptsRemaining !== null && attemptsRemaining >= 0 && (
                    <span className="text-[11px] font-['Poppins',sans-serif] text-red-600 block mt-1">
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                    </span>
                  )}
                  {minutesLocked !== null && (
                    <span className="text-[11px] font-['Poppins',sans-serif] text-red-600 block mt-1">
                      Try again in {minutesLocked} minute{minutesLocked !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
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
              placeholder="USER001"
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-[16px] font-['Poppins',sans-serif] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              autoFocus
            />
          </div>

          {/* PIN Input */}
          <div className="mb-4">
            <label className="block text-[14px] font-semibold font-['Poppins',sans-serif] text-gray-700 mb-2">
              PIN (4-6 digits)
            </label>
            <div className="relative">
              <input
                type="password"
                value={pin}
                readOnly
                placeholder="Enter PIN"
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-[24px] font-['Poppins',sans-serif] tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                {pin.length > 0 && !loading && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Clear"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-gray-500 font-['Poppins',sans-serif] text-right">
              {pin.length}/6
            </p>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {numbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberClick(num)}
                disabled={loading || minutesLocked !== null}
                className="h-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400 rounded-lg text-[24px] font-semibold font-['Poppins',sans-serif] text-gray-800 transition-colors"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              disabled={loading || minutesLocked !== null}
              className="h-16 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors col-start-3"
              title="Backspace"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={minutesLocked !== null ? 'text-gray-400' : 'text-gray-800'}>
                <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading || !employeeCode || pin.length < 4 || minutesLocked !== null}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-[16px] font-bold font-['Poppins',sans-serif] transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Logging in...
              </>
            ) : minutesLocked !== null ? (
              `Locked for ${minutesLocked} minute${minutesLocked !== 1 ? 's' : ''}`
            ) : (
              'Login to POS'
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
