import React, { useState, useEffect, useMemo } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import Payment from './payment';

import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  RotateCcw,
  DollarSign,
  Printer,
  X,
  ListChecks,
  RefreshCw,
} from 'lucide-react';

const POS = () => {
  const { products, updateStock, addProduct } = useInventory();
  const { shopSettings } = useSettings();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);

  const [showDirectBill, setShowDirectBill] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [showDues, setShowDues] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  // Cash expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  const [todaysExpenses, setTodaysExpenses] = useState([]);
  const [todaysExpenseTotal, setTodaysExpenseTotal] = useState(0);

  // Discount modal
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedItemForDiscount, setSelectedItemForDiscount] = useState(null);
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');

  // Returns
  const [recentSales, setRecentSales] = useState([]);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');

  // Dues
  const [dues, setDues] = useState([]);
  const [outstandingDueTotal, setOutstandingDueTotal] = useState(0);
  const [collectionInputs, setCollectionInputs] = useState({});
  const [collectionModes, setCollectionModes] = useState({});

  // Direct Bill form
  const [directBillForm, setDirectBillForm] = useState({
    name: '',
    brand: '',
    size: '',
    category: 'Direct Bill',
    price: '',
    quantity: 1,
    barcode: '',
  });

  // Suggestions
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const brandOptions = useMemo(() => uniq(products.map((p) => p.brand)), [products]);
  const sizeOptions = useMemo(() => uniq(products.map((p) => p.size)), [products]);
  const categoryOptions = useMemo(
    () => uniq(['Direct Bill', ...products.map((p) => p.category || 'Direct Bill')]),
    [products]
  );
  // Barcode helpers
  const ucAlnum = (s) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const makeBaseBarcode = (name, brand) => {
    const n = ucAlnum(name);
    const b = ucAlnum(brand || 'GEN');
    return n ? `${n}_${b}` : '';
  };
  const existingBarcodes = useMemo(
    () => new Set(products.map((p) => (p.barcode || '').toLowerCase())),
    [products]
  );
  const uniqueBarcode = (base) => {
    if (!base) return '';
    if (!existingBarcodes.has(base.toLowerCase())) return base;
    let i = 1;
    while (true) {
      const cand = `${base}_${String(i).padStart(2, '0')}`;
      if (!existingBarcodes.has(cand.toLowerCase())) return cand;
      i++;
    }
  };

  useEffect(() => {
    if (!showDirectBill) return;
    const base = makeBaseBarcode(directBillForm.name, directBillForm.brand);
    setDirectBillForm((prev) => ({ ...prev, barcode: uniqueBarcode(base) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directBillForm.name, directBillForm.brand, showDirectBill, products]);

  // Stats
  const [todayStats, setTodayStats] = useState({
    sales: 0,
    returns: 0,
    netSales: 0,
    monthlySales: 0,
    dueToday: 0,
    dueCollectionsToday: 0,
    todayTotal: 0,
  });

  // Drawer + tenders
  const [drawer, setDrawer] = useState({ date: '', opening: 0, current: 0 });
  const [showDrawerModal, setShowDrawerModal] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [dailyTenders, setDailyTenders] = useState({ date: '', cash: 0, upi: 0 });

  const todayStr = () => new Date().toLocaleDateString('en-CA');

  const saveDrawer = (d) => {
    setDrawer(d);
    localStorage.setItem('pos_drawer', JSON.stringify(d));
  };
  const loadDrawer = () => {
    const stored = JSON.parse(localStorage.getItem('pos_drawer') || 'null');
    if (!stored || stored.date !== todayStr()) setShowDrawerModal(true);
    else setDrawer(stored);
  };
  const updateDrawer = (delta) => {
    const base = JSON.parse(localStorage.getItem('pos_drawer') || 'null');
    const snap =
      base && base.date === todayStr() ? base : { date: todayStr(), opening: 0, current: 0 };
    const next = { ...snap, current: parseFloat((snap.current + delta).toFixed(2)) };
    saveDrawer(next);
  };
  const submitOpeningCash = () => {
    const amt = parseFloat(openingCashInput);
    if (isNaN(amt) || amt < 0) return alert('Please enter a valid non-negative amount.');
    saveDrawer({ date: todayStr(), opening: amt, current: amt });
    setShowDrawerModal(false);
  };

  const saveDailyTenders = (t) => {
    setDailyTenders(t);
    localStorage.setItem('pos_daily_tenders', JSON.stringify(t));
  };
  const loadDailyTenders = () => {
    const stored = JSON.parse(localStorage.getItem('pos_daily_tenders') || 'null');
    if (!stored || stored.date !== todayStr()) saveDailyTenders({ date: todayStr(), cash: 0, upi: 0 });
    else setDailyTenders(stored);
  };
  const bumpCashTotal = (delta) => {
    const base = JSON.parse(localStorage.getItem('pos_daily_tenders') || 'null') || {
      date: todayStr(),
      cash: 0,
      upi: 0,
    };
    const snap = base.date === todayStr() ? base : { date: todayStr(), cash: 0, upi: 0 };
    saveDailyTenders({ ...snap, cash: parseFloat((snap.cash + delta).toFixed(2)) });
  };
  const bumpUPITotal = (delta) => {
    const base = JSON.parse(localStorage.getItem('pos_daily_tenders') || 'null') || {
      date: todayStr(),
      cash: 0,
      upi: 0,
    };
    const snap = base.date === todayStr() ? base : { date: todayStr(), cash: 0, upi: 0 };
    saveDailyTenders({ ...snap, upi: parseFloat((snap.upi + delta).toFixed(2)) });
  };

  // Mount
  const [allSales, setAllSales] = useState([]);
  const [returnInvoiceSearch, setReturnInvoiceSearch] = useState('');
  const [dueInvoiceSearch, setDueInvoiceSearch] = useState('');

  useEffect(() => {
    loadDrawer();
    loadDailyTenders();
    loadRecentSales();
    loadDues();
    calculateTodayStats();
  }, []);

  const loadRecentSales = () => {
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const sorted = sales.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setAllSales(sorted);
    setRecentSales(sorted.slice(0, 20));
  };

  const computeOutstandingDue = (list) =>
    list.reduce((sum, d) => {
      if (typeof d.balance === 'number') return sum + d.balance;
      const paidParts = (d.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
      const upfront = d.upfrontPaid || 0;
      const total = d.total || 0;
      const bal = Math.max(0, total - upfront - paidParts);
      return sum + bal;
    }, 0);

  const loadDues = () => {
    const stored = JSON.parse(localStorage.getItem('pos_dues') || '[]');
    const list = stored.filter((d) => !d.settled).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setDues(list);
    setOutstandingDueTotal(parseFloat(computeOutstandingDue(list).toFixed(2)));

    const inputs = {};
    const modes = {};
    list.forEach((d) => {
      inputs[d.id] = (d.balance ?? 0).toString();
      modes[d.id] = 'cash';
    });
    setCollectionInputs(inputs);
    setCollectionModes(modes);
  };

  const calculateTodayStats = () => {
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const returns = JSON.parse(localStorage.getItem('pos_returns') || '[]');
    const duePayments = JSON.parse(localStorage.getItem('pos_due_payments') || '[]');

    const todayTag = new Date().toDateString();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const todaySales = sales
      .filter((s) => new Date(s.timestamp).toDateString() === todayTag)
      .reduce((sum, s) => sum + s.total, 0);

    const todayReturns = returns
      .filter((r) => new Date(r.timestamp).toDateString() === todayTag)
      .reduce((sum, r) => sum + r.totalRefund, 0);

    const monthlySales = sales
      .filter((s) => {
        const d = new Date(s.timestamp);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, s) => sum + s.total, 0);

    const monthlyReturns = returns
      .filter((r) => {
        const d = new Date(r.timestamp);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + r.totalRefund, 0);

    const dueToday = sales
      .filter((s) => new Date(s.timestamp).toDateString() === todayTag && s.paymentMethod === 'DUE')
      .reduce((sum, s) => sum + Math.max(0, s.total - (s.amountPaid || 0)), 0);

    const dueCollectionsToday = duePayments
      .filter((p) => new Date(p.timestamp).toDateString() === todayTag)
      .reduce((sum, p) => sum + p.amount, 0);

    const todayNet = todaySales - todayReturns;

    setTodayStats({
      sales: todaySales,
      returns: todayReturns,
      netSales: todayNet,
      monthlySales: monthlySales - monthlyReturns,
      dueToday,
      dueCollectionsToday,
      todayTotal: todayNet,
    });
  };
  // Search
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      return name.includes(q) || barcode.includes(q) || brand.includes(q);
    });
  }, [products, searchTerm]);

  // Cart helpers (skip stock checks for non-inventory items)
  const addToCart = (product) => {
    const existingItem = cart.find((i) => i.id === product.id);
    const isNonInv = product.nonInventory;
    const canIncrease = isNonInv || (existingItem ? existingItem.quantity < product.stock : product.stock > 0);

    if (!canIncrease) return alert('Insufficient stock!');

    if (existingItem) {
      setCart(cart.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setCart([...cart, { ...product, quantity: 1, discount: 0, discountType: 'amount' }]);
    }
  };

  const updateCartQuantity = (id, change) => {
    setCart(
      cart
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = item.quantity + change;
          if (newQty <= 0) return null;
          if (!item.nonInventory) {
            const prod = products.find((p) => p.id === id);
            if (prod && newQty > prod.stock) {
              alert('Insufficient stock!');
              return item;
            }
          }
          return { ...item, quantity: newQty };
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => setCart(cart.filter((i) => i.id !== id));

  const resetDirectBillForm = () =>
    setDirectBillForm({
      name: '',
      brand: '',
      size: '',
      category: 'Direct Bill',
      price: '',
      quantity: 1,
      barcode: '',
    });

  // Direct Bill — Add & Continue (inventory)
  const handleDirectBillAddAndContinue = (e) => {
    e.preventDefault();
    const name = directBillForm.name.trim();
    const brand = (directBillForm.brand || '').trim();
    const size = (directBillForm.size || '').trim();
    const category = (directBillForm.category || 'Direct Bill').trim();
    const qty = parseInt(directBillForm.quantity) || 1;
    const price = parseFloat(directBillForm.price);
    if (!name || isNaN(price) || price <= 0 || qty <= 0) {
      alert('Please enter valid name, price (>0) and quantity (>=1).');
      return;
    }
    const base = makeBaseBarcode(name, brand);
    const barcode = directBillForm.barcode || uniqueBarcode(base);

    const newProduct = {
      id: `inv_${Date.now()}`,
      name, brand, size, category, barcode,
      description: 'Created via Direct Bill',
      price, stock: qty, minStock: 5,
      supplier: '', purchasePrice: null, margin: '',
    };

    try { addProduct(newProduct); } catch (err) { console.error('addProduct failed:', err); }

    setCart((prev) => [
      ...prev,
      { ...newProduct, quantity: qty, discount: 0, discountType: 'amount' },
    ]);

    resetDirectBillForm();
    setShowDirectBill(false);
  };

  // Direct Bill — Bill Without Inventory (no stock tracking)
  const handleDirectBillWithoutInventory = (e) => {
    e.preventDefault();
    const name = directBillForm.name.trim();
    const brand = (directBillForm.brand || '').trim();
    const size = (directBillForm.size || '').trim();
    const category = (directBillForm.category || 'Direct Bill').trim();
    const qty = parseInt(directBillForm.quantity) || 1;
    const price = parseFloat(directBillForm.price);
    if (!name || isNaN(price) || price <= 0 || qty <= 0) {
      alert('Please enter valid name, price (>0) and quantity (>=1).');
      return;
    }
    const base = makeBaseBarcode(name, brand);
    const barcode = directBillForm.barcode || uniqueBarcode(base);

    // temp item, not in inventory
    const tempItem = {
      id: `temp_${Date.now()}`,
      name, brand, size, category, barcode,
      description: 'Direct Bill (No Inventory)',
      price, stock: Number.POSITIVE_INFINITY,
      nonInventory: true,
    };

    setCart((prev) => [
      ...prev,
      { ...tempItem, quantity: qty, discount: 0, discountType: 'amount' },
    ]);

    resetDirectBillForm();
    setShowDirectBill(false);
  };
  // Totals / Discounts
  const calculateItemTotal = (item) => {
    const baseTotal = item.price * item.quantity;
    if (item.discount > 0) {
      if (item.discountType === 'percentage') return baseTotal - (baseTotal * item.discount) / 100;
      return Math.max(0, baseTotal - item.discount);
    }
    return baseTotal;
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalDiscount = cart.reduce((sum, item) => {
      const baseTotal = item.price * item.quantity;
      return sum + (baseTotal - calculateItemTotal(item));
    }, 0);
    const afterDiscount = subtotal - totalDiscount;
    const taxRate = Number(shopSettings?.taxRate ?? 0);
    const tax = afterDiscount * (taxRate / 100);
    const total = afterDiscount + tax;
    return { subtotal, totalDiscount, afterDiscount, tax, total, cgst: tax / 2, sgst: tax / 2, taxRate };
  };

  const applyDiscount = () => {
    if (!selectedItemForDiscount) return;
    const raw = parseFloat(discountValue);
    if (isNaN(raw) || raw < 0) return alert('Enter a valid non-negative discount.');
    setCart((prev) =>
      prev.map((it) => {
        const isSame =
          it.id === selectedItemForDiscount.id ||
          (it.barcode && selectedItemForDiscount.barcode &&
            it.barcode.toLowerCase() === selectedItemForDiscount.barcode.toLowerCase());
        if (!isSame) return it;

        const baseTotal = it.price * it.quantity;
        if (discountType === 'percentage') {
          const pct = Math.min(100, raw);
          return { ...it, discountType: 'percentage', discount: pct };
        }
        const amt = Math.min(baseTotal, raw);
        return { ...it, discountType: 'amount', discount: amt };
      })
    );
    setShowDiscountModal(false);
    setSelectedItemForDiscount(null);
    setDiscountValue('');
  };

  const recordDueCollection = (dueId, amount, mode) => {
    const payments = JSON.parse(localStorage.getItem('pos_due_payments') || '[]');
    payments.push({
      id: `COL${Date.now()}`, dueId, amount, mode,
      timestamp: new Date().toISOString(), cashier: user.name,
    });
    localStorage.setItem('pos_due_payments', JSON.stringify(payments));
  };

  const printDueCollectionReceipt = (due, payment) => {
    try {
      const w = window.open('', '_blank', 'width=400,height=600');
      const html = `
        <!doctype html><html><head><meta charset="utf-8" />
        <title>Due Collection Receipt</title>
        <style>
          @page { size: 50mm auto; margin: 0; }
          @media print { html, body { width: 50mm; } .no-break { page-break-inside: avoid; } }
          html, body { margin:0; padding:0; width:45mm; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, 'Noto Sans', sans-serif; font-size:10px; line-height:1.25; }
          .center{text-align:center}.left{text-align:left}.right{text-align:right}.mono{font-variant-numeric:tabular-nums}
          .header{font-size:13px;text-transform:uppercase;font-weight:700}
          .sub{font-size:9px}
          .rule{border-bottom:1px dashed #000;margin:4px 0}
          table{border-collapse:collapse;width:100%;table-layout:fixed}
          th,td{padding:1px 0;vertical-align:top}
        </style></head><body>
        <div class="center">
          <div class="header">${shopSettings?.name || ''}</div>
          <div class="sub">${shopSettings?.address || ''}</div>
          <div class="sub">Ph: ${shopSettings?.phone || ''}</div>
          <div class="sub">Email: ${shopSettings?.email || ''}</div>
          <div class="rule"></div>
          <div class="sub"><strong>DUE COLLECTION RECEIPT</strong></div>
        </div>
        <div class="sub">
          <div>Receipt: ${payment.id}</div>
          <div>Sale: ${due.saleId}</div>
          <div>Customer: ${due.customerName || '-'}</div>
          <div>Date: ${new Date(payment.timestamp).toLocaleString('en-IN')}</div>
          <div>Cashier: ${payment.cashier || '-'}</div>
        </div>
        <div class="rule"></div>
        <table>
          <tr><td class="left">Collected</td><td class="right mono">₹${Number(payment.amount || 0).toFixed(2)}</td></tr>
          <tr><td class="left">Mode</td><td class="right">${String(payment.mode || '').toUpperCase()}</td></tr>
          <tr><td class="left">New Balance</td><td class="right mono">₹${Number(due.balance || 0).toFixed(2)}</td></tr>
        </table>
        <div class="rule"></div>
        <div class="center sub">Thank you</div>
        </body></html>
      `;
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
    } catch (e) {
      // ignore
    }
  };

  const findProductInCatalog = (item) =>
    products.find(
      (p) =>
        p.id === item.id ||
        (!!item.barcode && !!p.barcode && p.barcode.toLowerCase() === item.barcode.toLowerCase())
    );

  // ===== SALE RECEIPT (₹) =====
  const printSaleReceipt = (sale) => {
    const w = window.open('', '_blank', 'width=400,height=600');
    const receiptHTML = `
     <!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page { size: 50mm auto; margin: 0; }
  @media print { html, body { width: 50mm; } .no-break { page-break-inside: avoid; } }
  html, body {
    margin: 0; padding: 0; width: 45mm; background: #fff; color: #000;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", sans-serif;
    font-size: 10px; line-height: 1.25; font-weight: 500;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; word-break: break-word;
  }
  .bottom-space { padding-bottom: 8mm; }
  .center { text-align: center; } .left { text-align: left; } .right { text-align: right; } .mono { font-variant-numeric: tabular-nums; }
  .header { font-size: 13px; letter-spacing: 0.2px; padding-top: 2px; text-transform: uppercase; }
  .sub { font-size: 9px; letter-spacing: 0.2px; }
  .rule { border-bottom: 1px solid #000; margin: 4px 0; }
  .rule-thick { border-bottom: 2px solid #000; margin: 4px 0; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { padding: 1px 0; vertical-align: top; }
  .col-item { width: 40%; } .col-qty { width: 12%; } .col-rate { width: 24%; } .col-amt { width: 24%; }
  th { font-size: 9px; text-transform: uppercase; }
  .emph-row td { font-size: 12px; }
  .key-label { text-transform: uppercase; }
  .tag { display:inline-block; padding:2px 4px; border:1px solid #000; border-radius:2px; margin-top:4px; font-size:8px; }
</style>
</head>
<body class="bottom-space">
  <div class="center">
    <div class="header">${shopSettings?.name || ''}</div>
    <div class="sub">${shopSettings?.address || ''}</div>
    <div class="sub">Ph: ${shopSettings?.phone || ''}</div>
    <div class="sub">Email: ${shopSettings?.email || ''}</div>
    ${shopSettings?.gstNumber ? `<div class="sub">RETURN POLICY: ${shopSettings.gstNumber}</div>` : ''}

  <div class="sub">
  <div class="rule"></div>
  <div>SALE RECEIPT</div>
    <div>Bill No: ${sale.id}</div>
    <div>Original Date: ${new Date(sale.timestamp).toLocaleString('en-IN')}</div>
    <div>Cashier: ${sale.cashier || '-'}</div>
    ${sale.paymentMethod === 'DUE' ? `<div>Customer: ${sale.customerName || ''}</div>` : ''}
  </div>
  <div class="rule"></div>

  <table>
    <thead>
      <tr>
        <th class="left  col-item">Item</th>
        <th class="center col-qty">Qty</th>
        <th class="right col-rate">Rate</th>
        <th class="right col-amt">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${(sale.items || []).map((item) => {
        const qty  = Number(item.quantity) || 0;
        const rate = Number(item.price) || 0;
        const line = (rate * qty).toFixed(2);
        const hadDiscount = Number(item.discount) > 0 || (item.finalPrice && item.finalPrice !== item.price);
        const saved = hadDiscount
          ? (rate * qty - (Number(item.finalPrice || rate) * qty)).toFixed(2)
          : null;
        return `
          <tr class="no-break">
            <td class="left  col-item sub nowrap">${item.name}${item.size ? ` (${item.size})` : ''}</td>
            <td class="center col-qty sub mono nowrap">${qty}</td>
            <td class="right col-rate sub mono nowrap">₹${rate.toFixed(2)}</td>
            <td class="right col-amt  sub mono nowrap">₹${line}</td>
          </tr>
          ${
            hadDiscount
              ? `<tr class=\"no-break\">\n                  <td colspan=\"3\" class=\"left sub nowrap\">Discount ${
                    item.discountType === 'percentage' ? `(${item.discount}%)` : item.discount ? `(₹${item.discount})` : ''
                  }</td>
                  <td class=\"right sub mono nowrap\">-₹${saved}</td>
                </tr>`
              : ''
          }`;
      }).join('')}
    </tbody>
  </table>

  <div class="rule"></div>

  <table>
    <tr><td class="left sub">Subtotal</td><td class="right sub mono">₹${Number(sale.subtotal || 0).toFixed(2)}</td></tr>
    ${Number(sale.totalDiscount || 0) > 0 ? `<tr><td class="left sub">Total Discount</td><td class="right sub mono">-₹${Number(sale.totalDiscount || 0).toFixed(2)}</td></tr>` : ''}
    <tr><td class="left sub">After Discount</td><td class="right sub mono">₹${Number(sale.afterDiscount ?? (sale.subtotal - sale.totalDiscount) ?? 0).toFixed(2)}</td></tr>
    <tr><td class="left sub">CGST (${(shopSettings?.taxRate || 0)/2}%)</td><td class="right sub mono">₹${Number(sale.cgst || 0).toFixed(2)}</td></tr>
    <tr><td class="left sub">SGST (${(shopSettings?.taxRate || 0)/2}%)</td><td class="right sub mono">₹${Number(sale.sgst || 0).toFixed(2)}</td></tr>
    <tr class="rule-thick"></tr>
    <tr class="emph-row"><td class="left key-label">Total</td><td class="right mono">₹${Number(sale.total || 0).toFixed(2)}</td></tr>
    <tr class="emph-row"><td class="left">Paid (${sale.paymentMethod})</td><td class="right mono">₹${Number(sale.amountPaid ?? sale.total ?? 0).toFixed(2)}</td></tr>
    <tr class="emph-row"><td class="left">${sale.paymentMethod === 'DUE' ? 'DUE' : 'Change'}</td>
      <td class="right mono">₹${
        sale.paymentMethod === 'DUE'
          ? Math.max(0, Number(sale.total || 0) - Number(sale.amountPaid || 0)).toFixed(2)
          : Number(sale.change || 0).toFixed(2)
      }</td></tr>
  </table>

  <div class="rule"></div>
  <div class="center">
    ${shopSettings?.logo ? `<img src="${shopSettings.logo}" alt="Shop Logo" style="max-width: 40mm; height: auto; display: block; margin: 0 auto 5px auto; border-radius: 3px;" />` : ''}
  </div>
  <div class="center">!!SCAN TO select Your shoe Online!!</div>
  <div class="center sub no-break">
    <div>𝓢𝓐𝓛𝓔 𝓢𝓣𝓐𝓡𝓣𝓘𝓝𝓖 𝓕𝓡𝓞𝓜 21 𝓢𝓔𝓟𝓣𝓔𝓜𝓑𝓔𝓡</div>
    <div>Thank you for shopping!</div>
    <div>Visit again soon!</div>
    <div>Powered by Dipali Shoe House</div>
    <h4>Exchange policy: 3 days with bill</h4>
    <h1>卐</h1>
    <h1>ॐ</h1>
  </div>
</body>
</html>`;
    w.document.write(receiptHTML);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };
  // ===== PROCESS SALE (called by Payment modal) =====
  const processSale = ({ payType, payments = [], amountPaid, customerName }) => {
    if (cart.length === 0) return alert('Cart is empty!');
    const totals = calculateTotals();

    // validate again (safety)
    if (payType === 'PAID') {
      if (amountPaid < totals.total) return alert('Insufficient payment amount for PAID!');
      const modes = new Set((payments || []).map(p => (p.mode || '').toLowerCase()));
      if (modes.size === 0) return alert('Select at least one payment mode (Cash or UPI).');
      for (const m of modes) if (!['cash', 'upi'].includes(m)) return alert('Invalid payment mode.');
    } else {
      if (!customerName?.trim()) return alert('Please enter customer name for DUE.');
      if (isNaN(amountPaid) || amountPaid < 0) return alert('Enter a valid upfront amount.');
      const modes = new Set((payments || []).map(p => (p.mode || '').toLowerCase()));
      if (modes.size === 0 && amountPaid > 0) return alert('Select upfront mode (Cash or UPI).');
      for (const m of modes) if (!['cash', 'upi'].includes(m)) return alert('Invalid payment mode.');
      if (amountPaid > totals.total) return alert('Upfront cannot exceed total.');
    }

    const cashPaid = (payments || []).filter(p => p.mode === 'cash').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const upiPaid  = (payments || []).filter(p => p.mode === 'upi') .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const paid = Math.min(amountPaid || 0, totals.total);
    const methodLabel = payType === 'DUE'
      ? 'DUE'
      : (cashPaid > 0 && upiPaid > 0) ? 'MIXED' : (cashPaid > 0 ? 'CASH' : 'UPI');

    const overpay = Math.max(0, (amountPaid || 0) - totals.total);
    const change = Math.min(cashPaid, overpay);

    const sale = {
      id: `INV${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: cart.map((item) => ({
        ...item,
        finalPrice: calculateItemTotal(item) / item.quantity,
      })),
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      afterDiscount: totals.afterDiscount,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total,
      paymentMethod: methodLabel,
      amountPaid: paid,
      change,
      paymentBreakdown: payments,
      cashier: user.name,
      customerName: payType === 'DUE' ? customerName.trim() : undefined,
    };

    // Update stock (skip nonInventory items)
    cart.forEach((item) => {
      if (item.nonInventory) return;
      const product = findProductInCatalog(item);
      if (product) updateStock(product.id, product.stock - item.quantity);
    });

    // Save sale
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    sales.push(sale);
    localStorage.setItem('pos_sales', JSON.stringify(sales));

    // Create/Update due if needed
    if (payType === 'DUE') {
      const remaining = Math.max(0, totals.total - paid);
      if (remaining > 0) {
        const allDues = JSON.parse(localStorage.getItem('pos_dues') || '[]');
        const due = {
          id: `DUE${Date.now()}`,
          saleId: sale.id,
          customerName: customerName.trim(),
          total: totals.total,
          upfrontPaid: paid,
          upfrontTender: (cashPaid > 0 && upiPaid > 0) ? 'MIXED' : (cashPaid > 0 ? 'CASH' : (upiPaid > 0 ? 'UPI' : '')),
          balance: remaining,
          createdAt: sale.timestamp,
          settled: false,
          payments: [],
        };
        allDues.push(due);
        localStorage.setItem('pos_dues', JSON.stringify(allDues));
      }
    }

    // Drawer & Tender updates
    if (payType === 'PAID') {
      if (cashPaid > 0) {
        const netCash = Math.max(0, cashPaid - change);
        if (netCash > 0) { updateDrawer(netCash); bumpCashTotal(netCash); }
      }
      if (upiPaid > 0) { bumpUPITotal(upiPaid); }
    } else {
      if (cashPaid > 0) { updateDrawer(cashPaid); bumpCashTotal(cashPaid); }
      if (upiPaid  > 0) { bumpUPITotal(upiPaid); }
    }

    printSaleReceipt(sale);

    // Cleanup & refresh
    setCart([]);
    setShowPayment(false);
    loadRecentSales();
    loadDues();
    calculateTodayStats();
    loadDailyTenders();

    alert('Sale completed successfully!');
  };
  // Returns
  const processReturn = () => {
    if (returnItems.length === 0) return alert('No items selected for return!');
    if (!returnReason) return alert('Please select a return reason!');
    const totalRefund = returnItems.reduce((sum, it) => sum + it.finalPrice * it.returnQuantity, 0);

    const ret = {
      id: `RET${Date.now()}`,
      timestamp: new Date().toISOString(),
      originalSaleId: selectedSaleForReturn.id,
      items: returnItems,
      totalRefund,
      reason: returnReason,
      processedBy: user.name,
    };

    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const updated = sales.map((sale) => {
      if (sale.id !== selectedSaleForReturn.id) return sale;
      const items = sale.items
        .map((sItem) => {
          const ri = returnItems.find((r) => r.id === sItem.id || r.barcode === sItem.barcode);
          if (!ri) return sItem;
          const remaining = sItem.quantity - ri.returnQuantity;
          return remaining > 0 ? { ...sItem, quantity: remaining } : null;
        })
        .filter(Boolean);

      const newSubtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
      const newTotalDiscount = items.reduce((sum, it) => {
        const base = it.price * it.quantity;
        const itemTotal = it.finalPrice * it.quantity;
        return sum + (base - itemTotal);
      }, 0);
      const newAfterDiscount = newSubtotal - newTotalDiscount;
      const taxRate = Number(shopSettings?.taxRate ?? 0);
      const newTax = newAfterDiscount * (taxRate / 100);
      const newTotal = newAfterDiscount + newTax;

      return {
        ...sale,
        items,
        subtotal: newSubtotal,
        totalDiscount: newTotalDiscount,
        afterDiscount: newAfterDiscount,
        tax: newTax,
        cgst: newTax / 2,
        sgst: newTax / 2,
        total: newTotal,
        returns: [...(sale.returns || []), { id: ret.id, amount: totalRefund, timestamp: ret.timestamp }],
      };
    });
    localStorage.setItem('pos_sales', JSON.stringify(updated));

    // Restock by barcode/id (skip non-inventory items)
    returnItems.forEach((it) => {
      const product = findProductInCatalog(it);
      if (product) updateStock(product.id, product.stock + it.returnQuantity);
    });

    updateDrawer(-totalRefund);
    bumpCashTotal(-totalRefund);

    const returns = JSON.parse(localStorage.getItem('pos_returns') || '[]');
    returns.push(ret);
    localStorage.setItem('pos_returns', JSON.stringify(returns));

    printReturnReceipt(ret);

    setShowReturns(false);
    setSelectedSaleForReturn(null);
    setReturnItems([]);
    setReturnReason('');
    loadRecentSales();
    calculateTodayStats();
    loadDailyTenders();

    alert(`Return processed successfully! Refund amount: ₹${totalRefund.toFixed(2)}`);
  };

  const printReturnReceipt = (ret) => {
    const w = window.open('', '_blank', 'width=400,height=600');
    const html = `
      <!doctype html><html><head><meta charset="utf-8" />
      <title>Return Receipt</title>
      <style>
        @page { size: 50mm auto; margin: 0; }
        @media print { html, body { width: 50mm; } .no-break { page-break-inside: avoid; } }
        html, body { margin:0; padding:0; width:45mm; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", sans-serif; font-size:10px; line-height:1.25; }
        .center{text-align:center}.left{text-align:left}.right{text-align:right}.mono{font-variant-numeric:tabular-nums}.bold{font-weight:700}
        .header{font-size:13px;text-transform:uppercase;font-weight:700}
        .sub{font-size:9px}
        .rule{border-bottom:1px dashed #000;margin:4px 0}
        table{border-collapse:collapse;width:100%;table-layout:fixed}
        th,td{padding:1px 0;vertical-align:top}
        th{font-size:9px;font-weight:700;text-transform:uppercase}
        .col-item{width:48%}.col-qty{width:15%}.col-rate{width:18%}.col-refund{width:19%}
      </style></head><body>
      <div class="center">
        <div class="header">${shopSettings.name}</div>
        <div class="sub">${shopSettings.address}</div>
        <div class="sub">Ph: ${shopSettings.phone}</div>
        <div class="sub">Email: ${shopSettings.email}</div>
        ${shopSettings.gstNumber ? `<div class="sub">GSTIN: ${shopSettings.gstNumber}</div>` : ''}
        <div class="rule"></div>
        <div class="bold">RETURN RECEIPT</div>
      </div>

      <div class="sub">
        <div>Return No: ${ret.id}</div>
        <div>Original Sale: ${ret.originalSaleId}</div>
        <div>Date: ${new Date(ret.timestamp).toLocaleString('en-IN')}</div>
        <div>Processed by: ${ret.processedBy}</div>
        <div>Reason: ${ret.reason}</div>
      </div>
      <div class="rule"></div>

      <table>
        <thead><tr><th class="left col-item">Item</th><th class="center col-qty">RATE✗QTY</th></tr></thead>
        <tbody>
          ${ret.items.map(it => `
            <tr class="no-break">
              <td class="left sub">${it.name}${it.size ? ` (${it.size})` : ''}</td>
              <td class="center sub mono">₹${it.finalPrice.toFixed(2)}✗${it.returnQuantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="rule"></div>
      <table>
        <tr><td class="left bold">Total Refund:</td><td class="right mono bold">₹${ret.totalRefund.toFixed(2)}</td></tr>
      </table>
      <div class="rule"></div>
      <div class="center sub">
        <div>Return processed successfully</div>
        <div>Thank you for your understanding</div>
        <div>Designed by Debanjan Pan</div>
        <h1>卐</h1>
        <h1>ॐ</h1>
      </div>
      </body></html>
    `;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const selectSaleForReturn = (sale) => {
    setSelectedSaleForReturn(sale);
    setReturnItems(
      sale.items.map((item) => ({
        ...item,
        returnQuantity: 0,
        maxReturnQuantity: item.quantity,
      }))
    );
  };

  const updateReturnQuantity = (itemId, quantity) => {
    setReturnItems(
      returnItems.map((item) =>
        item.id === itemId
          ? { ...item, returnQuantity: Math.max(0, Math.min(quantity, item.maxReturnQuantity)) }
          : item
      )
    );
  };
  const collectDue = (due, amount, mode) => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return alert('Invalid amount entered!');
    if (amt > due.balance) return alert('Amount cannot exceed remaining balance!');
    if (!['cash', 'upi'].includes(mode)) return alert('Select a valid collection mode.');

    const all = JSON.parse(localStorage.getItem('pos_dues') || '[]');
    let madePayment = null;
    const updated = all.map((d) => {
      if (d.id !== due.id) return d;
      const payment = {
        id: `PAY${Date.now()}`, amount: amt, mode,
        timestamp: new Date().toISOString(), cashier: user.name,
      };
      const payments = [...(d.payments || []), payment];
      const balance = (d.balance || 0) - amt;
      madePayment = payment;
      return { ...d, payments, balance, settled: balance <= 0, settledAt: balance <= 0 ? payment.timestamp : d.settledAt };
    });
    localStorage.setItem('pos_dues', JSON.stringify(updated));

    recordDueCollection(due.id, amt, mode);

    if (mode === 'cash') { updateDrawer(amt); bumpCashTotal(amt); }
    else { bumpUPITotal(amt); }

    loadDues();
    calculateTodayStats();
    loadDailyTenders();

    try {
      const newDue = updated.find(d => d.id === due.id) || due;
      if (madePayment) printDueCollectionReceipt(newDue, madePayment);
    } catch {}

    alert(`Collected ₹${amt.toFixed(2)} (${mode.toUpperCase()}) from ${due.customerName}`);
  };

  const settleDue = (due) => {
    const mode = (collectionModes[due.id] || 'cash').toLowerCase();
    collectDue(due, due.balance, mode);
  };

  const totals = calculateTotals();

  const submitExpense = () => {
    const amt = parseFloat(expenseAmount);
    const reason = (expenseReason || '').trim();
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid expense amount > 0');
    if (!reason) return alert('Please enter a reason for the expense');
    const rec = {
      id: `EXP${Date.now()}`,
      amount: amt,
      reason,
      timestamp: new Date().toISOString(),
      cashier: user.name,
    };
    const list = JSON.parse(localStorage.getItem('pos_expenses') || '[]');
    list.push(rec);
    localStorage.setItem('pos_expenses', JSON.stringify(list));
    // Deduct from drawer and cash totals
    updateDrawer(-amt);
    bumpCashTotal(-amt);
    refreshTodayExpenses();
    setShowExpenseModal(false);
    setExpenseAmount('');
    setExpenseReason('');
    alert('Expense recorded. Cash deducted from drawer.');
  };

  const refreshTodayExpenses = () => {
    try {
      const list = JSON.parse(localStorage.getItem('pos_expenses') || '[]');
      const today = todayStr();
      const todays = list
        .filter((r) => new Date(r.timestamp).toLocaleDateString('en-CA') === today)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTodaysExpenses(todays);
      setTodaysExpenseTotal(todays.reduce((s, r) => s + (Number(r.amount) || 0), 0));
    } catch {
      setTodaysExpenses([]);
      setTodaysExpenseTotal(0);
    }
  };

  useEffect(() => {
    if (showExpenseModal) refreshTodayExpenses();
  }, [showExpenseModal]);
  return (
    <div className="space-y-6">
      {/* Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Drawer Cash (Today)</p>
              <p className="text-2xl font-bold">₹{drawer.current.toFixed(2)}</p>
              <p className="text-xs text-purple-100 mt-1">Opening: ₹{drawer.opening.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-200" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Today by Tender</p>
              <p className="text-sm">Cash: <span className="font-bold">₹{dailyTenders.cash.toFixed(2)}</span></p>
              <p className="text-sm">UPI: <span className="font-bold">₹{dailyTenders.upi.toFixed(2)}</span></p>
            </div>
            <DollarSign className="w-8 h-8 text-emerald-200" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-100 text-sm">Total Due Outstanding</p>
              <p className="text-2xl font-bold">₹{outstandingDueTotal.toFixed(2)}</p>
              <p className="text-xs text-slate-100 mt-1">Auto-updates with collections</p>
            </div>
            <Banknote className="w-8 h-8 text-slate-200" />
          </div>
        </div>
      </div>

      {/* Products + Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search shoes by name, barcode, or brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDirectBill(true)}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Direct Bill
                </button>
                <button
                  onClick={() => setShowReturns(true)}
                  className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Returns
                </button>
                <button
                  onClick={() => { loadDues(); setShowDues(true); }}
                  className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
                >
                  <ListChecks className="w-4 h-4" /> Dues
                </button>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <Minus className="w-4 h-4" /> Expense
                </button>
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <h3 className="font-medium text-gray-900 mb-1 text-sm">{product.name}</h3>
                  <p className="text-xs text-gray-600 mb-2">{product.brand} - {product.category}</p>
                  {product.size && <p className="text-xs text-gray-500 mb-2">Size: {product.size}</p>}
                  {product.purchasePrice !== null && product.purchasePrice !== undefined && product.purchasePrice !== '' && Number(product.purchasePrice) > 0 && (
                    <p className="text-lg text-green-500 mb-2">Purchase: ₹{Number(product.purchasePrice).toFixed(2)}</p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-600">₹{product.price.toFixed(2)}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        product.stock > 2 ? 'bg-green-300' :
                        product.stock > 0 ? 'bg-yellow-300' : 'bg-red-300'
                      } text-black`}
                    >
                      Stock: {product.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart card */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Cart ({cart.length})</h2>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 truncate">{item.name}</h4>
                    <p className="text-xs text-gray-600">
                      {item.brand} {item.size && `- Size: ${item.size}`} {item.nonInventory && '• (No Inventory)'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium">₹{item.price.toFixed(2)}</span>
                      {item.discount > 0 && (
                        <span className="text-xs text-green-600">
                          -{item.discountType === 'percentage' ? `${item.discount}%` : `₹${item.discount}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-blue-600">Line Total: ₹{calculateItemTotal(item).toFixed(2)}</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartQuantity(item.id, -1)}
                        className="w-6 h-6 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.id, 1)}
                        className="w-6 h-6 bg-green-100 text-green-600 rounded hover:bg-green-200 flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedItemForDiscount(item);
                          setDiscountValue(item.discount.toString());
                          setDiscountType(item.discountType);
                          setShowDiscountModal(true);
                        }}
                        className="w-20 h-10 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 flex items-center justify-center"
                        title="Add Discount"
                      >
                        Discount
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-10 h-10 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {cart.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Cart is empty</p>
              </div>
            )}

            {cart.length > 0 && (
              <>
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm"><span>Subtotal:</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Total Discount:</span><span>-₹{totals.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm"><span>After Discount:</span><span>₹{totals.afterDiscount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-gray-600"><span>CGST ({(totals.taxRate/2).toFixed(2)}%)</span><span>₹{totals.cgst.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-gray-600"><span>SGST ({(totals.taxRate/2).toFixed(2)}%)</span><span>₹{totals.sgst.toFixed(2)}</span></div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span>₹{totals.total.toFixed(2)}</span></div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => setShowPayment(true)}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" /> Proceed to Payment
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Payment
        open={showPayment}
        onClose={() => setShowPayment(false)}
        totals={totals}
        cart={cart}
        onConfirm={(payload) => processSale(payload)}
      />
      {/* Direct Bill Modal */}
      {showDirectBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Direct Bill Item</h2>
                  <p className="text-xs text-gray-600">Create on-the-fly item for billing</p>
                </div>
              </div>
              <button onClick={() => { resetDirectBillForm(); setShowDirectBill(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={directBillForm.name}
                  onChange={(e) => setDirectBillForm({ ...directBillForm, name: e.target.value })}
                  placeholder="e.g., Custom Leather Shoes"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <input
                    list="db_brands"
                    value={directBillForm.brand}
                    onChange={(e) => setDirectBillForm({ ...directBillForm, brand: e.target.value })}
                    placeholder="Brand name"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="db_brands">
                    {brandOptions.map((b) => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <input
                    list="db_sizes"
                    value={directBillForm.size}
                    onChange={(e) => setDirectBillForm({ ...directBillForm, size: e.target.value })}
                    placeholder="Size"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="db_sizes">
                    {sizeOptions.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    list="db_categories"
                    value={directBillForm.category}
                    onChange={(e) => setDirectBillForm({ ...directBillForm, category: e.target.value })}
                    placeholder="Direct Bill"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="db_categories">
                    {categoryOptions.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode (Auto)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={directBillForm.barcode}
                      readOnly
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 font-mono text-sm"
                      placeholder="AUTO: NAME_BRAND"
                    />
                    <button
                      type="button"
                      title="Regenerate"
                      onClick={() => {
                        const base = makeBaseBarcode(directBillForm.name, directBillForm.brand);
                        setDirectBillForm((prev) => ({ ...prev, barcode: uniqueBarcode(base) }));
                      }}
                      className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Generated as <code className="font-mono">NAME_BRAND</code>. Duplicates get <code className="font-mono">_01</code>, <code className="font-mono">_02</code> …
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={directBillForm.price}
                    onChange={(e) => setDirectBillForm({ ...directBillForm, price: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number" min="1"
                    value={directBillForm.quantity}
                    onChange={(e) => setDirectBillForm({ ...directBillForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDirectBillWithoutInventory}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Bill Without Inventory
                </button>
                <button
                  type="button"
                  onClick={handleDirectBillAddAndContinue}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Add & Continue
                </button>
                <button
                  type="button"
                  onClick={() => { resetDirectBillForm(); setShowDirectBill(false); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && selectedItemForDiscount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Add Discount</h2>
              <button onClick={() => setShowDiscountModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Product: {selectedItemForDiscount.name}</p>
                <p className="text-sm text-gray-600">
                  Original Price: ₹{selectedItemForDiscount.price.toFixed(2)} × {selectedItemForDiscount.quantity}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="amount">Fixed Amount (₹)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Value {discountType === 'percentage' ? '(%)' : '(₹)'}
                </label>
                <input
                  type="number" step="0.01" min="0"
                  max={
                    discountType === 'percentage'
                      ? '100'
                      : (selectedItemForDiscount.price * selectedItemForDiscount.quantity).toString()
                  }
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={discountType === 'percentage' ? '10' : '100'}
                />
              </div>
              {discountValue && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Final Line Total: ₹
                    {(() => {
                      const base = selectedItemForDiscount.price * selectedItemForDiscount.quantity;
                      const d = parseFloat(discountValue) || 0;
                      if (discountType === 'percentage') {
                        const pct = Math.min(100, Math.max(0, d));
                        return (base - (base * pct) / 100).toFixed(2);
                      }
                      return Math.max(0, base - d).toFixed(2);
                    })()}
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDiscountModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={applyDiscount}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply Discount
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Returns Modal */}
      {showReturns && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Process Returns</h2>
              <button onClick={() => { setShowReturns(false); setSelectedSaleForReturn(null); setReturnItems([]); setReturnReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!selectedSaleForReturn ? (
                <div>
                  <h3 className="text-lg font-medium mb-4">Select Sale to Return</h3>
                  <div className="relative mb-4">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={returnInvoiceSearch}
                      onChange={(e) => setReturnInvoiceSearch(e.target.value)}
                      placeholder="Search by Invoice / Bill No (e.g., INV123...)"
                      className="w-full pl-9 pr-3 py-2 border rounded-lg"
                    />
                  </div>
                  {(() => {
                    const q = returnInvoiceSearch.trim().toLowerCase();
                    const saleSource = q ? allSales.filter(s => String(s.id || '').toLowerCase().includes(q)) : allSales.slice(0, 50);
                    return (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {saleSource.length === 0 && <div className="text-center text-gray-500 py-6">No invoices found</div>}
                        {saleSource.map((sale) => (
                          <div
                            key={sale.id}
                            onClick={() => selectSaleForReturn(sale)}
                            className="p-4 border border-gray-200 rounded-lg hover:bg-red-50 hover:shadow-md transition-all cursor-pointer"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium">Sale #{sale.id}</p>
                                <p className="text-sm text-gray-600">{new Date(sale.timestamp).toLocaleString('en-IN')}</p>
                                <p className="text-sm text-gray-600">Cashier: {sale.cashier}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">₹{sale.total.toFixed(2)}</p>
                                <p className="text-sm text-gray-600">{sale.items.length} items</p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              Items: {sale.items.map((it) => `${it.name} (${it.quantity})`).join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Return Items from Sale #{selectedSaleForReturn.id}</h3>
                      <button onClick={() => { setSelectedSaleForReturn(null); setReturnItems([]); }} className="text-blue-600 hover:text-blue-800">← Back to Sales</button>
                    </div>
                    <p className="text-sm text-gray-600">Sale Date: {new Date(selectedSaleForReturn.timestamp).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="space-y-4 mb-6">
                    {returnItems.map((it) => (
                      <div key={it.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">{it.name}</h4>
                            <p className="text-sm text-gray-600">{it.brand} {it.size && `- Size: ${it.size}`}</p>
                            <p className="text-sm text-gray-600">Original: {it.quantity} × ₹{it.finalPrice.toFixed(2)} = ₹{(it.finalPrice * it.quantity).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Return Qty:</label>
                            <input
                              type="number" min="0" max={it.maxReturnQuantity}
                              value={it.returnQuantity}
                              onChange={(e) => updateReturnQuantity(it.id, parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-500">/ {it.maxReturnQuantity}</span>
                          </div>
                        </div>
                        {it.returnQuantity > 0 && (
                          <div className="text-sm text-orange-600 font-medium">Refund: ₹{(it.finalPrice * it.returnQuantity).toFixed(2)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Return Reason *</label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select reason</option>
                      <option value="Defective Product">Defective Product</option>
                      <option value="Wrong Size">Wrong Size</option>
                      <option value="Customer Changed Mind">Customer Changed Mind</option>
                      <option value="Damaged in Transit">Damaged in Transit</option>
                      <option value="Not as Described">Not as Described</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {returnItems.some((it) => it.returnQuantity > 0) && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                      <h4 className="font-medium text-orange-800 mb-2">Return Summary</h4>
                      <p className="text-orange-700">
                        Total Refund: ₹{returnItems.reduce((s, it) => s + it.finalPrice * it.returnQuantity, 0).toFixed(2)}
                      </p>
                      <p className="text-sm text-orange-600 mt-1">Items will be added back to inventory and removed from the original sale.</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowReturns(false); setSelectedSaleForReturn(null); setReturnItems([]); setReturnReason(''); }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={processReturn}
                      disabled={!returnItems.some((it) => it.returnQuantity > 0) || !returnReason}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      <Printer className="w-4 h-4" /> Process Return
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dues Modal */}
      {showDues && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Unpaid Dues</h2>
              <button onClick={() => setShowDues(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={dueInvoiceSearch}
                  onChange={(e) => setDueInvoiceSearch(e.target.value)}
                  placeholder="Search by Customer Name"
                  className="w-full pl-9 pr-3 py-2 border rounded-lg"
                />
              </div>

              {(() => {
                const q = dueInvoiceSearch.trim().toLowerCase();
                const visible = q ? dues.filter(d => String(d.customerName || '').toLowerCase().includes(q)) : dues;

                if (visible.length === 0) {
                  return <div className="text-center text-gray-500 py-8">No unpaid dues {q ? 'for that customer' : ''} 🎉</div>;
                }

                return visible.map((due) => (
                  <div key={due.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{due.customerName}</p>
                        <p className="text-sm text-gray-600">Sale: {due.saleId}</p>
                        <p className="text-xs text-gray-500">Created: {new Date(due.createdAt).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Total: <span className="font-semibold">₹{due.total.toFixed(2)}</span></p>
                        <p className="text-sm">Upfront: ₹{(due.upfrontPaid || 0).toFixed(2)} {due.upfrontTender ? `(${due.upfrontTender.toUpperCase()})` : ''}</p>
                        <p className="text-lg font-bold text-red-600">Balance Due: ₹{due.balance.toFixed(2)}</p>
                      </div>
                    </div>

                    {due.payments?.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        Collections{' '}
                        {due.payments.map(p =>
                          `₹${p.amount.toFixed(2)} ${p.mode ? `(${p.mode.toUpperCase()})` : ''} on ${new Date(p.timestamp).toLocaleDateString('en-IN')}`
                        ).join(', ')}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount to collect (₹)</label>
                        <p className="text-xs text-gray-700 mt-1">*Max: ₹{due.balance.toFixed(2)}</p>
                        <input
                          type="number" min="0.01" step="0.01" max={due.balance}
                          value={collectionInputs[due.id] ?? ''}
                          onChange={(e) => setCollectionInputs((prev) => ({ ...prev, [due.id]: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                          placeholder={due.balance.toFixed(2)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Collection Mode</label>
                        <select
                          value={collectionModes[due.id] ?? 'cash'}
                          onChange={(e) => setCollectionModes((prev) => ({ ...prev, [due.id]: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                        </select>
                      </div>
                      <div className="flex gap-3 md:col-span-1">
                        <button
                          onClick={() => { const val = collectionInputs[due.id]; const mode = collectionModes[due.id] ?? 'cash'; collectDue(due, val, mode); }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Collect
                        </button>
                        <button
                          onClick={() => settleDue(due)}
                          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                        >
                          Settle Full
                        </button>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Opening Cash Drawer Modal */}
      {showDrawerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Opening Cash (Today)</h2>
              <button onClick={() => setShowDrawerModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Please enter the cash amount present in the drawer at start of day.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Cash (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., 2000"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setOpeningCashInput('0'); submitOpeningCash(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Start with ₹0
                </button>
                <button
                  onClick={submitOpeningCash}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Record Expense (Cash)</h2>
              <button onClick={() => setShowExpenseModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., 250.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., Packing material"
                />
              </div>
              <div className="mt-4 border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Today's Expenses</h3>
                  <span className="text-sm font-medium">₹{todaysExpenseTotal.toFixed(2)}</span>
                </div>
                {todaysExpenses.length === 0 ? (
                  <div className="text-sm text-gray-500">No expenses recorded today</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto divide-y">
                    {todaysExpenses.map((ex) => (
                      <div key={ex.id} className="py-2 text-sm flex justify-between items-start">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">₹{Number(ex.amount).toFixed(2)}</div>
                          <div className="text-gray-600 truncate">{ex.reason || '-'}</div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <div>{new Date(ex.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div>{ex.cashier || ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitExpense}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Save Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default POS;
