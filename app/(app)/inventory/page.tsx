"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatNumber, formatDateTime } from "@/lib/format";
import type { Product, InventoryTransaction } from "@/lib/types";
import { AlertTriangle, Search, X, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function InventoryContent() {
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*, categories(name)")
      .order("name", { ascending: true });
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, []);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    const { data } = await supabase
      .from("inventory_transactions")
      .select("*, products(name, sku, unit)")
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions((data ?? []) as InventoryTransaction[]);
    setTxLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
    loadTransactions();
  }, [loadProducts, loadTransactions]);

  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) setSearch(urlSearch);
  }, [searchParams]);

  const lowStock = useMemo(
    () => products.filter((p) => Number(p.stock) <= Number(p.minimum_stock)),
    [products],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categories?.name) set.add(p.categories.name);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = (p.sku ?? "").toLowerCase().includes(q);
        if (!nameMatch && !skuMatch) return false;
      }
      if (categoryFilter !== "all") {
        if ((p.categories?.name ?? "") !== categoryFilter) return false;
      }
      if (stockFilter !== "all") {
        const isLow = Number(p.stock) <= Number(p.minimum_stock);
        if (stockFilter === "low" && !isLow) return false;
        if (stockFilter === "in" && isLow) return false;
      }
      return true;
    });
  }, [products, search, categoryFilter, stockFilter]);

  const hasActiveFilter =
    search.trim() !== "" || categoryFilter !== "all" || stockFilter !== "all";

  function resetFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStockFilter("all");
  }

  function openAdjust(p: Product) {
    setAdjustProduct(p);
    setAdjustQty("");
    setAdjustNote("");
    setAdjustError(null);
    setAdjustOpen(true);
  }

  async function handleAdjustStock() {
    if (!adjustProduct) return;
    setAdjustError(null);

    const qty = Number(adjustQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setAdjustError("Jumlah harus lebih dari 0");
      return;
    }

    setSaving(true);
    const currentStock = Number(adjustProduct.stock);
    const newStock = currentStock + qty;

    // Update stock
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", adjustProduct.id);

    if (updateError) {
      setAdjustError(updateError.message);
      setSaving(false);
      return;
    }

    // Catat transaksi
    const { error: txError } = await supabase
      .from("inventory_transactions")
      .insert({
        product_id: adjustProduct.id,
        type: "IN",
        quantity: qty,
        reference_type: adjustNote.trim() ? "manual" : null,
        reference_id: adjustNote.trim() || null,
      });

    if (txError) {
      setAdjustError(txError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setAdjustOpen(false);
    loadProducts();
    loadTransactions();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Pantau stok dan riwayat transaksi inventory
        </p>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">
              {lowStock.length} produk stok menipis
            </p>
            <p className="text-sm text-amber-700">
              {lowStock.map((p) => p.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stok Produk</TabsTrigger>
          <TabsTrigger value="transactions">Riwayat Transaksi</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          {/* FILTER BAR */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama produk atau SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full lg:w-[200px]">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="Status Stok" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="in">In Stock</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="gap-1"
                  >
                    <X className="h-4 w-4" /> Reset
                  </Button>
                )}
              </div>

              {hasActiveFilter && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Menampilkan{" "}
                  <span className="font-semibold text-foreground">
                    {filteredProducts.length}
                  </span>{" "}
                  dari {products.length} produk
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Memuat...
                </p>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Search className="h-10 w-10 opacity-40" />
                  <p>Tidak ada produk yang cocok</p>
                  {hasActiveFilter && (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      Reset filter
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produk</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Stok</TableHead>
                        <TableHead className="text-right">Min Stok</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((p) => {
                        const isLow =
                          Number(p.stock) <= Number(p.minimum_stock);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              {p.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {p.sku}
                            </TableCell>
                            <TableCell>{p.categories?.name ?? "-"}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  isLow ? "font-semibold text-red-600" : ""
                                }
                              >
                                {formatNumber(Number(p.stock))} {p.unit}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatNumber(Number(p.minimum_stock))} {p.unit}
                            </TableCell>
                            <TableCell>
                              {isLow ? (
                                <Badge variant="destructive">Low Stock</Badge>
                              ) : (
                                <Badge variant="secondary">In Stock</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAdjust(p)}
                                  title="Stok Masuk"
                                  className="h-8 gap-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                >
                                  <Plus className="h-4 w-4" />
                                  Masuk
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="p-0">
              {txLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Memuat...
                </p>
              ) : transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada transaksi
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Produk</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Referensi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(tx.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {tx.products?.name ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                tx.type === "OUT"
                                  ? "destructive"
                                  : tx.type === "IN"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(tx.quantity))}{" "}
                            {tx.products?.unit}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tx.reference_type
                              ? `${tx.reference_type}: ${tx.reference_id ?? ""}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG STOK MASUK */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stok Masuk — {adjustProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              Stok saat ini:{" "}
              <span className="font-semibold">
                {formatNumber(Number(adjustProduct?.stock ?? 0))}{" "}
                {adjustProduct?.unit}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label>Jumlah Masuk</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Misal: Restock dari supplier"
              />
            </div>

            {adjustError && (
              <p className="text-sm text-destructive">{adjustError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdjustOpen(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button onClick={handleAdjustStock} disabled={saving || !adjustQty}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-muted-foreground">Memuat...</div>}
    >
      <InventoryContent />
    </Suspense>
  );
}