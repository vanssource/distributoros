'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Package2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <Package2 className="h-7 w-7" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );
}
