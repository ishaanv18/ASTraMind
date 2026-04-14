import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/appStore';

/**
 * Wraps any route that requires GitHub authentication.
 * If no token/user is found in the store, redirects back to "/" (landing page).
 * Preserves the attempted URL so we can return after auth if needed.
 */
export default function ProtectedRoute({ children }) {
  const { githubToken, githubUser } = useAppStore();
  const location = useLocation();

  // Not authenticated — send them back to landing
  if (!githubToken || !githubUser) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}
