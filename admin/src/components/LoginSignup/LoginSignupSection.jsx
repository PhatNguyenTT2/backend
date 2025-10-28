import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../../services/authService';

export default function LoginSignupSection() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('login');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Check if already logged in
  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/dashboard');
    }
  }, [navigate]);

  // Sync tab with route
  useEffect(() => {
    if (location.pathname === '/signup') {
      setActiveTab('register');
    } else if (location.pathname === '/') {
      setActiveTab('login');
    }
  }, [location.pathname]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccessMessage('');
    navigate(tab === 'login' ? '/' : '/signup');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authService.login(username, password);

      if (result.success) {
        // Login successful - redirect to dashboard
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else if (err.response?.status === 403) {
        setError('Account is inactive. Please contact administrator.');
      } else {
        setError('Unable to connect to server. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const result = await authService.register({
        fullName,
        username,
        email,
        password
      });

      if (result.success) {
        setSuccessMessage('Registration successful! Please login with your credentials.');
        // Clear form
        setFullName('');
        setUsername('');
        setEmail('');
        setPassword('');
        // Switch to login tab after 2 seconds
        setTimeout(() => {
          handleTabChange('login');
        }, 2000);
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.status === 400) {
        setError('Invalid input. Please check your information.');
      } else {
        setError('Unable to connect to server. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-16">
      <div className="max-w-[500px] mx-auto bg-white rounded-[15px] border border-[#ececec] shadow-sm p-8">
        {/* Tab Headers - Centered */}
        <div className="flex justify-center gap-8 mb-6 border-b border-[#ececec]">
          <button
            onClick={() => handleTabChange('login')}
            className={`font-['Quicksand',sans-serif] font-bold text-[28px] pb-3 transition-colors ${activeTab === 'login'
              ? 'text-[#3bb77e] border-b-2 border-[#3bb77e]'
              : 'text-[#7e7e7e]'
              }`}
            disabled={loading}
          >
            Login
          </button>
          <button
            onClick={() => handleTabChange('register')}
            className={`font-['Quicksand',sans-serif] font-bold text-[28px] pb-3 transition-colors ${activeTab === 'register'
              ? 'text-[#3bb77e] border-b-2 border-[#3bb77e]'
              : 'text-[#7e7e7e]'
              }`}
            disabled={loading}
          >
            Register
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-[8px]">
            <p className="font-['Lato',sans-serif] text-red-600 text-[14px]">
              {error}
            </p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-[8px]">
            <p className="font-['Lato',sans-serif] text-green-600 text-[14px]">
              {successMessage}
            </p>
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' && (
          <div>
            <p className="font-['Lato',sans-serif] text-[#7e7e7e] text-[14px] leading-[22px] mb-6 text-center">
              Sign in to access the admin dashboard and manage your store.
            </p>

            <form className="space-y-5" onSubmit={handleLoginSubmit}>
              {/* Username/Email Field */}
              <div>
                <label className="font-['Lato',sans-serif] text-[#253d4e] text-[13px] leading-[20px] block mb-2">
                  Username or email address <span className="text-[#3bb77e]">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-[50px] px-4 border border-[#ececec] rounded-[8px] font-['Lato',sans-serif] text-[14px] text-[#253d4e] focus:border-[#3bb77e] focus:outline-none transition-colors"
                  placeholder="Enter your username or email"
                  required
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="font-['Lato',sans-serif] text-[#253d4e] text-[13px] leading-[20px] block mb-2">
                  Password <span className="text-[#3bb77e]">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[50px] px-4 border border-[#ececec] rounded-[8px] font-['Lato',sans-serif] text-[14px] text-[#253d4e] focus:border-[#3bb77e] focus:outline-none transition-colors"
                  placeholder="Enter your password"
                  required
                />
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-[18px] h-[18px] border border-[#ececec] rounded-[4px] accent-[#3bb77e] cursor-pointer"
                  />
                  <span className="font-['Lato',sans-serif] text-[#253d4e] text-[13px]">
                    Remember me
                  </span>
                </label>
                <a
                  href="#"
                  className="font-['Lato',sans-serif] text-[#3bb77e] text-[13px] hover:underline"
                >
                  Lost your password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[50px] bg-[#3bb77e] text-white font-['Quicksand',sans-serif] font-bold text-[16px] rounded-[8px] hover:bg-[#2fa56a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>
            </form>
          </div>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <div>
            <p className="font-['Lato',sans-serif] text-[#7e7e7e] text-[14px] leading-[22px] mb-6 text-center">
              Create an admin account to manage products, orders, and customers.
            </p>

            <form className="space-y-5" onSubmit={handleRegisterSubmit}>
              {/* Full Name Field */}
              <div>
                <label className="font-['Lato',sans-serif] text-[#253d4e] text-[13px] leading-[20px] block mb-2">
                  Full Name <span className="text-[#3bb77e]">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-[50px] px-4 border border-[#ececec] rounded-[8px] font-['Lato',sans-serif] text-[14px] text-[#253d4e] focus:border-[#3bb77e] focus:outline-none transition-colors"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Username Field */}
              <div>
                <label className="font-['Lato',sans-serif] text-[#253d4e] text-[13px] leading-[20px] block mb-2">
                  Username <span className="text-[#3bb77e]">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-[50px] px-4 border border-[#ececec] rounded-[8px] font-['Lato',sans-serif] text-[14px] text-[#253d4e] focus:border-[#3bb77e] focus:outline-none transition-colors"
                  placeholder="Enter your username"
                  required
                />
              </div>

              {/* Email Field */}
              <div>
                <label className="font-['Lato',sans-serif] text-[#253d4e] text-[13px] leading-[20px] block mb-2">
                  Email address <span className="text-[#3bb77e]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[50px] px-4 border border-[#ececec] rounded-[8px] font-['Lato',sans-serif] text-[14px] text-[#253d4e] focus:border-[#3bb77e] focus:outline-none transition-colors"
                  placeholder="Enter your email address"
                  required
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="font-['Lato',sans-serif] text-[#253d4e] text-[13px] leading-[20px] block mb-2">
                  Password <span className="text-[#3bb77e]">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[50px] px-4 border border-[#ececec] rounded-[8px] font-['Lato',sans-serif] text-[14px] text-[#253d4e] focus:border-[#3bb77e] focus:outline-none transition-colors"
                  placeholder="Create a password (min 8 characters)"
                  required
                  minLength={8}
                />
              </div>

              {/* Admin Role Note */}
              <div className="bg-[#def9ec] p-4 rounded-[8px] border border-[#3bb77e]/20">
                <p className="font-['Lato',sans-serif] text-[#253d4e] text-[12px] leading-[20px]">
                  <span className="font-bold text-[#3bb77e]">Admin Account:</span> This account will have full access to manage products, orders, customers, and store settings.
                </p>
              </div>

              {/* Privacy Policy Text */}
              <div className="bg-[#f4f6fa] p-4 rounded-[8px]">
                <p className="font-['Lato',sans-serif] text-[#7e7e7e] text-[12px] leading-[20px]">
                  Your personal data will be used to support your experience throughout this admin dashboard, to manage access to your account, and for other purposes described in our{' '}
                  <a href="#" className="text-[#3bb77e] hover:underline">
                    privacy policy
                  </a>
                  .
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[50px] bg-[#3bb77e] text-white font-['Quicksand',sans-serif] font-bold text-[16px] rounded-[8px] hover:bg-[#2fa56a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create Admin Account'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
