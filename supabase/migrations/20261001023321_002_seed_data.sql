/*
# DistributorOS — Seed Data

Populates categories, products, customers, and demo orders/invoices/payments so the dashboard is not empty on first load.

1. Seed categories (Makanan, Minuman, Sembako, Minyak)
2. Seed products (8 items per spec)
3. Seed customers (4 stores)
4. Seed a few demo orders + invoices + payments + inventory transactions
*/

-- Categories
insert into categories (name, emoji) values
  ('Makanan', '🍜'),
  ('Minuman', '🥤'),
  ('Sembako', '🍚'),
  ('Minyak', '🧴')
on conflict do nothing;

-- Products
insert into products (sku, name, category_id, unit, purchase_price, selling_price, stock, minimum_stock, active)
select 'IND001', 'Indomie Goreng', c.id, 'dus', 95000, 105000, 120, 30, true from categories c where c.name = 'Makanan'
on conflict (sku) do nothing;
insert into products (sku, name, category_id, unit, purchase_price, selling_price, stock, minimum_stock, active)
select 'IND002', 'Indomie Soto', c.id, 'dus', 95000, 105000, 80, 30, true from categories c where c.name = 'Makanan'
on conflict (sku) do nothing;
insert into products (sku, name, category_id, unit, purchase_price, selling_price, stock, minimum_stock, active)
select 'AQA001', 'Aqua 600ml', c.id, 'dus', 40000, 45000, 150, 40, true from categories c where c.name = 'Minuman'
on conflict (sku) do nothing;
insert into products (sku, name, category_id, unit, purchase_price, selling_price, stock, minimum_stock, active)
select 'AQA002', 'Aqua 1500ml', c.id, 'dus', 45000, 50000, 100, 40, true from categories c where c.name = 'Minuman'
on conflict (sku) do nothing;
insert into products (sku, name, category_id, unit, purchase_price, selling_price, stock, minimum_stock, active)
select 'BIM001', 'Bimoli 2L', c.id, 'dus', 165000, 180000, 25, 30, true from categories c where c.name = 'Minyak'
on conflict (sku) do nothing;
insert into products (sku, name, category_id, unit, purchase_price, selling_price, stock, minimum_stock, active)
select 'GUL001', 'Gula Pasir 1kg', c.id, 'kg', 14000, 16000, 200, 50, true from categories c where c.name = 'Sembako'
on conflict (sku) do nothing;
insert into products (sku, name, category_id, unit, purchase_price, selling_price, stock, minimum_stock, active)
select 'BER001', 'Beras 5kg', c.id, 'karung', 68000, 75000, 50, 20, true from categories c where c.name = 'Sembako'
on conflict (sku) do nothing;
insert into products (sku, name, category_id, unit, purchase_price, selling_price, stock, minimum_stock, active)
select 'TEP001', 'Tepung Terigu 1kg', c.id, 'kg', 11000, 13000, 100, 40, true from categories c where c.name = 'Sembako'
on conflict (sku) do nothing;

-- Customers
insert into customers (name, store_name, telegram_chat_id, telegram_username, phone, address, credit_limit) values
  ('Budi Santoso', 'Toko Makmur', '10001', 'budisantoso', '081234567890', 'Jl. Merdeka No. 10', 5000000),
  ('Andi Wijaya', 'Toko ABC', '10002', 'andiwijaya', '081234567891', 'Jl. Sudirman No. 5', 3000000),
  ('Citra Lestari', 'Warung Jaya', '10003', 'citralestari', '081234567892', 'Jl. Diponegoro No. 22', 2000000),
  ('Dewi Anggraini', 'Toko Sejahtera', '10004', 'dewianggraini', '081234567893', 'Jl. Gatot Subroto No. 8', 4000000)
on conflict (telegram_chat_id) do nothing;

-- Demo orders: create a few confirmed orders with items, invoices, payments, inventory transactions
-- Order 1 — Toko Makmur (confirmed, partially paid)
do $$
declare
  cust_id uuid;
  prod_indomie uuid;
  prod_aqua uuid;
  prod_bimoli uuid;
  ord_id uuid;
  ord_no text;
  inv_id uuid;
  inv_no text;
  total numeric;
