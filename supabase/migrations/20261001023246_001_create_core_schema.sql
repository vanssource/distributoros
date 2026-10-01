/*
# DistributorOS — Core Schema

1. Purpose
   Backs a grocery/sembako distributor management app. Customers order via a Telegram bot; an admin logs into a web dashboard to manage products, orders, stock, invoices, and payments.

2. New Tables
   - `categories` — product categories (Makanan, Minuman, Sembako, Minyak)
   - `customers` — store owners identified by Telegram chat id
   - `products` — sellable items with SKU, price, stock, minimum stock
   - `orders` — header: order number, customer, status, total
   - `order_items` — line items per order
   - `invoices` — generated when an order is confirmed
   - `payments` — payments recorded against invoices
   - `inventory_transactions` — every stock movement (IN/OUT)

3. Security (RLS)
   - The dashboard requires admin auth (Supabase email/password). Policies are scoped `TO authenticated`.
   - Customer interactions happen exclusively through the Telegram bot edge function, which uses the service-role key and bypasses RLS.
   - All tables get 4 CRUD policies (select/insert/update/delete) scoped to `authenticated`. There is no `user_id` ownership because there is a single admin tenant; any authenticated admin can manage all rows. This is acceptable because the only authenticated users are admin accounts created by the operator.

4. Important Notes
   - `order_number` and `invoice_number` use a sequence-based default for uniqueness.
   - Stock is never allowed to go negative: the confirm-order logic checks stock before decrementing.
   - Invoice `outstanding_amount` is a stored column kept in sync by the payment edge function / dashboard logic.
   - `due_date` defaults to 7 days after invoice date.
*/

-- Extensions
create extension if not exists "pgcrypto";

-- ============ categories ============
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  created_at timestamptz not null default now()
);
alter table categories enable row level security;
drop policy if exists "cat_select" on categories;
create policy "cat_select" on categories for select to authenticated using (true);
drop policy if exists "cat_insert" on categories;
create policy "cat_insert" on categories for insert to authenticated with check (true);
drop policy if exists "cat_update" on categories;
create policy "cat_update" on categories for update to authenticated using (true) with check (true);
drop policy if exists "cat_delete" on categories;
create policy "cat_delete" on categories for delete to authenticated using (true);

-- ============ customers ============
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store_name text not null,
  telegram_chat_id text unique,
  telegram_username text,
  phone text,
  address text,
  credit_limit numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table customers enable row level security;
drop policy if exists "cust_select" on customers;
create policy "cust_select" on customers for select to authenticated using (true);
drop policy if exists "cust_insert" on customers;
create policy "cust_insert" on customers for insert to authenticated with check (true);
drop policy if exists "cust_update" on customers;
create policy "cust_update" on customers for update to authenticated using (true) with check (true);
drop policy if exists "cust_delete" on customers;
create policy "cust_delete" on customers for delete to authenticated using (true);

-- ============ products ============
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  unit text not null default 'dus',
  purchase_price numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  stock numeric(14,2) not null default 0,
  minimum_stock numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table products enable row level security;
drop policy if exists "prod_select" on products;
create policy "prod_select" on products for select to authenticated using (true);
drop policy if exists "prod_insert" on products;
create policy "prod_insert" on products for insert to authenticated with check (true);
drop policy if exists "prod_update" on products;
create policy "prod_update" on products for update to authenticated using (true) with check (true);
drop policy if exists "prod_delete" on products;
create policy "prod_delete" on products for delete to authenticated using (true);
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_active on products(active);

