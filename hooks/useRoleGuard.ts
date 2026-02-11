'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from './useAuth';

export const useRoleGuard = (allowedRoles: string[], redirectTo = '/dashboard') => {
  const router = useRouter();
  const { user, loading } = useAuth();

  const isAuthorized = useMemo(() => {
    if (!user?.role) {
      return false;
    }
    const normalizedAllowed = allowedRoles.map((r) =>
      String(r ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
    );
    const normalizedRole = String(user.role)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

    if (user.isAdmin && normalizedAllowed.includes('admin')) {
      return true;
    }
    return normalizedAllowed.includes(normalizedRole);
  }, [allowedRoles, user?.role, user?.isAdmin]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      return;
    }

    if (!isAuthorized) {
      router.replace(redirectTo);
    }
  }, [isAuthorized, loading, redirectTo, router, user]);

  return { isAuthorized, loading };
};
