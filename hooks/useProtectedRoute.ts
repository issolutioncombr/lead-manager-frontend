'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from './useAuth';

export const useProtectedRoute = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { token, loading, seller } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token) {
      setIsReady(false);
      router.replace('/login');
      return;
    }

    if (seller) {
      const allowedPrefixes = ['/appointments', '/attendance'];
      const isAllowed = allowedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      );

      if (!isAllowed) {
        setIsReady(false);
        router.replace('/attendance');
        return;
      }
    }

    setIsReady(true);
  }, [router, token, loading, seller, pathname]);

  return isReady;
};