begin
  select id into cust_id from customers where store_name = 'Toko Makmur';
  select id into prod_indomie from products where sku = 'IND001';
  select id into prod_aqua from products where sku = 'AQA001';
  select id into prod_bimoli from products where sku = 'BIM001';

  ord_no := generate_order_number();
  total := 105000*10 + 45000*5 + 180000*3; -- 1,815,000
  insert into orders (order_number, customer_id, status, total_amount, payment_status, created_at)
  values (ord_no, cust_id, 'confirmed', total, 'partially_paid', now() - interval '2 days')
  returning id into ord_id;

  insert into order_items (order_id, product_id, quantity, unit_price, subtotal) values
    (ord_id, prod_indomie, 10, 105000, 1050000),
    (ord_id, prod_aqua, 5, 45000, 225000),
    (ord_id, prod_bimoli, 3, 180000, 540000);

  -- Decrement stock
  update products set stock = stock - 10 where id = prod_indomie;
  update products set stock = stock - 5 where id = prod_aqua;
  update products set stock = stock - 3 where id = prod_bimoli;

  insert into inventory_transactions (product_id, type, quantity, reference_type, reference_id) values
    (prod_indomie, 'OUT', 10, 'order', ord_no),
    (prod_aqua, 'OUT', 5, 'order', ord_no),
    (prod_bimoli, 'OUT', 3, 'order', ord_no);

  inv_no := generate_invoice_number();
  insert into invoices (invoice_number, order_id, customer_id, invoice_date, due_date, total_amount, paid_amount, outstanding_amount, status)
  values (inv_no, ord_id, cust_id, current_date - 2, current_date + 5, total, 500000, total - 500000, 'partially_paid')
  returning id into inv_id;

  insert into payments (invoice_id, amount, payment_date, payment_method, notes)
  values (inv_id, 500000, current_date - 1, 'cash', 'Pembayaran sebagian');
end $$;

-- Order 2 — Toko ABC (confirmed, paid)
do $$
declare
  cust_id uuid;
  prod_gula uuid;
  prod_beras uuid;
  ord_id uuid;
  ord_no text;
  inv_id uuid;
  inv_no text;
  total numeric;
begin
  select id into cust_id from customers where store_name = 'Toko ABC';
  select id into prod_gula from products where sku = 'GUL001';
  select id into prod_beras from products where sku = 'BER001';

  ord_no := generate_order_number();
  total := 16000*20 + 75000*10; -- 1,070,000
  insert into orders (order_number, customer_id, status, total_amount, payment_status, created_at)
  values (ord_no, cust_id, 'confirmed', total, 'paid', now() - interval '5 days')
  returning id into ord_id;

  insert into order_items (order_id, product_id, quantity, unit_price, subtotal) values
    (ord_id, prod_gula, 20, 16000, 320000),
    (ord_id, prod_beras, 10, 75000, 750000);

  update products set stock = stock - 20 where id = prod_gula;
  update products set stock = stock - 10 where id = prod_beras;

  insert into inventory_transactions (product_id, type, quantity, reference_type, reference_id) values
    (prod_gula, 'OUT', 20, 'order', ord_no),
    (prod_beras, 'OUT', 10, 'order', ord_no);

  inv_no := generate_invoice_number();
  insert into invoices (invoice_number, order_id, customer_id, invoice_date, due_date, total_amount, paid_amount, outstanding_amount, status)
  values (inv_no, ord_id, cust_id, current_date - 5, current_date + 2, total, total, 0, 'paid')
  returning id into inv_id;

  insert into payments (invoice_id, amount, payment_date, payment_method, notes)
  values (inv_id, total, current_date - 4, 'bank_transfer', 'Lunas');
end $$;

-- Order 3 — Warung Jaya (pending, no stock deduction)
do $$
declare
  cust_id uuid;
  prod_indomie uuid;
  prod_aqua2 uuid;
  ord_id uuid;
  ord_no text;
  total numeric;
