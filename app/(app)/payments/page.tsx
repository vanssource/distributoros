'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRupiah, formatDate } from '@/lib/format';
import type { Payment, Invoice } from '@/lib/types';
import { CreditCard } from 'lucide-react';

type PaymentRow = Payment & {
  invoices?: {
    invoice_number: string;
    customers?: { store_name: string } | null;
  } | null;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalReceived, setTotalReceived] = useState(0);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*, invoices(invoice_number, customers(store_name))')
      .order('payment_date', { ascending: false });
    const rows = (data ?? []) as PaymentRow[];
    setPayments(rows);
    setTotalReceived(rows.reduce((s, p) => s + Number(p.amount), 0));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">Riwayat pembayaran dari customer</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Total Diterima</p>
            <p className="mt-1.5 text-2xl font-bold text-emerald-600">{formatRupiah(totalReceived)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Jumlah Pembayaran</p>
            <p className="mt-1.5 text-2xl font-bold">{payments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Catat Pembayaran Baru</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Buka halaman Invoices untuk mencatat pembayaran</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat...</p>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <CreditCard className="h-10 w-10 opacity-40" />
              <p>Belum ada pembayaran</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="font-medium">{p.invoices?.invoice_number ?? '-'}</TableCell>
                      <TableCell>{p.invoices?.customers?.store_name ?? '-'}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">{formatRupiah(Number(p.amount))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{p.payment_method.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.notes ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
