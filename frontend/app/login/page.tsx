"use client";
import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { LoginForm } from '../../components/LoginForm';
import { logger } from '@/utils/logger';

export default function LoginPage() {
  const { user, isLoaded, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (isLoaded && isAuthenticated && user) {
      logger.log('🔄 LoginPage: User already authenticated, redirecting to dashboard');
      logger.log('🔄 LoginPage: User details:', { id: user.id, username: user.username, role: user.role });

      // Use Next.js client-side navigation to preserve in-memory auth state.
      // window.location.replace causes a full reload which resets the Jotai store,
      // triggering a redirect loop (dashboard → login → dashboard).
      router.replace('/dashboard');
    }
  }, [isLoaded, isAuthenticated, user, router]);

  // Show loading while checking authentication
  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100vw',
          background: `url('/login-bg.jpg') center center / cover no-repeat fixed`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
      </div>
    );
  }

  // If already authenticated, don't render the login form (redirect is happening)
  if (isAuthenticated && user) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: `url('/login-bg.jpg') center center / cover no-repeat fixed`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#757575', // iets donkerder grijs
          borderRadius: 8,
          boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
          padding: 32,
          minWidth: 350,
          maxWidth: '90vw',
          border: '5px solid #7b2326',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-with-text.png" alt="Custom Saddlery" style={{ width: 120, margin: '0 auto' }} />
        <Suspense fallback={<div>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
