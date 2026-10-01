'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { Settings as SettingsIcon, User, Mail, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Pengaturan aplikasi dan akun</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-slate-600" />
            <div>
              <CardTitle className="text-base">Akun Admin</CardTitle>
              <CardDescription>Informasi akun yang sedang login</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email ?? '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium">Admin</p>
            </div>
            <Badge variant="default">Active</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-slate-600" />
            <div>
              <CardTitle className="text-base">Tentang DistributorOS</CardTitle>
              <CardDescription>Sistem manajemen distributor sembako</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>DistributorOS adalah aplikasi MVP untuk membantu distributor sembako mengelola pesanan toko melalui Telegram.</p>
            <p>Fitur utama: Order via Telegram, manajemen produk, manajemen stok, invoice, dan piutang.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
