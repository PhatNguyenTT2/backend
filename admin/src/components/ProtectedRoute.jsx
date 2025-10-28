import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import authService from '../services/authService'

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */
export default function ProtectedRoute({ children }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      // Not logged in, redirect to login page
      navigate('/', { replace: true })
    }
  }, [navigate])

  // If authenticated, render children
  if (authService.isAuthenticated()) {
    return children
  }

  // While checking, render nothing
  return null
}
