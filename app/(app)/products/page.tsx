'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRupiah, formatNumber } from '@/lib/format';
import type { Product, Category } from '@/lib/types';
import { Plus, Search, Pencil, Power, Package } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category_id: '',
    unit: 'dus',
    purchase_price: '',
    selling_price: '',
    stock: '',
    minimum_stock: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data ?? []);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('products').select('*, categories(*)').order('created_at', { ascending: false });
    if (categoryFilter !== 'all') query = query.eq('category_id', categoryFilter);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    const { data } = await query;
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, [categoryFilter, search]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function openAdd() {
    setEditing(null);
    setForm({
      sku: '',
      name: '',
      category_id: categories[0]?.id ?? '',
      unit: 'dus',
      purchase_price: '',
      selling_price: '',
      stock: '',
      minimum_stock: '',
      active: true,
    });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      sku: p.sku,
      name: p.name,
      category_id: p.category_id ?? '',
      unit: p.unit,
      purchase_price: String(p.purchase_price),
      selling_price: String(p.selling_price),
      stock: String(p.stock),
      minimum_stock: String(p.minimum_stock),
      active: p.active,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setError(null);
    if (!form.sku.trim() || !form.name.trim()) {
      setError('SKU dan nama produk wajib diisi');
      return;
    }
    setSaving(true);
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category_id: form.category_id || null,
      unit: form.unit || 'dus',
      purchase_price: Number(form.purchase_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      stock: Number(form.stock) || 0,
      minimum_stock: Number(form.minimum_stock) || 0,
      active: form.active,
    };
    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setDialogOpen(false);
    loadProducts();
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id);
    loadProducts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Kelola produk distribusi Anda</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Produk
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari produk atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat...</p>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Package className="h-10 w-10 opacity-40" />
              <p>Belum ada produk</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {p.categories ? `${p.categories.emoji ?? ''} ${p.categories.name}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">{formatRupiah(Number(p.selling_price))}</TableCell>
                      <TableCell className="text-right">
                        <span className={Number(p.stock) <= Number(p.minimum_stock) ? 'font-semibold text-red-600' : ''}>
                          {formatNumber(Number(p.stock))} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(Number(p.minimum_stock))} {p.unit}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.active ? 'default' : 'secondary'}>
                          {p.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleActive(p)} title={p.active ? 'Deactivate' : 'Activate'}>
                            <Power className={`h-4 w-4 ${p.active ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="IND001" />
              </div>
              <div className="space-y-1.5">
                <Label>Nama Produk</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Indomie Goreng" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Satuan</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="dus" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Harga Beli</Label>
                <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Harga Jual</Label>
                <Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Stok Awal</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" disabled={!!editing} />
                {editing && <p className="text-xs text-muted-foreground">Stok dikelola via inventory</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Minimum Stok</Label>
                <Input type="number" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} placeholder="0" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