-- ============ orders ============
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references customers(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  total_amount numeric(14,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partially_paid','paid')),
  created_at timestamptz not null default now()
);
alter table orders enable row level security;
drop policy if exists "ord_select" on orders;
create policy "ord_select" on orders for select to authenticated using (true);
drop policy if exists "ord_insert" on orders;
create policy "ord_insert" on orders for insert to authenticated with check (true);
drop policy if exists "ord_update" on orders;
create policy "ord_update" on orders for update to authenticated using (true) with check (true);
drop policy if exists "ord_delete" on orders;
create policy "ord_delete" on orders for delete to authenticated using (true);
create index if not exists idx_orders_customer on orders(customer_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created on orders(created_at desc);

-- ============ order_items ============
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric(14,2) not null default 0,
  unit_price numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0
);
alter table order_items enable row level security;
drop policy if exists "oi_select" on order_items;
create policy "oi_select" on order_items for select to authenticated using (true);
drop policy if exists "oi_insert" on order_items;
create policy "oi_insert" on order_items for insert to authenticated with check (true);
drop policy if exists "oi_update" on order_items;
create policy "oi_update" on order_items for update to authenticated using (true) with check (true);
drop policy if exists "oi_delete" on order_items;
create policy "oi_delete" on order_items for delete to authenticated using (true);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_product on order_items(product_id);

-- ============ invoices ============
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null references orders(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date not null default (current_date + interval '7 days'),
  total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  outstanding_amount numeric(14,2) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','partially_paid','paid','overdue'))
);
alter table invoices enable row level security;
drop policy if exists "inv_select" on invoices;
create policy "inv_select" on invoices for select to authenticated using (true);
drop policy if exists "inv_insert" on invoices;
create policy "inv_insert" on invoices for insert to authenticated with check (true);
drop policy if exists "inv_update" on invoices;
create policy "inv_update" on invoices for update to authenticated using (true) with check (true);
drop policy if exists "inv_delete" on invoices;
create policy "inv_delete" on invoices for delete to authenticated using (true);
create index if not exists idx_invoices_customer on invoices(customer_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_order on invoices(order_id);

-- ============ payments ============
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete restrict,
  amount numeric(14,2) not null default 0,
  payment_date date not null default current_date,
  payment_method text not null default 'cash' check (payment_method in ('cash','bank_transfer','other')),
  notes text,
  created_at timestamptz not null default now()
);
alter table payments enable row level security;
drop policy if exists "pay_select" on payments;
create policy "pay_select" on payments for select to authenticated using (true);
drop policy if exists "pay_insert" on payments;
create policy "pay_insert" on payments for insert to authenticated with check (true);
drop policy if exists "pay_update" on payments;
create policy "pay_update" on payments for update to authenticated using (true) with check (true);
drop policy if exists "pay_delete" on payments;
create policy "pay_delete" on payments for delete to authenticated using (true);
create index if not exists idx_payments_invoice on payments(invoice_id);

-- ============ inventory_transactions ============
create table if not exists inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  type text not null check (type in ('IN','OUT','ADJUST')),
  quantity numeric(14,2) not null default 0,
  reference_type text,
  reference_id text,
  created_at timestamptz not null default now()
);
alter table inventory_transactions enable row level security;
drop policy if exists "it_select" on inventory_transactions;
create policy "it_select" on inventory_transactions for select to authenticated using (true);
drop policy if exists "it_insert" on inventory_transactions;
create policy "it_insert" on inventory_transactions for insert to authenticated with check (true);
drop policy if exists "it_update" on inventory_transactions;
create policy "it_update" on inventory_transactions for update to authenticated using (true) with check (true);
drop policy if exists "it_delete" on inventory_transactions;
create policy "it_delete" on inventory_transactions for delete to authenticated using (true);
create index if not exists idx_invtx_product on inventory_transactions(product_id);
create index if not exists idx_invtx_created on inventory_transactions(created_at desc);

-- ============ Sequences for order_number & invoice_number ============
do $$
begin
  if not exists (select 1 from pg_sequences where sequencename = 'order_number_seq') then
    create sequence order_number_seq start 1;
  end if;
  if not exists (select 1 from pg_sequences where sequencename = 'invoice_number_seq') then
    create sequence invoice_number_seq start 1;
  end if;
end $$;

-- Helper functions to generate readable numbers
create or replace function generate_order_number()
returns text language sql as $$
  select 'ORD-' || lpad(nextval('order_number_seq')::text, 6, '0');
$$;

create or replace function generate_invoice_number()
returns text language sql as $$
  select 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
$$;
