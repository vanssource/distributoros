'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatRupiah, formatNumber, formatDate } from '@/lib/format';
import type { Customer, Order, Invoice } from '@/lib/types';
import { Users, Eye } from 'lucide-react';

type CustomerRow = Customer & {
  order_count?: number;
  total_purchase?: number;
  outstanding?: number;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const { data: custs } = await supabase.from('customers').select('*').order('store_name');

    const enriched: CustomerRow[] = [];
    for (const c of custs ?? []) {
      const { count } = await supabase.from('orders').select('id', { count: 'exact' }).eq('customer_id', c.id);
      const { data: orders } = await supabase.from('orders').select('total_amount').eq('customer_id', c.id).neq('status', 'cancelled');
      const totalPurchase = (orders ?? []).reduce((s, o) => s + Number(o.total_amount), 0);
      const { data: invs } = await supabase.from('invoices').select('outstanding_amount').eq('customer_id', c.id).gt('outstanding_amount', 0);
      const outstanding = (invs ?? []).reduce((s, i) => s + Number(i.outstanding_amount), 0);
      enriched.push({ ...c, order_count: count ?? 0, total_purchase: totalPurchase, outstanding });
    }
    setCustomers(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  async function openDetail(c: Customer) {
    setSelected(c);
    setDetailLoading(true);
    const [ordersRes, invoicesRes] = await Promise.all([
      supabase.from('orders').select('*, customers(store_name)').eq('customer_id', c.id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, orders(order_number)').eq('customer_id', c.id).order('invoice_date', { ascending: false }),
    ]);
    setCustomerOrders((ordersRes.data ?? []) as Order[]);
    setCustomerInvoices((invoicesRes.data ?? []) as Invoice[]);
    setDetailLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">Daftar toko pelanggan Anda</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat...</p>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Users className="h-10 w-10 opacity-40" />
              <p>Belum ada customer</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Telegram</TableHead>
                    <TableHead className="text-right">Total Orders</TableHead>
                    <TableHead className="text-right">Total Purchase</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.store_name}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">@{c.telegram_username ?? '-'}</TableCell>
                      <TableCell className="text-right">{formatNumber(c.order_count ?? 0)}</TableCell>
                      <TableCell className="text-right">{formatRupiah(c.total_purchase ?? 0)}</TableCell>
                      <TableCell className="text-right">
                        {c.outstanding && c.outstanding > 0 ? (
                          <span className="font-medium text-amber-600">{formatRupiah(c.outstanding)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Aktif</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(c)}>
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.store_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Owner</p>
                  <p className="font-medium">{selected.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telegram</p>
                  <p className="font-medium">@{selected.telegram_username ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telepon</p>
                  <p className="font-medium">{selected.phone ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Alamat</p>
                  <p className="font-medium">{selected.address ?? '-'}</p>
                </div>
              </div>

              {detailLoading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Memuat...</p>
              ) : (
                <>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Order History</h3>
                    <div className="rounded-lg border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerOrders.map((o) => (
                            <TableRow key={o.id}>
                              <TableCell className="font-medium">{o.order_number}</TableCell>
                              <TableCell className="text-sm">{formatDate(o.created_at)}</TableCell>
                              <TableCell className="text-right">{formatRupiah(Number(o.total_amount))}</TableCell>
                              <TableCell><Badge variant="secondary" className="capitalize">{o.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                          {customerOrders.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Belum ada order</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Invoice History</h3>
                    <div className="rounded-lg border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Order</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerInvoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                              <TableCell className="text-sm">{inv.orders?.order_number ?? '-'}</TableCell>
                              <TableCell className="text-right">{formatRupiah(Number(inv.total_amount))}</TableCell>
                              <TableCell className="text-right">{formatRupiah(Number(inv.outstanding_amount))}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  inv.status === 'paid' ? 'default' :
                                  inv.status === 'overdue' ? 'destructive' : 'secondary'
                                } className="capitalize">
                                  {inv.status.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {customerInvoices.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada invoice</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