begin
  select id into cust_id from customers where store_name = 'Warung Jaya';
  select id into prod_indomie from products where sku = 'IND001';
  select id into prod_aqua2 from products where sku = 'AQA002';

  ord_no := generate_order_number();
  total := 105000*5 + 50000*8; -- 925,000
  insert into orders (order_number, customer_id, status, total_amount, payment_status, created_at)
  values (ord_no, cust_id, 'pending', total, 'unpaid', now() - interval '3 hours')
  returning id into ord_id;

  insert into order_items (order_id, product_id, quantity, unit_price, subtotal) values
    (ord_id, prod_indomie, 5, 105000, 525000),
    (ord_id, prod_aqua2, 8, 50000, 400000);
end $$;

-- Order 4 — Toko Sejahtera (confirmed, unpaid, overdue)
do $$
declare
  cust_id uuid;
  prod_tepung uuid;
  prod_indo2 uuid;
  ord_id uuid;
  ord_no text;
  inv_id uuid;
  inv_no text;
  total numeric;
begin
  select id into cust_id from customers where store_name = 'Toko Sejahtera';
  select id into prod_tepung from products where sku = 'TEP001';
  select id into prod_indo2 from products where sku = 'IND002';

  ord_no := generate_order_number();
  total := 13000*30 + 105000*4; -- 840,000
  insert into orders (order_number, customer_id, status, total_amount, payment_status, created_at)
  values (ord_no, cust_id, 'confirmed', total, 'unpaid', now() - interval '10 days')
  returning id into ord_id;

  insert into order_items (order_id, product_id, quantity, unit_price, subtotal) values
    (ord_id, prod_tepung, 30, 13000, 390000),
    (ord_id, prod_indo2, 4, 105000, 420000);

  update products set stock = stock - 30 where id = prod_tepung;
  update products set stock = stock - 4 where id = prod_indo2;

  insert into inventory_transactions (product_id, type, quantity, reference_type, reference_id) values
    (prod_tepung, 'OUT', 30, 'order', ord_no),
    (prod_indo2, 'OUT', 4, 'order', ord_no);

  inv_no := generate_invoice_number();
  insert into invoices (invoice_number, order_id, customer_id, invoice_date, due_date, total_amount, paid_amount, outstanding_amount, status)
  values (inv_no, ord_id, cust_id, current_date - 10, current_date - 3, total, 0, total, 'overdue')
  returning id into inv_id;
end $$;

-- Order 5 — Toko Makmur (today, confirmed, unpaid)
do $$
declare
  cust_id uuid;
  prod_aqua uuid;
  prod_gula uuid;
  ord_id uuid;
  ord_no text;
  inv_id uuid;
  inv_no text;
  total numeric;
begin
  select id into cust_id from customers where store_name = 'Toko Makmur';
  select id into prod_aqua from products where sku = 'AQA001';
  select id into prod_gula from products where sku = 'GUL001';

  ord_no := generate_order_number();
  total := 45000*10 + 16000*15; -- 690,000
  insert into orders (order_number, customer_id, status, total_amount, payment_status, created_at)
  values (ord_no, cust_id, 'confirmed', total, 'unpaid', now())
  returning id into ord_id;

  insert into order_items (order_id, product_id, quantity, unit_price, subtotal) values
    (ord_id, prod_aqua, 10, 45000, 450000),
    (ord_id, prod_gula, 15, 16000, 240000);

  update products set stock = stock - 10 where id = prod_aqua;
  update products set stock = stock - 15 where id = prod_gula;

  insert into inventory_transactions (product_id, type, quantity, reference_type, reference_id) values
    (prod_aqua, 'OUT', 10, 'order', ord_no),
    (prod_gula, 'OUT', 15, 'order', ord_no);

  inv_no := generate_invoice_number();
  insert into invoices (invoice_number, order_id, customer_id, invoice_date, due_date, total_amount, paid_amount, outstanding_amount, status)
  values (inv_no, ord_id, cust_id, current_date, current_date + 7, total, 0, total, 'unpaid')
  returning id into inv_id;
end $$;
