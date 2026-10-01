'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'register') {
      if (password.length < 6) {
        setError('Password minimal 6 karakter');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password);
      setLoading(false);
      if (error) {
        setError(error);
      } else {
        setError(null);
        setMode('login');
        setEmail('');
        setPassword('');
        setErrorRegistrasiBerhasil();
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        setError(error);
      } else {
        router.push('/dashboard');
      }
    }
  };

  const [registerSuccess, setRegisterSuccess] = useState(false);

  function setErrorRegistrasiBerhasil() {
    setRegisterSuccess(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">DistributorOS</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'login'
                ? 'Masuk untuk mengelola distribusi sembako Anda'
                : 'Daftar akun admin baru untuk mulai mengelola distribusi'}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {registerSuccess && mode === 'login' && (
            <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              Akun berhasil dibuat. Silakan masuk dengan email dan password Anda.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@distributor.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mode === 'register' && (
                <p className="text-xs text-muted-foreground">Minimal 6 karakter</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Memproses...'
                : mode === 'login'
                  ? 'Masuk'
                  : 'Daftar'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === 'login' ? (
              <p className="text-muted-foreground">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); setRegisterSuccess(false); }}
                  className="font-medium text-slate-900 underline hover:no-underline"
                >
                  Daftar di sini
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="font-medium text-slate-900 underline hover:no-underline"
                >
                  Masuk di sini
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
