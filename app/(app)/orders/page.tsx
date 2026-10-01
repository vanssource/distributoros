"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatRupiah, formatNumber, formatDateTime } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { Search, Eye, ShoppingCart, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("orders")
      .select("*, customers(store_name)")
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search.trim()) query = query.or(`order_number.ilike.%${search}%`);
    const { data } = await query;
    setOrders((data ?? []) as Order[]);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // =====================================================
  // REALTIME - NOTIFIKASI ORDER BARU
  // =====================================================
  useEffect(() => {
    // Minta izin notifikasi browser (sekali saja)
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const newOrder = payload.new as any;

          // Ambil nama customer
          let storeName = "Unknown";
          try {
            const { data: customer } = await supabase
              .from("customers")
              .select("store_name")
              .eq("id", newOrder.customer_id)
              .single();
            storeName = customer?.store_name ?? "Unknown";
          } catch (err) {
            console.error("Gagal ambil customer:", err);
          }

          // 1. Toast notification
          toast.success(`🔔 Order Baru dari ${storeName}`, {
            description: `${newOrder.order_number} - ${formatRupiah(
              Number(newOrder.total_amount),
            )}`,
            duration: 8000,
          });

          // 2. Browser notification
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("🔔 Order Baru!", {
                body: `${storeName} - ${formatRupiah(Number(newOrder.total_amount))}`,
                icon: "/favicon.ico",
              });
            } catch (err) {
              console.error("Notif browser error:", err);
            }
          }

          // 3. Sound
          try {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              await audioRef.current.play();
            }
          } catch (err) {
            // Autoplay mungkin diblokir sampai user interaksi
            console.warn("Sound autoplay diblokir:", err);
          }

          // 4. Reload list supaya order baru muncul
          loadOrders();
        },
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);
      });

    // Cleanup saat komponen unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function openDetail(order: Order) {
    setConfirmError(null);
    const { data: items } = await supabase
      .from("order_items")
      .select("*, products(name, sku, unit, stock)")
      .eq("order_id", order.id);
    setDetailItems((items ?? []) as OrderItem[]);
    setDetailOrder(order);
  }

  async function confirmOrder() {
    if (!detailOrder) return;
    setConfirming(true);
    setConfirmError(null);

    // Check stock for all items
    for (const item of detailItems) {
      const stock = Number(item.products?.stock ?? 0);
      if (stock < Number(item.quantity)) {
        setConfirmError(
          `Stok ${item.products?.name} tidak mencukupi. Tersedia: ${formatNumber(stock)} ${item.products?.unit}, diminta: ${formatNumber(Number(item.quantity))} ${item.products?.unit}`,
        );
        setConfirming(false);
        return;
      }
    }

    // Decrement stock and create inventory transactions
    for (const item of detailItems) {
      const newStock = Number(item.products?.stock) - Number(item.quantity);
      await supabase.from("products").update({ stock: newStock }).eq("id", item.product_id);
      await supabase.from("inventory_transactions").insert({
        product_id: item.product_id,
        type: "OUT",
        quantity: Number(item.quantity),
        reference_type: "order",
        reference_id: detailOrder.order_number,
      });
    }

    // Update order status
    await supabase.from("orders").update({ status: "confirmed" }).eq("id", detailOrder.id);

    // Generate invoice
    const invRes = await supabase.rpc("generate_invoice_number");
    const invoiceNumber = invRes.data as string;
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 7);

    await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      order_id: detailOrder.id,
      customer_id: detailOrder.customer_id,
      invoice_date: today.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      total_amount: Number(detailOrder.total_amount),
      paid_amount: 0,
      outstanding_amount: Number(detailOrder.total_amount),
      status: "unpaid",
    });

    toast.success(
      `Order ${detailOrder.order_number} dikonfirmasi. Invoice ${invoiceNumber} dibuat.`,
    );
    setConfirming(false);
    setDetailOrder(null);
    loadOrders();
  }

  async function cancelOrder() {
    if (!detailOrder) return;
    setConfirming(true);
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", detailOrder.id);
    toast(`Order ${detailOrder.order_number} dibatalkan.`);
    setConfirming(false);
    setDetailOrder(null);
    loadOrders();
  }

  return (
    <div className="space-y-6">
      {/* Audio element untuk notifikasi sound */}
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">Kelola pesanan dari customer</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari order number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className="capitalize"
                >
                  {s === "all" ? "Semua" : s}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat...</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 opacity-40" />
              <p>Belum ada pesanan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(order.created_at)}
                      </TableCell>
                      <TableCell>{order.customers?.store_name ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(Number(order.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {order.payment_status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(order)}>
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

      <Dialog open={!!detailOrder} onOpenChange={(v) => !v && setDetailOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order {detailOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{detailOrder.customers?.store_name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal</p>
                  <p className="font-medium">{formatDateTime(detailOrder.created_at)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.products?.name ?? "-"}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({item.products?.sku})
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(item.quantity))} {item.products?.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(Number(item.unit_price))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatRupiah(Number(item.subtotal))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold">
                  {formatRupiah(Number(detailOrder.total_amount))}
                </span>
              </div>

              {confirmError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {confirmError}
                </div>
              )}

              {detailOrder.status === "pending" && (
                <DialogFooter>
                  <Button variant="outline" onClick={cancelOrder} disabled={confirming}>
                    Cancel Order
                  </Button>
                  <Button onClick={confirmOrder} disabled={confirming}>
                    {confirming ? "Memproses..." : "Confirm Order"}
                  </Button>
                </DialogFooter>
              )}
              {detailOrder.status === "confirmed" && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                  Order telah dikonfirmasi. Stok telah dikurangi. Invoice telah dibuat.
                </div>
              )}
              {detailOrder.status === "cancelled" && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  Order telah dibatalkan.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    pending: { label: "Pending", variant: "secondary" },
    confirmed: { label: "Confirmed", variant: "default" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
