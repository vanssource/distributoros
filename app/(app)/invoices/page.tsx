'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRupiah, formatDate } from '@/lib/format';
import type { Invoice, Payment } from '@/lib/types';
import { FileText, Eye, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('invoices').select('*, customers(store_name), orders(order_number)').order('invoice_date', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setInvoices((data ?? []) as Invoice[]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  async function openDetail(inv: Invoice) {
    setSelected(inv);
    setDetailLoading(true);
    const { data: pays } = await supabase.from('payments').select('*').eq('invoice_id', inv.id).order('payment_date', { ascending: false });
    setPayments((pays ?? []) as Payment[]);
    setDetailLoading(false);
  }

  async function recordPayment() {
    if (!selected) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Masukkan jumlah pembayaran yang valid');
      return;
    }
    setSaving(true);

    const newPaid = Number(selected.paid_amount) + amount;
    const newOutstanding = Number(selected.total_amount) - newPaid;
    let newStatus = selected.status;
    if (newOutstanding <= 0) newStatus = 'paid';
    else if (newPaid > 0) newStatus = 'partially_paid';

    const { error: payError } = await supabase.from('payments').insert({
      invoice_id: selected.id,
      amount,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: payMethod,
      notes: payNotes || null,
    });

    if (payError) {
      toast.error(payError.message);
      setSaving(false);
      return;
    }

    await supabase.from('invoices').update({
      paid_amount: newPaid,
      outstanding_amount: Math.max(0, newOutstanding),
      status: newStatus,
    }).eq('id', selected.id);

    // Update order payment_status
    if (selected.order_id) {
      await supabase.from('orders').update({
        payment_status: newStatus === 'paid' ? 'paid' : 'partially_paid',
      }).eq('id', selected.order_id);
    }

    toast.success(`Pembayaran ${formatRupiah(amount)} berhasil dicatat`);
    setSaving(false);
    setPayDialogOpen(false);
    setPayAmount('');
    setPayNotes('');
    loadInvoices();
    // Refresh detail
    const { data: updated } = await supabase.from('invoices').select('*, customers(store_name), orders(order_number)').eq('id', selected.id).maybeSingle();
    if (updated) {
      setSelected(updated as Invoice);
      const { data: pays } = await supabase.from('payments').select('*').eq('invoice_id', selected.id).order('payment_date', { ascending: false });
      setPayments((pays ?? []) as Payment[]);
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      unpaid: { label: 'Unpaid', variant: 'secondary' },
      partially_paid: { label: 'Partially Paid', variant: 'outline' },
      paid: { label: 'Paid', variant: 'default' },
      overdue: { label: 'Overdue', variant: 'destructive' },
    };
    const cfg = map[status] ?? { label: status, variant: 'outline' as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Kelola invoice dan piutang</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'unpaid', 'partially_paid', 'paid', 'overdue'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="capitalize"
          >
            {s === 'all' ? 'Semua' : s.replace('_', ' ')}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat...</p>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <FileText className="h-10 w-10 opacity-40" />
              <p>Belum ada invoice</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.customers?.store_name ?? '-'}</TableCell>
                      <TableCell className="text-sm">{formatDate(inv.invoice_date)}</TableCell>
                      <TableCell className="text-sm">{formatDate(inv.due_date)}</TableCell>
                      <TableCell className="text-right">{formatRupiah(Number(inv.total_amount))}</TableCell>
                      <TableCell className="text-right">
                        {Number(inv.outstanding_amount) > 0 ? (
                          <span className="font-medium text-amber-600">{formatRupiah(Number(inv.outstanding_amount))}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(inv)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice {selected?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selected.customers?.store_name ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Order</p>
                  <p className="font-medium">{selected.orders?.order_number ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal Invoice</p>
                  <p className="font-medium">{formatDate(selected.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Jatuh Tempo</p>
                  <p className="font-medium">{formatDate(selected.due_date)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatRupiah(Number(selected.total_amount))}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-lg font-bold text-emerald-700">{formatRupiah(Number(selected.paid_amount))}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-bold text-amber-700">{formatRupiah(Number(selected.outstanding_amount))}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {statusBadge(selected.status)}
                </div>
                {Number(selected.outstanding_amount) > 0 && (
                  <Button size="sm" onClick={() => setPayDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Catat Pembayaran
                  </Button>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Riwayat Pembayaran</h3>
                {detailLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat...</p>
                ) : payments.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 py-4 text-center text-sm text-muted-foreground">Belum ada pembayaran</p>
                ) : (
                  <div className="rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                          <TableHead>Metode</TableHead>
                          <TableHead>Catatan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                            <TableCell className="text-right font-medium">{formatRupiah(Number(p.amount))}</TableCell>
                            <TableCell className="capitalize text-sm">{p.payment_method.replace('_', ' ')}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.notes ?? '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-xl font-bold text-amber-700">{formatRupiah(Number(selected?.outstanding_amount ?? 0))}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah Pembayaran</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="500000" />
            </div>
            <div className="space-y-1.5">
              <Label>Metode Pembayaran</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Catatan tambahan" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Batal</Button>
            <Button onClick={recordPayment} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
