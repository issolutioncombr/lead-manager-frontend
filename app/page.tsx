'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getStoredAuth } from '../lib/auth-storage';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored?.token) {
      router.replace('/login');
      return;
    }

    router.replace(stored.seller ? '/attendance' : '/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg text-gray-500">Carregando...</p>
    </div>
  );
}
