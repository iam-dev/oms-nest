"use client";
import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { loginSchema, validateData, sanitizeString } from '../schemas/validation';
import { logger } from '@/utils/logger';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: loginWithContext } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      logger.log('🔄 LoginForm: Starting login process - v2...');
      
      // Sanitize and validate input
      const sanitizedUsername = sanitizeString(username);
      const sanitizedPassword = sanitizeString(password);
      
      const validation = validateData(loginSchema, {
        username: sanitizedUsername,
        password: sanitizedPassword
      });
      
      if (!validation.success) {
        setError(validation.errors.join(', '));
        return;
      }
      
      // Call the login function with validated and sanitized credentials
      const result = await loginWithContext(validation.data.username, validation.data.password);
      logger.log('🔄 LoginForm: Login result:', result);
      
      if (result.success) {
        // Login was successful, wait for auth state to be set before redirect
        const redirect = searchParams.get('redirect') || '/dashboard';
        logger.log('✅ LoginForm: Login successful, preparing redirect to:', redirect);
        logger.log('🔄 LoginForm: Current URL before redirect:', window.location.href);
        logger.log('🔄 LoginForm: Current user from AuthContext:', result.user || 'no user data returned');

        // Wait longer for auth state to propagate and then redirect
        logger.log('🔄 LoginForm: Waiting for auth state to settle...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        logger.log('🔄 LoginForm: Auth state should be stable, attempting redirect to:', redirect);

        // Use Next.js client-side navigation to preserve in-memory auth state.
        // window.location.replace causes a full reload which resets the Jotai store,
        // triggering a redirect loop (dashboard → login → dashboard).
        logger.log('🔄 LoginForm: Using router.replace for client-side navigation');
        router.replace(redirect);

        // Add a small delay to verify redirect
        setTimeout(() => {
          logger.log('🔄 LoginForm: URL after redirect attempt:', window.location.href);
          logger.log('🔄 LoginForm: Current path:', window.location.pathname);
        }, 500);
      } else {
        logger.log('❌ LoginForm: Login failed:', result.message);
        // Show error message from the server if available
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      logger.error('❌ LoginForm: Login error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
      logger.log('🔄 LoginForm: Login process completed, loading set to false');
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="max-w-[350px] mx-auto mb-8 flex flex-col gap-0 bg-white rounded-lg border-2 border-primary shadow-lg p-8"
    >
      <div className="flex flex-col gap-[18px]">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Gebruikersnaam"
          autoComplete="username"
          required
          className="border-2 border-primary rounded-md px-3 py-2 text-base mb-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Wachtwoord"
          autoComplete="current-password"
          required
          className="border-2 border-primary rounded-md px-3 py-2 text-base mb-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button 
          type="submit" 
          className="bg-primary text-white font-semibold border-none rounded-md py-3 text-lg mt-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
          disabled={loading}
        >
          {loading ? 'Inloggen...' : 'Login'}
        </button>
        {error && <div className="text-destructive mt-2">{error}</div>}
      </div>
    </form>
  );
}
