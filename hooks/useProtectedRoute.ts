'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import api from '../lib/api';
import { useAuth } from './useAuth';

export const useProtectedRoute = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { token, loading, seller } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [sellerLinkActive, setSellerLinkActive] = useState<boolean | null>(null);
  const requireSellerLink =
    process.env.NEXT_PUBLIC_SELLER_REQUIRE_LINK_FOR_ACCESS !== 'false';

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
      const alwaysAllowedPrefixes = ['/appointments', '/attendance', '/seller-notes', '/seller-reminders'];
      const linkRequiredPrefixes = ['/leads', '/mensagens-api'];

      const isAlwaysAllowed = alwaysAllowedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      );
      const isLinkRequired = linkRequiredPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      );

      if (isAlwaysAllowed) {
        setIsReady(true);
        return;
      }

      if (isLinkRequired) {
        if (!requireSellerLink) {
          setIsReady(true);
          return;
        }
        if (sellerLinkActive === null) {
          setIsReady(false);
          return;
        }
        if (!sellerLinkActive) {
          setIsReady(false);
          router.replace('/attendance');
          return;
        }
        setIsReady(true);
        return;
      }

      setIsReady(false);
      router.replace('/attendance');
      return;
    }

    setIsReady(true);
  }, [router, token, loading, seller, pathname, sellerLinkActive, requireSellerLink]);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      setSellerLinkActive(null);
      return;
    }
    if (!seller) {
      setSellerLinkActive(null);
      return;
    }
    if (!requireSellerLink) {
      setSellerLinkActive(true);
      return;
    }
    let cancelled = false;
    setSellerLinkActive(null);
    api
      .get<{ active: boolean }>('/sellers/me/video-call-link/active')
      .then((resp) => {
        if (cancelled) return;
        setSellerLinkActive(!!resp.data?.active);
      })
      .catch(() => {
        if (cancelled) return;
        setSellerLinkActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, token, seller, requireSellerLink]);

  return isReady;
};
