'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';

export default function HomePage() {
  const router = useRouter();
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    const isAuth = checkAuth();
    if (isAuth) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [checkAuth, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-neutral-500 text-sm">加载中...</p>
      </div>
    </div>
  );
}
