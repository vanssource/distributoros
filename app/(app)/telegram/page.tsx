'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, CheckCircle2, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function TelegramPage() {
  const [botToken, setBotToken] = useState('');
  const [adminChatId, setAdminChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testing, setTesting] = useState(false);

  const functionUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/functions/v1/telegram-bot`
    : '';

  async function setWebhook() {
    if (!botToken) {
      toast.error('Masukkan Bot Token terlebih dahulu');
      return;
    }
    setTesting(true);
    try {
      const url = webhookUrl || functionUrl;
      const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Webhook berhasil diatur!');
      } else {
        toast.error(`Gagal: ${data.description}`);
      }
    } catch {
      toast.error('Gagal mengatur webhook');
    }
    setTesting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telegram</h1>
        <p className="text-sm text-muted-foreground">Konfigurasi Telegram Bot untuk customer</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-base">Telegram Bot Setup</CardTitle>
              <CardDescription>Hubungkan bot Telegram Anda untuk menerima pesanan dari customer</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Cara setup:</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Buat bot via <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a> di Telegram</li>
                <li>Salin Bot Token yang diberikan</li>
                <li>Dapatkan Chat ID Anda dengan mengirim pesan ke bot, lalu cek via getUpdates</li>
                <li>Set Bot Token dan Admin Chat ID sebagai environment variables di Supabase</li>
                <li>Atur webhook untuk mengarahkan update ke edge function</li>
              </ol>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Bot Token</Label>
            <Input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            />
            <p className="text-xs text-muted-foreground">Token dari @BotFather. Disimpan sebagai TELEGRAM_BOT_TOKEN di Supabase secrets.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Admin Chat ID</Label>
            <Input
              value={adminChatId}
              onChange={(e) => setAdminChatId(e.target.value)}
              placeholder="123456789"
            />
            <p className="text-xs text-muted-foreground">Notifikasi order baru akan dikirim ke Chat ID ini. Disimpan sebagai TELEGRAM_ADMIN_CHAT_ID.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input
              value={webhookUrl || functionUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={functionUrl || 'https://your-project.supabase.co/functions/v1/telegram-bot'}
            />
            <p className="text-xs text-muted-foreground">URL edge function Telegram bot. Biarkan kosong untuk menggunakan URL otomatis.</p>
          </div>

          <Button onClick={setWebhook} disabled={testing} className="gap-2">
            {testing ? 'Mengatur...' : 'Atur Webhook'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bot Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Customer pemesanan via Telegram dengan kategori produk</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Shopping cart dengan multiple produk</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Checkout otomatis membuat order di database</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Notifikasi admin saat order baru masuk</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Cek pesanan dan piutang via bot</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Registrasi otomatis customer baru</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment Variables</CardTitle>
          <CardDescription>Set these secrets in your Supabase project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="font-mono text-sm">TELEGRAM_BOT_TOKEN</p>
              <p className="text-xs text-muted-foreground">Bot token from BotFather</p>
            </div>
            <Badge variant="outline">Required</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="font-mono text-sm">TELEGRAM_ADMIN_CHAT_ID</p>
              <p className="text-xs text-muted-foreground">Admin Telegram chat ID for notifications</p>
            </div>
            <Badge variant="outline">Required</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
