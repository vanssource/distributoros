import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const adminChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BASE_URL = `https://api.telegram.org/bot${botToken}`;

type TGMessage = {
  message_id: number;
  chat: { id: number; first_name?: string; username?: string };
  text?: string;
};

type TGUpdate = {
  update_id: number;
  message?: TGMessage;
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: TGMessage;
    data?: string;
  };
};

type Session = {
  chat_id: number;
  step: string;
  category_id?: string;
  product_id?: string;
  cart?: { product_id: string; name: string; price: number; unit: string; qty: number }[];
};

// In-memory session per instance (note: edge functions may reset, but this covers single-instance usage)
const sessions = new Map<number, Session>();

async function sendMessage(chatId: number, text: string, keyboard?: object) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function answerCallback(callbackId: string) {
  await fetch(`${BASE_URL}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId }),
  });
}

function inlineKeyboard(buttons: { text: string; callback_data: string }[][]) {
  return { inline_keyboard: buttons };
}

function formatRupiah(n: number): string {
  return 'Rp' + n.toLocaleString('id-ID');
}

// ====== Customer management ======

async function findCustomer(chatId: number) {
  const { data } = await supabase.from('customers').select('*').eq('telegram_chat_id', String(chatId)).maybeSingle();
  return data;
}

async function createCustomer(chatId: number, username: string, storeName: string) {
  const { data } = await supabase
    .from('customers')
    .insert({
      store_name: storeName,
      name: username || `Customer ${chatId}`,
      telegram_chat_id: String(chatId),
      telegram_username: username || null,
      credit_limit: 0,
    })
    .select()
    .single();
  return data;
}

// ====== Flow handlers ======

async function handleStart(chatId: number, username: string) {
  const customer = await findCustomer(chatId);
  if (!customer) {
    sessions.set(chatId, { chat_id: chatId, step: 'awaiting_store_name' });
    await sendMessage(
      chatId,
      'Selamat datang di DistributorOS \u{1F44B}\n\nSepertinya ini pertama kali Anda menggunakan bot ini.\nSilakan masukkan nama toko Anda:'
    );
    return;
  }

  sessions.set(chatId, { chat_id: chatId, step: 'idle', cart: [] });
  await sendMessage(chatId, 'Selamat datang di DistributorOS \u{1F44B}\n\nSilakan pilih menu:', inlineKeyboard([
    [{ text: '\u{1F6D2} Pesan Barang', callback_data: 'order' }],
    [{ text: '\u{1F4E6} Pesanan Saya', callback_data: 'my_orders' }],
    [{ text: '\u{1F4B0} Piutang Saya', callback_data: 'my_debt' }],
  ]));
}

async function handleOrderStart(chatId: number) {
  const { data: categories } = await supabase.from('categories').select('*').order('name');
  if (!categories || categories.length === 0) {
    await sendMessage(chatId, 'Maaf, belum ada kategori produk tersedia.');
    return;
  }
  const session = sessions.get(chatId) ?? { chat_id: chatId, step: 'idle', cart: [] };
  session.step = 'browsing_category';
  sessions.set(chatId, session);

  const buttons = categories.map((c) => [{ text: `${c.emoji ?? ''} ${c.name}`, callback_data: `cat_${c.id}` }]);
  await sendMessage(chatId, 'Mau pesan kategori apa?', inlineKeyboard(buttons));
}

async function handleCategorySelect(chatId: number, categoryId: string) {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .eq('active', true)
    .gt('stock', 0)
    .order('name');

  if (!products || products.length === 0) {
    await sendMessage(chatId, 'Maaf, tidak ada produk tersedia untuk kategori ini.');
    return;
  }

  const session = sessions.get(chatId)!;
  session.step = 'browsing_product';
  sessions.set(chatId, session);

  const buttons = products.map((p) => [
    {
      text: `${p.name} - ${formatRupiah(Number(p.selling_price))} / ${p.unit} (Stok: ${Number(p.stock)} ${p.unit})`,
      callback_data: `prod_${p.id}`,
    },
  ]);
  buttons.push([{ text: '\u{2B05} Kembali', callback_data: 'order' }]);
  await sendMessage(chatId, 'Pilih produk:', inlineKeyboard(buttons));
}

async function handleProductSelect(chatId: number, productId: string) {
  const { data: product } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
  if (!product) {
    await sendMessage(chatId, 'Produk tidak ditemukan.');
    return;
  }

  const session = sessions.get(chatId)!;
  session.step = 'awaiting_quantity';
  session.product_id = productId;
  sessions.set(chatId, session);

  await sendMessage(
    chatId,
    `<b>${product.name}</b>\nHarga: ${formatRupiah(Number(product.selling_price))} / ${product.unit}\nStok: ${Number(product.stock)} ${product.unit}\n\nBerapa ${product.unit}?`
  );
}

async function handleQuantityInput(chatId: number, text: string) {
  const session = sessions.get(chatId)!;
  const qty = Number(text);
  if (!qty || qty <= 0) {
    await sendMessage(chatId, 'Mohon masukkan jumlah yang valid (angka).');
    return;
  }

  const { data: product } = await supabase.from('products').select('*').eq('id', session.product_id!).maybeSingle();
  if (!product) {
    await sendMessage(chatId, 'Produk tidak ditemukan.');
    return;
  }

  if (qty > Number(product.stock)) {
    await sendMessage(chatId, `Maaf, stok tidak mencukupi. Stok tersedia: ${Number(product.stock)} ${product.unit}.`);
    return;
  }

  if (!session.cart) session.cart = [];
  session.cart.push({
    product_id: product.id,
    name: product.name,
    price: Number(product.selling_price),
    unit: product.unit,
    qty,
  });
  session.step = 'idle';
  sessions.set(chatId, session);

  await sendMessage(
    chatId,
    `\u2705 ${product.name} \u00D7 ${qty} ${product.unit} berhasil ditambahkan.`,
    inlineKeyboard([
      [{ text: '\u{1F6D2} Lihat Keranjang', callback_data: 'cart' }],
      [{ text: '\u2795 Tambah Barang', callback_data: 'order' }],
    ])
  );
}

async function handleCart(chatId: number) {
  const session = sessions.get(chatId)!;
  if (!session.cart || session.cart.length === 0) {
    await sendMessage(chatId, 'Keranjang Anda kosong.');
    return;
  }

  let text = '<b>KERANJANG</b>\n\n';
  let total = 0;
  for (const item of session.cart) {
    const subtotal = item.price * item.qty;
    total += subtotal;
    text += `${item.name}\n${item.qty} ${item.unit} \u00D7 ${formatRupiah(item.price)}\n= ${formatRupiah(subtotal)}\n\n`;
  }
  text += `<b>TOTAL</b>\n${formatRupiah(total)}`;

  await sendMessage(
    chatId,
    text,
    inlineKeyboard([
      [{ text: '\u2705 Checkout', callback_data: 'checkout' }],
      [{ text: '\u2795 Tambah Barang', callback_data: 'order' }],
      [{ text: '\u274C Kosongkan', callback_data: 'clear_cart' }],
    ])
  );
}

async function handleCheckout(chatId: number) {
  const session = sessions.get(chatId)!;
  if (!session.cart || session.cart.length === 0) {
    await sendMessage(chatId, 'Keranjang Anda kosong.');
    return;
  }

  let text = 'Konfirmasi pesanan?\n\n<b>Order:</b>\n';
  let total = 0;
  for (const item of session.cart) {
    const subtotal = item.price * item.qty;
    total += subtotal;
    text += `${item.name} \u2014 ${item.qty} ${item.unit}\n`;
  }
  text += `\n<b>Total: ${formatRupiah(total)}</b>`;

  await sendMessage(
    chatId,
    text,
    inlineKeyboard([
      [{ text: '\u2705 Konfirmasi', callback_data: 'confirm_order' }],
      [{ text: '\u274C Batal', callback_data: 'cart' }],
    ])
  );
}

async function handleConfirmOrder(chatId: number, username: string) {
  const session = sessions.get(chatId)!;
  if (!session.cart || session.cart.length === 0) {
    await sendMessage(chatId, 'Keranjang kosong.');
    return;
  }

  const customer = await findCustomer(chatId);
  if (!customer) {
    await sendMessage(chatId, 'Anda belum terdaftar. Silakan /start kembali.');
    return;
  }

  const total = session.cart.reduce((s, i) => s + i.price * i.qty, 0);

  // Generate order number
  const ordNoRes = await supabase.rpc('generate_order_number');
  const orderNumber = ordNoRes.data as string;

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_id: customer.id,
      status: 'pending',
      total_amount: total,
      payment_status: 'unpaid',
    })
    .select()
    .single();

  if (orderError || !order) {
    await sendMessage(chatId, `Terjadi kesalahan saat membuat pesanan: ${orderError?.message ?? 'unknown'}`);
    return;
  }

  // Create order items
  const items = session.cart.map((i) => ({
    order_id: order.id,
    product_id: i.product_id,
    quantity: i.qty,
    unit_price: i.price,
    subtotal: i.price * i.qty,
  }));
  await supabase.from('order_items').insert(items);

  // Clear cart
  session.cart = [];
  session.step = 'idle';
  sessions.set(chatId, session);

  await sendMessage(
    chatId,
    `\u2705 Pesanan berhasil dibuat.\n\nOrder ID: ${orderNumber}\nTotal: ${formatRupiah(total)}\nStatus: Menunggu diproses.\n\nAdmin akan memproses pesanan Anda.`
  );

  // Notify admin
  if (adminChatId) {
    await sendMessage(
      Number(adminChatId),
      `\u{1F514} NEW ORDER\n\nOrder: ${orderNumber}\nCustomer: ${customer.store_name}\nTotal: ${formatRupiah(total)}\nStatus: Pending\n\nAdmin dapat membuka dashboard untuk memproses order.`
    );
  }
}

async function handleMyOrders(chatId: number) {
  const customer = await findCustomer(chatId);
  if (!customer) {
    await sendMessage(chatId, 'Anda belum terdaftar.');
    return;
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!orders || orders.length === 0) {
    await sendMessage(chatId, 'Anda belum memiliki pesanan.');
    return;
  }

  let text = '<b>Pesanan Saya</b>\n\n';
  for (const o of orders) {
    text += `${o.order_number} - ${formatRupiah(Number(o.total_amount))} - ${o.status}\n`;
  }
  await sendMessage(chatId, text);
}

async function handleMyDebt(chatId: number) {
  const customer = await findCustomer(chatId);
  if (!customer) {
    await sendMessage(chatId, 'Anda belum terdaftar.');
    return;
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('customer_id', customer.id)
    .gt('outstanding_amount', 0)
    .order('due_date', { ascending: true });

  if (!invoices || invoices.length === 0) {
    await sendMessage(chatId, '\u2705 Anda tidak memiliki piutang. Semua lunas!');
    return;
  }

  let totalOutstanding = 0;
  let text = '<b>Piutang Saya</b>\n\n';
  for (const inv of invoices) {
    totalOutstanding += Number(inv.outstanding_amount);
    text += `${inv.invoice_number} - ${formatRupiah(Number(inv.outstanding_amount))} - ${inv.status}\n`;
  }
  text += `\n<b>Total Piutang: ${formatRupiah(totalOutstanding)}</b>`;
  await sendMessage(chatId, text);
}

async function handleClearCart(chatId: number) {
  const session = sessions.get(chatId)!;
  session.cart = [];
  sessions.set(chatId, session);
  await sendMessage(chatId, '\u274C Keranjang dikosongkan.');
}

// ====== Main router ======

async function processUpdate(update: TGUpdate) {
  // Handle callback queries (button presses)
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.from.id;
    const username = cq.from.username ?? '';
    const data = cq.data ?? '';
    const session = sessions.get(chatId);

    await answerCallback(cq.id);

    if (data === 'order') await handleOrderStart(chatId);
    else if (data === 'my_orders') await handleMyOrders(chatId);
    else if (data === 'my_debt') await handleMyDebt(chatId);
    else if (data === 'cart') await handleCart(chatId);
    else if (data === 'checkout') await handleCheckout(chatId);
    else if (data === 'confirm_order') await handleConfirmOrder(chatId, username);
    else if (data === 'clear_cart') await handleClearCart(chatId);
    else if (data.startsWith('cat_')) await handleCategorySelect(chatId, data.slice(4));
    else if (data.startsWith('prod_')) await handleProductSelect(chatId, data.slice(5));
    return;
  }

  // Handle text messages
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const username = msg.chat.username ?? '';
    const text = msg.text ?? '';
    const session = sessions.get(chatId);

    if (text === '/start') {
      await handleStart(chatId, username);
      return;
    }

    if (!session) {
      await handleStart(chatId, username);
      return;
    }

    if (session.step === 'awaiting_store_name') {
      const storeName = text.trim();
      if (!storeName) {
        await sendMessage(chatId, 'Nama toko tidak boleh kosong. Silakan masukkan nama toko Anda:');
        return;
      }
      await createCustomer(chatId, username, storeName);
      session.step = 'idle';
      session.cart = [];
      sessions.set(chatId, session);
      await sendMessage(
        chatId,
        `\u2705 Terima kasih! Toko "${storeName}" telah terdaftar.\n\nSilakan pilih menu:`,
        inlineKeyboard([
          [{ text: '\u{1F6D2} Pesan Barang', callback_data: 'order' }],
          [{ text: '\u{1F4E6} Pesanan Saya', callback_data: 'my_orders' }],
          [{ text: '\u{1F4B0} Piutang Saya', callback_data: 'my_debt' }],
        ])
      );
      return;
    }

    if (session.step === 'awaiting_quantity') {
      await handleQuantityInput(chatId, text);
      return;
    }

    // Default: show menu
    await sendMessage(chatId, 'Silakan pilih menu:', inlineKeyboard([
      [{ text: '\u{1F6D2} Pesan Barang', callback_data: 'order' }],
      [{ text: '\u{1F4E6} Pesanan Saya', callback_data: 'my_orders' }],
      [{ text: '\u{1F4B0} Piutang Saya', callback_data: 'my_debt' }],
    ]));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const update: TGUpdate = await req.json();
    await processUpdate(update);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
