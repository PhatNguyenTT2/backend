import React, { useState, useEffect } from 'react';
import authService from '../../../../services/authService';

export const EmployeeProfileSection = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        if (authService.isAuthenticated()) {
          // Lấy thông tin user từ API để đảm bảo có đầy đủ thông tin employee
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);

          // Cập nhật localStorage với thông tin mới
          localStorage.setItem('adminUser', JSON.stringify(currentUser));
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  // Get display name from employee or fallback to username
  const getDisplayName = () => {
    if (user?.employee?.fullName) {
      return user.employee.fullName;
    }
    return user?.username || 'User';
  };

  // Get initials for avatar
  const getInitials = () => {
    const name = getDisplayName();
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Default avatar with initials
  const defaultAvatar = 'https://ui-avatars.com/api/?name=' +
    encodeURIComponent(getDisplayName()) +
    '&background=10b981&color=fff&size=48&bold=true';

  // Get role name and color
  const getRoleInfo = () => {
    if (!user?.role) return { name: 'User', color: 'text-gray-500' };

    const roleName = user.role.roleName || 'User';
    let color = 'text-gray-500';

    switch (roleName.toLowerCase()) {
      case 'admin':
        color = 'text-red-600';
        break;
      case 'manager':
        color = 'text-blue-600';
        break;
      case 'staff':
        color = 'text-green-600';
        break;
      default:
        color = 'text-gray-600';
    }

    return { name: roleName, color };
  };

  // Get department info
  const getDepartmentInfo = () => {
    if (user?.employee?.department?.departmentName) {
      return {
        name: user.employee.department.departmentName,
        code: user.employee.department.departmentCode
      };
    }
    return null;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl mb-3 shadow-sm animate-pulse">
        <div className="flex items-center">
          <div className="w-14 h-14 rounded-full bg-gray-300 mr-3"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-300 rounded w-28 mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-20 mb-1"></div>
            <div className="h-3 bg-gray-300 rounded w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-xl mb-3 border border-red-200">
        <p className="text-red-600 text-xs text-center">{error}</p>
      </div>
    );
  }

  // No user state
  if (!user) {
    return null;
  }

  const roleInfo = getRoleInfo();
  const departmentInfo = getDepartmentInfo();

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl mb-3 shadow-sm border border-emerald-100">
      <div className="flex items-start">
        {/* Avatar */}
        <div className="relative flex-shrink-0 mr-3">
          <img
            src={user.avatar || defaultAvatar}
            alt={getDisplayName()}
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
            onError={(e) => {
              e.target.src = defaultAvatar;
            }}
          />
          {/* Active Status Indicator */}
          {user.isActive && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"
              title="Active"
            ></div>
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          {/* Full Name */}
          <h3
            className="font-bold text-gray-800 text-base truncate mb-1"
            title={getDisplayName()}
          >
            {getDisplayName()}
          </h3>

          {/* Role */}
          <div className="flex items-center mb-1">
            <span className="text-xs text-gray-400 mr-1">🎭</span>
            <p
              className={`text-xs font-semibold truncate ${roleInfo.color}`}
              title={`Role: ${roleInfo.name}`}
            >
              {roleInfo.name}
            </p>
          </div>

          {/* Department */}
          {departmentInfo && (
            <div className="flex items-center mb-1">
              <span className="text-xs text-gray-400 mr-1">📍</span>
              <p
                className="text-xs text-gray-600 truncate"
                title={`Department: ${departmentInfo.name}`}
              >
                {departmentInfo.name}
              </p>
            </div>
          )}

          {/* User Code */}
          <div className="flex items-center">
            <span className="text-xs text-gray-400 mr-1">🆔</span>
            <p
              className="text-xs text-gray-500 font-mono"
              title={`User Code: ${user.userCode}`}
            >
              {user.userCode}
            </p>
          </div>
        </div>
      </div>

      {/* Additional Info - Last Login */}
      {user.lastLogin && (
        <div className="mt-3 pt-3 border-t border-emerald-100">
          <p className="text-xs text-gray-400 text-center">
            Last login: {new Date(user.lastLogin).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      )}
    </div>
  );
};
