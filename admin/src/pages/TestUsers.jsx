import React, { useEffect, useState } from 'react';
import userService from '../services/userService';
import authService from '../services/authService';

const TestUsers = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check token
    const storedToken = localStorage.getItem('adminToken');
    const storedUser = authService.getUser();
    setToken(storedToken);
    setUser(storedUser);

    // Try to fetch users
    const testFetch = async () => {
      try {
        setLoading(true);
        console.log('🔍 Testing user fetch...');
        console.log('📝 Token:', storedToken ? `${storedToken.substring(0, 30)}...` : 'null');
        console.log('👤 User:', storedUser);

        const response = await userService.getUsers({ page: 1, per_page: 10 });
        console.log('✅ Response:', response);
        setData(response);
      } catch (err) {
        console.error('❌ Error:', err);
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (storedToken) {
      testFetch();
    }
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">🔧 User Service Debug Panel</h1>

        {/* Token Status */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">🔑 Authentication Status</h2>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Token: </span>
              <span className={token ? 'text-green-600' : 'text-red-600'}>
                {token ? `✅ Valid (${token.substring(0, 30)}...)` : '❌ Not found'}
              </span>
            </div>
            {user && (
              <div>
                <span className="font-medium">User: </span>
                <span className="text-blue-600">
                  {user.fullName} ({user.username}) - Role: {user.role?.roleName || 'N/A'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-blue-700">Loading users data...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-lg font-semibold text-red-700 mb-2">❌ Error Details</h2>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Message: </span>
                <span className="text-red-600">{error.message || 'Unknown error'}</span>
              </div>
              {error.response && (
                <>
                  <div>
                    <span className="font-medium">Status: </span>
                    <span className="text-red-600">{error.response.status}</span>
                  </div>
                  <div>
                    <span className="font-medium">Response: </span>
                    <pre className="text-xs mt-1 p-2 bg-white rounded overflow-auto">
                      {JSON.stringify(error.response.data, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleRetry}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              🔄 Retry
            </button>
          </div>
        )}

        {/* Success State */}
        {data && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="text-lg font-semibold text-green-700 mb-3">✅ Success! Users Data Loaded</h2>

            {/* Summary */}
            <div className="mb-4 p-3 bg-white rounded">
              <h3 className="font-semibold mb-2">📊 Summary:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Total Users: <span className="font-bold">{data.data?.pagination?.total || 0}</span></div>
                <div>Current Page: <span className="font-bold">{data.data?.pagination?.current_page || 1}</span></div>
                <div>Per Page: <span className="font-bold">{data.data?.pagination?.per_page || 20}</span></div>
                <div>Total Pages: <span className="font-bold">{data.data?.pagination?.total_pages || 1}</span></div>
              </div>
            </div>

            {/* Users Table */}
            {data.data?.users && data.data.users.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <h3 className="font-semibold mb-2">👥 Users List:</h3>
                <table className="min-w-full bg-white border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1 text-xs">User Code</th>
                      <th className="border px-2 py-1 text-xs">Name</th>
                      <th className="border px-2 py-1 text-xs">Role</th>
                      <th className="border px-2 py-1 text-xs">Department</th>
                      <th className="border px-2 py-1 text-xs">Email</th>
                      <th className="border px-2 py-1 text-xs">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.users.map((user, index) => (
                      <tr key={user.id || index} className="hover:bg-gray-50">
                        <td className="border px-2 py-1 text-xs">{user.userCode}</td>
                        <td className="border px-2 py-1 text-xs">{user.fullName}</td>
                        <td className="border px-2 py-1 text-xs">{user.role?.roleName || 'N/A'}</td>
                        <td className="border px-2 py-1 text-xs">{user.department?.departmentName || 'N/A'}</td>
                        <td className="border px-2 py-1 text-xs">{user.email}</td>
                        <td className="border px-2 py-1 text-xs">
                          <span className={user.isActive ? 'text-green-600' : 'text-red-600'}>
                            {user.isActive ? '✅' : '❌'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Raw JSON */}
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-sm text-gray-700 hover:text-gray-900">
                🔍 View Raw JSON Response
              </summary>
              <pre className="text-xs mt-2 p-3 bg-gray-800 text-green-400 rounded overflow-auto max-h-96">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* No token warning */}
        {!token && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700">
              ⚠️ No authentication token found. Please login first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestUsers;
