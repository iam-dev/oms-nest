"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/Role';
import { logger } from '@/utils/logger';

interface Options {
  roles?: UserRole[];
}

export function withPageRequiredAuth<P extends object>(Component: React.ComponentType<P>, options?: Options) {
  const allowedRoles = options?.roles || Object.values(UserRole);
  return function WithPageRequiredAuth(props: P) {
    const { user, isLoaded } = useAuth();
    const router = useRouter();

    logger.log('🔒 withPageRequiredAuth: checking auth', {
      user: user ? { role: user.role, id: user.id } : null,
      isLoaded,
      allowedRoles,
      hasUser: !!user,
      userRoleInAllowed: user ? allowedRoles.includes(user.role) : false
    });

    useEffect(() => {
      logger.log('🔒 withPageRequiredAuth useEffect:', {
        isLoaded,
        user: !!user,
        userRole: user?.role,
        allowedRoles,
        roleCheckPassed: user ? allowedRoles.includes(user.role) : false
      });

      // Only proceed if auth is fully loaded
      if (!isLoaded) {
        logger.log('🔒 withPageRequiredAuth: auth not loaded yet, waiting...');
        return;
      }

      // Add a small delay to prevent conflicts with login redirects
      const timeoutId = setTimeout(() => {
        logger.log('🔒 withPageRequiredAuth: performing delayed auth check');

        // Check if user is authenticated and has proper role
        if (!user) {
          logger.log('🔒 withPageRequiredAuth: no user found, redirecting to login');

          // Use window.location for reliable redirect in staging/production
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocalhost) {
            router.replace('/login');
          } else {
            window.location.replace('/login');
          }
        } else if (!allowedRoles.includes(user.role)) {
          logger.log('🔒 withPageRequiredAuth: user role not allowed', {
            userRole: user.role,
            allowedRoles,
            roleType: typeof user.role,
            comparison: allowedRoles.map(role => ({ role, equals: role === user.role, types: `${typeof role} vs ${typeof user.role}` }))
          });

          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocalhost) {
            router.replace('/login');
          } else {
            window.location.replace('/login');
          }
        } else {
          logger.log('🔒 withPageRequiredAuth: user authenticated with proper role, allowing access');
        }
      }, 100); // Small delay to prevent navigation conflicts

      return () => clearTimeout(timeoutId);
    // `allowedRoles` is computed once outside the inner component from `options` which
    // is stable for the lifetime of the HOC — it is not a reactive value and does not
    // need to be in the dep array (adding it would cause eslint to warn about outer-scope
    // non-reactive values; removing it is the correct fix per react-hooks/exhaustive-deps).
    }, [user, isLoaded, router]);

    // Show loading while auth state is being determined
    if (!isLoaded) {
      logger.log('🔒 withPageRequiredAuth: showing loading (auth not loaded)');
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      );
    }

    // Check auth after loading is complete
    if (!user) {
      logger.log('🔒 withPageRequiredAuth: returning null (no user after loading)');
      return null;
    }

    if (!allowedRoles.includes(user.role)) {
      logger.log('🔒 withPageRequiredAuth: returning null (role not allowed after loading)', {
        userRole: user.role,
        allowedRoles,
        roleType: typeof user.role
      });
      return null;
    }

    logger.log('🔒 withPageRequiredAuth: rendering component');
    return <Component {...props} />;
  };
}
