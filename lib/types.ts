export type Category = {
  id: string;
  name: string;
  emoji: string | null;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  store_name: string;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  created_at: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
  minimum_stock: number;
  active: boolean;
  created_at: string;
  categories?: Category | null;
};

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';
export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';

export type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: number;
  payment_status: PaymentStatus;
  created_at: string;
  customers?: Customer | null;
  order_items?: OrderItem[] | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products?: Product | null;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: InvoiceStatus;
  customers?: Customer | null;
  orders?: Order | null;
};

export type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'other';
  notes: string | null;
  created_at: string;
};

export type InventoryTransaction = {
  id: string;
  product_id: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  products?: Product | null;
};
