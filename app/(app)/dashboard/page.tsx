"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah, formatNumber } from "@/lib/format";
import type { Order, Product } from "@/lib/types";
import { ShoppingCart, DollarSign, AlertTriangle, TrendingUp, ArrowUpRight } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type DashboardData = {
  todayOrders: number;
  todaySales: number;
  outstanding: number;
  lowStockProducts: Product[];
  recentOrders: (Order & { customers?: { store_name: string } | null })[];
  salesChart: { date: string; label: string; total: number }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
    ).toISOString();

    const [todayOrdersRes, salesRes, outstandingRes, allProductsRes, recentOrdersRes] =
      await Promise.all([
        // Today's orders (exclude cancelled)
        supabase
          .from("orders")
          .select("total_amount", { count: "exact" })
          .gte("created_at", startOfToday)
          .neq("status", "cancelled"),
        // Today's sales (hanya confirmed)
        supabase
          .from("orders")
          .select("total_amount")
          .eq("status", "confirmed")
          .gte("created_at", startOfToday),
        // Outstanding invoices
        supabase.from("invoices").select("outstanding_amount"),
        // Semua produk aktif — filter di frontend
        supabase
          .from("products")
          .select("*, categories(name)")
          .eq("active", true)
          .order("stock", { ascending: true }),
        // Recent orders
        supabase
          .from("orders")
          .select("*, customers(store_name)")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    const todayOrders = todayOrdersRes.count ?? 0;
    const todaySales = (salesRes.data ?? []).reduce((s, o) => s + Number(o.total_amount), 0);
    const outstanding = (outstandingRes.data ?? []).reduce(
      (s, i) => s + Number(i.outstanding_amount),
      0,
    );

    // FILTER LOW STOCK DI FRONTEND
    const lowStockProducts = ((allProductsRes.data ?? []) as Product[]).filter(
      (p) => Number(p.stock) < Number(p.minimum_stock),
    );

    // Build 7-day sales chart
    const chartDataRes = await supabase
      .from("orders")
      .select("total_amount, created_at")
      .eq("status", "confirmed")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true });

    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, 0);
    }
    (chartDataRes.data ?? []).forEach((o) => {
      const key = (o.created_at as string).slice(0, 10);
      if (dayMap.has(key)) {
        dayMap.set(key, dayMap.get(key)! + Number(o.total_amount));
      }
    });
    const salesChart = Array.from(dayMap.entries()).map(([date, total]) => {
      const d = new Date(date + "T00:00:00");
      return {
        date,
        label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        total,
      };
    });

    setData({
      todayOrders,
      todaySales,
      outstanding,
      lowStockProducts,
      recentOrders: (recentOrdersRes.data ?? []) as DashboardData["recentOrders"],
      salesChart,
    });
    setLoading(false);
  }

  if (loading || !data) {
    return <div className="text-muted-foreground">Memuat dashboard...</div>;
  }

  const cards = [
    {
      title: "Today's Orders",
      value: formatNumber(data.todayOrders),
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Today's Sales",
      value: formatRupiah(data.todaySales),
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Outstanding Receivables",
      value: formatRupiah(data.outstanding),
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Low Stock Products",
      value: formatNumber(data.lowStockProducts.length),
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan aktivitas distribusi Anda</p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          // Low Stock Products card → scroll ke section low stock
          if (card.title === "Low Stock Products") {
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => {
                  const el = document.getElementById("low-stock-section");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="w-full text-left"
              >
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                      <p className="mt-1.5 text-2xl font-bold tracking-tight">{card.value}</p>
                    </div>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg}`}
                    >
                      <Icon className={`h-6 w-6 ${card.color}`} />
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          }

          // Kartu lain → tampilan normal
          return (
            <Card key={card.title}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight">{card.value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Penjualan 7 Hari Terakhir</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.salesChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f172a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  v >= 1000000
                    ? `${(v / 1000000).toFixed(1)}M`
                    : v >= 1000
                      ? `${Math.round(v / 1000)}K`
                      : `${v}`
                }
              />
              <Tooltip
                formatter={(v: number) => [formatRupiah(v), "Penjualan"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#0f172a"
                strokeWidth={2}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Orders + Low Stock */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-600">
                Lihat semua <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada pesanan</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.customers?.store_name ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(Number(order.total_amount))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card id="low-stock-section" style={{ scrollMarginTop: "80px" }}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Low Stock</CardTitle>
            <Link href="/inventory">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-600">
                Lihat semua <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data.lowStockProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Stok aman</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Minimum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStockProducts.slice(0, 8).map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={() => router.push(`/inventory?search=${encodeURIComponent(p.name)}`)}
                    >
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            Number(p.stock) < Number(p.minimum_stock)
                              ? "font-semibold text-red-600"
                              : ""
                          }
                        >
                          {formatNumber(Number(p.stock))} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(Number(p.minimum_stock))} {p.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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
