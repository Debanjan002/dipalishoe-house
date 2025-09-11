import React, { useState, useEffect } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';

import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Printer,
  X,
  ListChecks
} from 'lucide-react';

const POS = () => {
  const { products, updateStock } = useInventory();
  const { shopSettings } = useSettings();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [showDirectBill, setShowDirectBill] = useState(false);
  const [showReturns, setShowReturns] = useState(false);

  // Dues modal
  const [showDues, setShowDues] = useState(false);

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedItemForDiscount, setSelectedItemForDiscount] = useState(null);
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');

  // Two-step payment: first type (PAID or DUE), then mode (cash or upi)
  const [payType, setPayType] = useState('PAID'); // 'PAID' | 'DUE'
  const [payMode, setPayMode] = useState('cash'); // 'cash' | 'upi'
  const [amountPaid, setAmountPaid] = useState('');

  // DUE -> customer name
  const [customerName, setCustomerName] = useState('');

  const [recentSales, setRecentSales] = useState([]);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');

  // dues in state for modal
  const [dues, setDues] = useState([]);

  // NEW: total due outstanding (till now)
  const [outstandingDueTotal, setOutstandingDueTotal] = useState(0);

  // per-due collection inputs & modes
  const [collectionInputs, setCollectionInputs] = useState({});
  const [collectionModes, setCollectionModes] = useState({}); // { [dueId]: 'cash' | 'upi' }

  const [directBillForm, setDirectBillForm] = useState({
    name: '',
    price: '',
    quantity: 1,
    brand: '',
    size: ''
  });

  // Stats (unchanged logic)
  const [todayStats, setTodayStats] = useState({
    sales: 0,
    returns: 0,
    netSales: 0,
    monthlySales: 0,
    dueToday: 0,
    dueCollectionsToday: 0,
    todayTotal: 0
  });

  // Drawer (cash in drawer only)
  const [drawer, setDrawer] = useState({ date: '', opening: 0, current: 0 });
  const [showDrawerModal, setShowDrawerModal] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('');

  // Daily tender totals
  const [dailyTenders, setDailyTenders] = useState({ date: '', cash: 0, upi: 0 });

  const todayStr = () => new Date().toISOString().slice(0, 10);

  // ===== Drawer helpers =====
  const saveDrawer = (d) => {
    setDrawer(d);
    localStorage.setItem('pos_drawer', JSON.stringify(d));
  };

  const loadDrawer = () => {
    const stored = JSON.parse(localStorage.getItem('pos_drawer') || 'null');
    if (!stored || stored.date !== todayStr()) {
      setShowDrawerModal(true);
    } else {
      setDrawer(stored);
    }
  };

  const updateDrawer = (delta) => {
    const base = JSON.parse(localStorage.getItem('pos_drawer') || 'null');
    const snapshot =
      base && base.date === todayStr() ? base : { date: todayStr(), opening: 0, current: 0 };
    const next = { ...snapshot, current: parseFloat((snapshot.current + delta).toFixed(2)) };
    saveDrawer(next);
  };

  const submitOpeningCash = () => {
    const amt = parseFloat(openingCashInput);
    if (isNaN(amt) || amt < 0) {
      alert('Please enter a valid non-negative amount.');
      return;
    }
    const init = { date: todayStr(), opening: amt, current: amt };
    saveDrawer(init);
    setShowDrawerModal(false);
  };

  // ===== Daily tender helpers =====
  const saveDailyTenders = (t) => {
    setDailyTenders(t);
    localStorage.setItem('pos_daily_tenders', JSON.stringify(t));
  };

  const loadDailyTenders = () => {
    const stored = JSON.parse(localStorage.getItem('pos_daily_tenders') || 'null');
    if (!stored || stored.date !== todayStr()) {
      saveDailyTenders({ date: todayStr(), cash: 0, upi: 0 });
    } else {
      setDailyTenders(stored);
    }
  };

  const bumpCashTotal = (delta) => {
    const base = JSON.parse(localStorage.getItem('pos_daily_tenders') || 'null') || {
      date: todayStr(),
      cash: 0,
      upi: 0
    };
    const snap = base.date === todayStr() ? base : { date: todayStr(), cash: 0, upi: 0 };
    const next = { ...snap, cash: parseFloat((snap.cash + delta).toFixed(2)) };
    saveDailyTenders(next);
  };

  const bumpUPITotal = (delta) => {
    const base = JSON.parse(localStorage.getItem('pos_daily_tenders') || 'null') || {
      date: todayStr(),
      cash: 0,
      upi: 0
    };
    const snap = base.date === todayStr() ? base : { date: todayStr(), cash: 0, upi: 0 };
    const next = { ...snap, upi: parseFloat((snap.upi + delta).toFixed(2)) };
    saveDailyTenders(next);
  };

  // ===== Mount =====
  useEffect(() => {
    loadDrawer();
    loadDailyTenders();
    loadRecentSales();
    loadDues();
    calculateTodayStats();
  }, []);

  // NEW: all sales for invoice searching
  const [allSales, setAllSales] = useState([]);
  const [returnInvoiceSearch, setReturnInvoiceSearch] = useState('');
  const [dueInvoiceSearch, setDueInvoiceSearch] = useState('');

  const loadRecentSales = () => {
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const sortedSales = sales.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setAllSales(sortedSales);                 // full list for searching
    setRecentSales(sortedSales.slice(0, 20)); // keep quick recent list (if needed elsewhere)
  };

  const computeOutstandingDue = (list) => {
    // Sum current balances; fallback computes from components if balance missing.
    return list.reduce((sum, d) => {
      if (typeof d.balance === 'number') return sum + d.balance;
      const paidParts = (d.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
      const upfront = d.upfrontPaid || 0;
      const total = d.total || 0;
      const bal = Math.max(0, total - upfront - paidParts);
      return sum + bal;
    }, 0);
  };

  const loadDues = () => {
    const stored = JSON.parse(localStorage.getItem('pos_dues') || '[]');
    const list = stored
      .filter((d) => !d.settled)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setDues(list);

    // NEW: set outstanding total
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

    const today = new Date().toDateString();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const todaySales = sales
      .filter((sale) => new Date(sale.timestamp).toDateString() === today)
      .reduce((sum, sale) => sum + sale.total, 0);

    const todayReturns = returns
      .filter((returnItem) => new Date(returnItem.timestamp).toDateString() === today)
      .reduce((sum, returnItem) => sum + returnItem.totalRefund, 0);

    const monthlySales = sales
      .filter((sale) => {
        const saleDate = new Date(sale.timestamp);
        return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
      })
      .reduce((sum, sale) => sum + sale.total, 0);

    const monthlyReturns = returns
      .filter((returnItem) => {
        const returnDate = new Date(returnItem.timestamp);
        return returnDate.getMonth() === currentMonth && returnDate.getFullYear() === currentYear;
      })
      .reduce((sum, returnItem) => sum + returnItem.totalRefund, 0);

    // dues created today (unpaid portion for sales made today with DUE)
    const dueToday = sales
      .filter(
        (sale) =>
          new Date(sale.timestamp).toDateString() === today && sale.paymentMethod === 'DUE'
      )
      .reduce((sum, sale) => sum + Math.max(0, sale.total - (sale.amountPaid || 0)), 0);

    // dues collected today
    const dueCollectionsToday = duePayments
      .filter((p) => new Date(p.timestamp).toDateString() === today)
      .reduce((sum, p) => sum + p.amount, 0);

    const todayTotal = todaySales;

    setTodayStats({
      sales: todaySales,
      returns: todayReturns,
      netSales: todaySales,
      monthlySales: monthlySales - monthlyReturns,
      dueToday,
      dueCollectionsToday,
      todayTotal
    });
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode.includes(searchTerm) ||
      (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToCart = (product) => {
    const existingItem = cart.find((item) => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(
          cart.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          )
        );
      } else {
        alert('Insufficient stock!');
      }
    } else {
      if (product.stock > 0) {
        setCart([...cart, { ...product, quantity: 1, discount: 0, discountType: 'amount' }]);
      } else {
        alert('Product out of stock!');
      }
    }
  };

  const updateCartQuantity = (id, change) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === id) {
            const newQuantity = item.quantity + change;
            if (newQuantity <= 0) {
              return null;
            }
            const product = products.find((p) => p.id === id);
            if (product && newQuantity > product.stock) {
              alert('Insufficient stock!');
              return item;
            }
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleDirectBillSubmit = (e) => {
    e.preventDefault();
    const directItem = {
      id: `direct_${Date.now()}`,
      name: directBillForm.name,
      price: parseFloat(directBillForm.price),
      quantity: parseInt(directBillForm.quantity),
      brand: directBillForm.brand,
      size: directBillForm.size,
      category: 'Direct Bill',
      stock: 999,
      discount: 0,
      discountType: 'amount'
    };

    setCart([...cart, directItem]);
    setDirectBillForm({ name: '', price: '', quantity: 1, brand: '', size: '' });
    setShowDirectBill(false);
  };

  const applyDiscount = () => {
    if (!selectedItemForDiscount || !discountValue) return;

    setCart(
      cart.map((item) => {
        if (item.id === selectedItemForDiscount.id) {
          return {
            ...item,
            discount: parseFloat(discountValue),
            discountType: discountType
          };
        }
        return item;
      })
    );

    setShowDiscountModal(false);
    setSelectedItemForDiscount(null);
    setDiscountValue('');
  };

  const calculateItemTotal = (item) => {
    const baseTotal = item.price * item.quantity;
    if (item.discount > 0) {
      if (item.discountType === 'percentage') {
        return baseTotal - (baseTotal * item.discount) / 100;
      } else {
        return Math.max(0, baseTotal - item.discount);
      }
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
    const tax = afterDiscount * (shopSettings.taxRate / 100);
    const total = afterDiscount + tax;

    return {
      subtotal,
      totalDiscount,
      afterDiscount,
      tax,
      total,
      cgst: tax / 2,
      sgst: tax / 2
    };
  };

  // record due payment (collections)
  const recordDueCollection = (dueId, amount, mode) => {
    const payments = JSON.parse(localStorage.getItem('pos_due_payments') || '[]');
    payments.push({
      id: `COL${Date.now()}`,
      dueId,
      amount,
      mode, // 'cash' | 'upi'
      timestamp: new Date().toISOString(),
      cashier: user.name
    });
    localStorage.setItem('pos_due_payments', JSON.stringify(payments));
  };

  const processSale = () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    const totals = calculateTotals();

    // Defaults for amountPaid based on type
    const defaultPaid = payType === 'PAID' ? totals.total : 0;
    const paidAmount = parseFloat(amountPaid) || defaultPaid;

    if (payType === 'PAID') {
      if (paidAmount < totals.total) {
        alert('Insufficient payment amount for PAID!');
        return;
      }
      if (!['cash', 'upi'].includes(payMode)) {
        alert('Select payment mode (Cash or UPI).');
        return;
      }
    }

    if (payType === 'DUE') {
      if (!customerName.trim()) {
        alert('Please enter customer name for DUE.');
        return;
      }
      if (paidAmount < 0 || isNaN(paidAmount)) {
        alert('Enter a valid upfront amount (or leave blank for 0).');
        return;
      }
      if (!['cash', 'upi'].includes(payMode)) {
        alert('Select upfront payment mode (Cash or UPI).');
        return;
      }
      if (paidAmount > totals.total) {
        alert('Upfront cannot exceed total.');
        return;
      }
    }

    // Build sale object
    const salePaymentMethod = payType === 'PAID' ? payMode : 'DUE';

    const sale = {
      id: `INV${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: cart.map((item) => ({
        ...item,
        finalPrice: calculateItemTotal(item) / item.quantity
      })),
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      afterDiscount: totals.afterDiscount,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total,
      paymentMethod: salePaymentMethod,
      amountPaid: Math.min(paidAmount, totals.total),
      change: Math.max(0, paidAmount - totals.total),
      cashier: user.name,
      customerName: payType === 'DUE' ? customerName.trim() : undefined
    };

    // Update stock
    cart.forEach((item) => {
      if (!item.id.startsWith('direct_')) {
        const product = products.find((p) => p.id === item.id);
        if (product) {
          updateStock(item.id, product.stock - item.quantity);
        }
      }
    });

    // Save sale
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    sales.push(sale);
    localStorage.setItem('pos_sales', JSON.stringify(sales));

    // Create/Update due if needed
    if (payType === 'DUE') {
      const remaining = Math.max(0, totals.total - sale.amountPaid);
      if (remaining > 0) {
        const allDues = JSON.parse(localStorage.getItem('pos_dues') || '[]');
        const due = {
          id: `DUE${Date.now()}`,
          saleId: sale.id,
          customerName: customerName.trim(),
          total: totals.total,
          upfrontPaid: sale.amountPaid,
          upfrontTender: payMode, // 'cash' | 'upi'
          balance: remaining,
          createdAt: sale.timestamp,
          settled: false,
          payments: []
        };
        allDues.push(due);
        localStorage.setItem('pos_dues', JSON.stringify(allDues));
      }
    }

    // Drawer & Tender updates
    if (payType === 'PAID') {
      if (payMode === 'cash') {
        updateDrawer(totals.total); // full amount enters drawer
        bumpCashTotal(totals.total);
      } else {
        bumpUPITotal(totals.total);
      }
    } else if (payType === 'DUE') {
      const upfront = sale.amountPaid;
      if (upfront > 0) {
        if (payMode === 'cash') {
          updateDrawer(upfront);
          bumpCashTotal(upfront);
        } else {
          bumpUPITotal(upfront);
        }
      }
    }

    // Print receipt (unchanged)
    printSaleReceipt(sale);

    // Reset & reload
    setCart([]);
    setAmountPaid('');
    setCustomerName('');
    setPayMode('cash');
    setPayType('PAID');
    loadRecentSales();
    loadDues();            // updates outstandingDueTotal as well
    calculateTodayStats();
    loadDailyTenders();

    alert('Sale completed successfully!');
  };

  // ======= RECEIPT: kept exactly as your original HTML/CSS =======
  const printSaleReceipt = (sale) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');

    const receiptHTML = `
      <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>SALE RECEIPT</title>
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
  </style>
</head>
<body class="bottom-space">
<div class="center">
  <div class="header">${shopSettings.name}</div>
  <div class="sub">${shopSettings.address}</div>
  <div class="sub">Ph: ${shopSettings.phone}</div>
  <div class="sub">Email: ${shopSettings.email}</div>
  ${shopSettings.gstNumber ? `<div class="sub">RETURN POLICY: ${shopSettings.gstNumber}</div>` : ''}
  <div class="rule"></div>
  <div>SALE RECEIPT</div>
</div>

<div class="sub">
  <div>Bill No: ${sale.id}</div>
  <div>Date: ${new Date(sale.timestamp).toLocaleString('en-IN')}</div>
  <div>Cashier: ${sale.cashier}</div>
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
    ${sale.items
      .map(
        (item) => `
      <tr class="no-break">
        <td class="left  col-item sub nowrap">${item.name}${item.size ? ` (${item.size})` : ''}</td>
        <td class="center col-qty sub mono nowrap">${item.quantity}</td>
        <td class="right col-rate sub mono nowrap">₹${item.price.toFixed(2)}</td>
        <td class="right col-amt  sub mono nowrap">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
      ${
        item.discount > 0
          ? `
        <tr class="no-break">
          <td colspan="3" class="left sub nowrap">Discount (${
            item.discountType === 'percentage' ? item.discount + '%' : '₹' + item.discount
          })</td>
          <td class="right sub mono nowrap">-₹${(
            item.price * item.quantity -
            item.finalPrice * item.quantity
          ).toFixed(2)}</td>
        </tr>`
          : ''
      }
    `
      )
      .join('')}
  </tbody>
</table>

<div class="rule"></div>

<table>
  <tr><td class="left sub">Subtotal</td><td class="right sub mono">₹${sale.subtotal.toFixed(2)}</td></tr>
  ${
    sale.totalDiscount > 0
      ? `<tr><td class="left sub">Total Discount</td><td class="right sub mono">-₹${sale.totalDiscount.toFixed(
          2
        )}</td></tr>`
      : ''
  }
  <tr><td class="left sub">After Discount</td><td class="right sub mono">₹${sale.afterDiscount.toFixed(
    2
  )}</td></tr>
  <tr><td class="left sub">CGST (${shopSettings.taxRate / 2}%)</td><td class="right sub mono">₹${sale.cgst.toFixed(
    2
  )}</td></tr>
  <tr><td class="left sub">SGST (${shopSettings.taxRate / 2}%)</td><td class="right sub mono">₹${sale.sgst.toFixed(
    2
  )}</td></tr>
  <tr class="rule-thick"></tr>
  <tr class="emph-row"><td class="left key-label">Total</td><td class="right mono">₹${sale.total.toFixed(
    2
  )}</td></tr>
  <tr class="emph-row"><td class="left">Paid (${sale.paymentMethod})</td><td class="right mono">₹${sale.amountPaid.toFixed(
    2
  )}</td></tr>
  <tr class="emph-row"><td class="left">${
    sale.paymentMethod === 'DUE' ? 'Balance' : 'Change'
  }</td><td class="right mono">₹${
      sale.paymentMethod === 'DUE'
        ? Math.max(0, sale.total - sale.amountPaid).toFixed(2)
        : sale.change.toFixed(2)
    }</td></tr>
</table>

<div class="rule"></div>
<div class="center">
  <img src="${shopSettings.logo}" alt="Shop Logo" style="max-width: 40mm; height: auto; display: block; margin: 0 auto 5px auto; border-radius: 3px;" />
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
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const processReturn = () => {
    if (returnItems.length === 0) {
      alert('No items selected for return!');
      return;
    }

    if (!returnReason) {
      alert('Please select a return reason!');
      return;
    }

    const totalRefund = returnItems.reduce(
      (sum, item) => sum + item.finalPrice * item.returnQuantity,
      0
    );

    const returnTransaction = {
      id: `RET${Date.now()}`,
      timestamp: new Date().toISOString(),
      originalSaleId: selectedSaleForReturn.id,
      items: returnItems,
      totalRefund,
      reason: returnReason,
      processedBy: user.name
    };

    // Update original sale
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const updatedSales = sales.map((sale) => {
      if (sale.id === selectedSaleForReturn.id) {
        const updatedItems = sale.items
          .map((saleItem) => {
            const ri = returnItems.find((r) => r.id === saleItem.id);
            if (ri) {
              const remaining = saleItem.quantity - ri.returnQuantity;
              return remaining > 0 ? { ...saleItem, quantity: remaining } : null;
            }
            return saleItem;
          })
          .filter(Boolean);

        const newSubtotal = updatedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const newTotalDiscount = updatedItems.reduce((sum, item) => {
          const baseTotal = item.price * item.quantity;
          const itemTotal = item.finalPrice * item.quantity;
          return sum + (baseTotal - itemTotal);
        }, 0);
        const newAfterDiscount = newSubtotal - newTotalDiscount;
        const newTax = newAfterDiscount * (shopSettings.taxRate / 100);
        const newTotal = newAfterDiscount + newTax;

        return {
          ...sale,
          items: updatedItems,
          subtotal: newSubtotal,
          totalDiscount: newTotalDiscount,
          afterDiscount: newAfterDiscount,
          tax: newTax,
          cgst: newTax / 2,
          sgst: newTax / 2,
          total: newTotal
        };
      }
      return sale;
    });

    localStorage.setItem('pos_sales', JSON.stringify(updatedSales));

    // Save return
    const returns = JSON.parse(localStorage.getItem('pos_returns') || '[]');
    returns.push(returnTransaction);
    localStorage.setItem('pos_returns', JSON.stringify(returns));

    // Update stock
    returnItems.forEach((item) => {
      if (!item.id.startsWith('direct_')) {
        const product = products.find((p) => p.id === item.id);
        if (product) {
          updateStock(item.id, product.stock + item.returnQuantity);
        }
      }
    });

    // Assume refund is paid in CASH -> deduct drawer and cash-total
    updateDrawer(-totalRefund);
    bumpCashTotal(-totalRefund);

    printReturnReceipt(returnTransaction);

    // Reset
    setShowReturns(false);
    setSelectedSaleForReturn(null);
    setReturnItems([]);
    setReturnReason('');
    loadRecentSales();
    calculateTodayStats();
    loadDailyTenders();

    alert(`Return processed successfully! Refund amount: ₹${totalRefund.toFixed(2)}`);
  };

  // ======= RETURN RECEIPT: kept exactly as your original =======
  const printReturnReceipt = (returnTransaction) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');

    const receiptHTML = `
      <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Return Receipt</title>
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
    .center { text-align: center; } .left { text-align: left; } .right { text-align: right; } .mono { font-variant-numeric: tabular-nums; } .bold { font-weight: 700; }
    .header { font-size: 13px; letter-spacing: 0.2px; padding: 2px 0; text-transform: uppercase; font-weight: 700; color: black; border-radius: 3px; margin-bottom: 4px; }
    .sub { font-size: 9px; letter-spacing: 0.2px; }
    .rule { border-bottom: 1px dashed #000; margin: 4px 0; }
    .rule-thick { border-bottom: 2px solid #000; margin: 6px 0; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { padding: 1px 0; vertical-align: top; }
    th { font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .col-item { width: 48%; } .col-qty { width: 15%; text-align: center; } .col-rate { width: 18%; text-align: right; } .col-refund { width: 19%; text-align: right; }
    .emph-row td { font-size: 12px; font-weight: 700; } 
    .return-text { color: #000000ff; font-weight: 700; }
    .footer { font-size: 9px; margin-top: 6px; text-align: center; }
  </style>
</head>
<body class="bottom-space">
  <div class="center">
    <div class="header">${shopSettings.name}</div>
    <div class="sub">${shopSettings.address}</div>
    <div class="sub">Ph: ${shopSettings.phone}</div>
    <div class="sub">Email: ${shopSettings.email}</div>
    ${shopSettings.gstNumber ? `<div class="sub">GSTIN: ${shopSettings.gstNumber}</div>` : ''}
    <div class="rule"></div>
    <div class="return-text bold">RETURN RECEIPT</div>
  </div>

  <div class="sub">
    <div>Return No: ${returnTransaction.id}</div>
    <div>Original Sale: ${returnTransaction.originalSaleId}</div>
    <div>Date: ${new Date(returnTransaction.timestamp).toLocaleString('en-IN')}</div>
    <div>Processed by: ${returnTransaction.processedBy}</div>
    <div>Reason: ${returnTransaction.reason}</div>
  </div>
  <div class="rule"></div>

  <table>
    <thead>
      <tr>
        <th class="col-item left">Item</th>
        <th class="col-qty center">Qty</th>
        <th class="col-rate right">Rate</th>
        <th class="col-refund right">Refund</th>
      </tr>
    </thead>
    <tbody>
      ${returnTransaction.items
        .map(
          (item) => `
        <tr class="no-break">
          <td class="left sub nowrap">${item.name}${item.size ? ` (${item.size})` : ''}</td>
          <td class="center sub mono nowrap">${item.returnQuantity}</td>
          <td class="right sub mono nowrap">₹${item.finalPrice.toFixed(2)}</td>
          <td class="right sub mono nowrap">₹${(item.finalPrice * item.returnQuantity).toFixed(2)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="rule"></div>

  <table>
    <tr class="emph-row">
      <td class="left return-text">Total Refund:</td>
      <td class="right mono return-text">₹${returnTransaction.totalRefund.toFixed(2)}</td>
    </tr>
  </table>

  <div class="rule"></div>

  <div class="center footer">
    <div>Return processed successfully</div>
    <div>Thank you for your understanding</div>
    <div class="sub">Powered by Dipali shoe house</div>
    <h1>卐</h1>
    <h1>ॐ</h1>
  </div>
</body>
</html>`;
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const selectSaleForReturn = (sale) => {
    setSelectedSaleForReturn(sale);
    setReturnItems(
      sale.items.map((item) => ({
        ...item,
        returnQuantity: 0,
        maxReturnQuantity: item.quantity
      }))
    );
  };

  const updateReturnQuantity = (itemId, quantity) => {
    setReturnItems(
      returnItems.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            returnQuantity: Math.max(0, Math.min(quantity, item.maxReturnQuantity))
          };
        }
        return item;
      })
    );
  };

  // collect due with mode
  const collectDue = (due, amount, mode) => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      alert('Invalid amount entered!');
      return;
    }
    if (amt > due.balance) {
      alert('Amount cannot exceed remaining balance!');
      return;
    }
    if (!['cash', 'upi'].includes(mode)) {
      alert('Select a valid collection mode.');
      return;
    }

    // update due
    const all = JSON.parse(localStorage.getItem('pos_dues') || '[]');
    const updated = all.map((d) => {
      if (d.id === due.id) {
        const payment = {
          id: `PAY${Date.now()}`,
          amount: amt,
          mode, // 'cash' | 'upi'
          timestamp: new Date().toISOString(),
          cashier: user.name
        };
        const newPayments = [...(d.payments || []), payment];
        const newBalance = (d.balance || 0) - amt;
        return {
          ...d,
          payments: newPayments,
          balance: newBalance,
          settled: newBalance <= 0,
          settledAt: newBalance <= 0 ? payment.timestamp : d.settledAt
        };
      }
      return d;
    });
    localStorage.setItem('pos_dues', JSON.stringify(updated));

    // record collection (for stats)
    recordDueCollection(due.id, amt, mode);

    // Tender & drawer updates
    if (mode === 'cash') {
      updateDrawer(amt);
      bumpCashTotal(amt);
    } else {
      bumpUPITotal(amt);
    }

    loadDues();
    calculateTodayStats();
    loadDailyTenders();
    alert(`Collected ₹${amt.toFixed(2)} (${mode.toUpperCase()}) from ${due.customerName}`);
  };

  const settleDue = (due) => {
    if (!window.confirm(`Mark ₹${due.balance.toFixed(2)} as PAID for ${due.customerName}?`)) return;
    const mode = prompt('Enter collection mode: cash or upi', 'cash');
    if (!mode) return;
    collectDue(due, due.balance, mode.toLowerCase());
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Drawer cash */}
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

        {/* Tender split */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Today by Tender</p>
              <p className="text-sm">
                Cash: <span className="font-bold">₹{dailyTenders.cash.toFixed(2)}</span>
              </p>
              <p className="text-sm">
                UPI: <span className="font-bold">₹{dailyTenders.upi.toFixed(2)}</span>
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-emerald-200" />
          </div>
        </div>

        {/* NEW: Outstanding Dues (till now) */}
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

      {/* Dues & Returns row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Search and Cart */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search shoes by name, barcode, or brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDirectBill(true)}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Direct Bill
                </button>
                <button
                  onClick={() => setShowReturns(true)}
                  className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  Returns
                </button>
                <button
                  onClick={() => {
                    loadDues();
                    setShowDues(true);
                  }}
                  className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <ListChecks className="w-4 h-4" />
                  Dues
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
                  <p className="text-xs text-gray-600 mb-2">
                    {product.brand} - {product.category}
                  </p>
                  {product.size && (
                    <p className="text-xs text-gray-500 mb-2">Size: {product.size}</p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-600">₹{product.price.toFixed(2)}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        product.stock > 2
                          ? 'bg-green-300 text-black'
                          : product.stock > 0
                          ? 'bg-yellow-300 text-black'
                          : 'bg-red-300 text-black'
                      }`}
                    >
                      Stock: {product.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart and Checkout */}
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
                      {item.brand} {item.size && `- Size: ${item.size}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium">₹{item.price.toFixed(2)}</span>
                      {item.discount > 0 && (
                        <span className="text-xs text-green-600">
                          -
                          {item.discountType === 'percentage'
                            ? `${item.discount}%`
                            : `₹${item.discount}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-blue-600">
                      Total: ₹{calculateItemTotal(item).toFixed(2)}
                    </p>
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
                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Total Discount:</span>
                      <span>-₹{totals.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>After Discount:</span>
                    <span>₹{totals.afterDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>CGST ({shopSettings.taxRate / 2}%):</span>
                    <span>₹{totals.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>SGST ({shopSettings.taxRate / 2}%):</span>
                    <span>₹{totals.sgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>₹{totals.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment (two-step) */}
                <div className="space-y-3 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Type
                      </label>
                      <select
                        value={payType}
                        onChange={(e) => setPayType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="PAID">PAID (Full)</option>
                        <option value="DUE">DUE (Credit)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {payType === 'PAID' ? 'Payment Mode' : 'Upfront Payment Mode'}
                      </label>
                      <select
                        value={payMode}
                        onChange={(e) => setPayMode(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                      </select>
                    </div>
                  </div>

                  {/* Conditional fields for DUE */}
                  {payType === 'DUE' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter customer name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Remaining balance will be recorded as DUE.
                        </p>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {payType === 'PAID'
                        ? `Amount Paid (${payMode.toUpperCase()})`
                        : 'Upfront Amount Received'}
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={payType === 'PAID' ? totals.total.toFixed(2) : '0'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {payType === 'PAID' &&
                      amountPaid &&
                      parseFloat(amountPaid) >= totals.total && (
                        <p className="text-sm text-green-600 mt-1">
                          Change: ₹{(parseFloat(amountPaid) - totals.total).toFixed(2)}
                        </p>
                      )}
                  </div>

                  <button
                    onClick={processSale}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Complete Sale
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Direct Bill Modal */}
      {showDirectBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Direct Bill Item</h2>
              <button
                onClick={() => setShowDirectBill(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDirectBillSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={directBillForm.name}
                  onChange={(e) =>
                    setDirectBillForm({ ...directBillForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Custom Leather Shoes"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={directBillForm.price}
                    onChange={(e) =>
                      setDirectBillForm({ ...directBillForm, price: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={directBillForm.quantity}
                    onChange={(e) =>
                      setDirectBillForm({
                        ...directBillForm,
                        quantity: parseInt(e.target.value) || 1
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={directBillForm.brand}
                    onChange={(e) =>
                      setDirectBillForm({ ...directBillForm, brand: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brand name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Size
                  </label>
                  <input
                    type="text"
                    value={directBillForm.size}
                    onChange={(e) =>
                      setDirectBillForm({ ...directBillForm, size: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Size"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDirectBill(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && selectedItemForDiscount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Add Discount</h2>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Product: {selectedItemForDiscount.name}
                </p>
                <p className="text-sm text-gray-600">
                  Original Price: ₹{selectedItemForDiscount.price.toFixed(2)} ×{' '}
                  {selectedItemForDiscount.quantity}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Type
                </label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  type="number"
                  step="1"
                  min="0"
                  max={
                    discountType === 'percentage'
                      ? '100'
                      : (selectedItemForDiscount.price * selectedItemForDiscount.quantity).toString()
                  }
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={discountType === 'percentage' ? '10' : '100'}
                />
              </div>

              {discountValue && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Final Price: ₹
                    {(() => {
                      const baseTotal =
                        selectedItemForDiscount.price * selectedItemForDiscount.quantity;
                      const discount = parseFloat(discountValue) || 0;
                      if (discountType === 'percentage') {
                        return (baseTotal - (baseTotal * discount) / 100).toFixed(2);
                      } else {
                        return Math.max(0, baseTotal - discount).toFixed(2);
                      }
                    })()}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDiscountModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={applyDiscount}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Process Returns</h2>
              <button
                onClick={() => {
                  setShowReturns(false);
                  setSelectedSaleForReturn(null);
                  setReturnItems([]);
                  setReturnReason('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!selectedSaleForReturn ? (
                <div>
                  <h3 className="text-lg font-medium mb-4">Select Sale to Return</h3>

                  {/* NEW: Invoice search for returns */}
                  <div className="relative mb-4">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={returnInvoiceSearch}
                      onChange={(e) => setReturnInvoiceSearch(e.target.value)}
                      placeholder="Search by Invoice / Bill No (e.g., INV123...)"
                      className="w-full pl-9 pr-3 py-2 border rounded-lg"
                    />
                  </div>

                  {/* NEW: filtered list by invoice */}
                  {(() => {
                    const q = returnInvoiceSearch.trim().toLowerCase();
                    const saleSource = q
                      ? allSales.filter(s => String(s.id || '').toLowerCase().includes(q))
                      : allSales.slice(0, 50);

                    return (
                      <>
                        <div className="space-y-3  max-h-96 overflow-y-auto">
                          {saleSource.length === 0 && (
                            <div className="text-center text-gray-500 py-6">No invoices found</div>
                          )}
                          {saleSource.map((sale) => (
                            <div
                              key={sale.id}
                              onClick={() => selectSaleForReturn(sale)}
                              className="p-4 border border-gray-200 rounded-lg hover:bg-red-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium">Sale #{sale.id}</p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(sale.timestamp).toLocaleString('en-IN')}
                                  </p>
                                  <p className="text-sm text-gray-600">Cashier: {sale.cashier}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-green-600">₹{sale.total.toFixed(2)}</p>
                                  <p className="text-sm text-gray-600">{sale.items.length} items</p>
                                </div>
                              </div>
                              <div className="text-sm text-gray-600">
                                Items: {sale.items.map((item) => `${item.name} (${item.quantity})`).join(', ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">
                        Return Items from Sale #{selectedSaleForReturn.id}
                      </h3>
                      <button
                        onClick={() => {
                          setSelectedSaleForReturn(null);
                          setReturnItems([]);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ← Back to Sales
                      </button>
                    </div>
                    <p className="text-sm text-gray-600">
                      Sale Date: {new Date(selectedSaleForReturn.timestamp).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="space-y-4 mb-6">
                    {returnItems.map((item) => (
                      <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">{item.name}</h4>
                            <p className="text-sm text-gray-600">
                              {item.brand} {item.size && `- Size: ${item.size}`}
                            </p>
                            <p className="text-sm text-gray-600">
                              Original: {item.quantity} × ₹{item.finalPrice.toFixed(2)} = ₹
                              {(item.finalPrice * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Return Qty:</label>
                            <input
                              type="number"
                              min="0"
                              max={item.maxReturnQuantity}
                              value={item.returnQuantity}
                              onChange={(e) =>
                                updateReturnQuantity(item.id, parseInt(e.target.value) || 0)
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <span className="text-sm text-gray-500">/ {item.maxReturnQuantity}</span>
                          </div>
                        </div>
                        {item.returnQuantity > 0 && (
                          <div className="text-sm text-orange-600 font-medium">
                            Refund: ₹{(item.finalPrice * item.returnQuantity).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Return Reason *
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                  {returnItems.some((item) => item.returnQuantity > 0) && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                      <h4 className="font-medium text-orange-800 mb-2">Return Summary</h4>
                      <p className="text-orange-700">
                        Total Refund: ₹
                        {returnItems
                          .reduce((sum, item) => sum + item.finalPrice * item.returnQuantity, 0)
                          .toFixed(2)}
                      </p>
                      <p className="text-sm text-orange-600 mt-1">
                        Items will be added back to inventory and removed from the original sale.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowReturns(false);
                        setSelectedSaleForReturn(null);
                        setReturnItems([]);
                        setReturnReason('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={processReturn}
                      disabled={
                        !returnItems.some((item) => item.returnQuantity > 0) || !returnReason
                      }
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Process Return
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dues Modal with partial collection + mode */}
      {showDues && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Unpaid Dues</h2>
              <button
                onClick={() => setShowDues(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {/* Search by customer name for dues */}
<div className="relative mb-2">
  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
  <input
    value={dueInvoiceSearch}
    onChange={(e) => setDueInvoiceSearch(e.target.value)}
    placeholder="Search by Customer Name"
    className="w-full pl-9 pr-3 py-2 border rounded-lg"
  />
</div>

{/* Filter dues by customer name */}
{(() => {
  const q = dueInvoiceSearch.trim().toLowerCase();
  const visibleDues = q
    ? dues.filter(d => String(d.customerName || '').toLowerCase().includes(q))
    : dues;

  if (visibleDues.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No unpaid dues {q ? 'for that customer' : ''} 🎉
      </div>
    );
  }

  return visibleDues.map((due) => (
    <div key={due.id} className="p-4 border border-gray-200 rounded-lg">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-gray-900">{due.customerName}</p>
          <p className="text-sm text-gray-600">Sale: {due.saleId}</p>
          <p className="text-xs text-gray-500">
            Created: {new Date(due.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm">
            Total: <span className="font-semibold">₹{due.total.toFixed(2)}</span>
          </p>
          <p className="text-sm">
            Upfront: ₹{(due.upfrontPaid || 0).toFixed(2)}{' '}
            {due.upfrontTender ? `(${due.upfrontTender.toUpperCase()})` : ''}
          </p>
          <p className="text-lg font-bold text-red-600">
            Balance Due: ₹{due.balance.toFixed(2)}
          </p>
        </div>
      </div>

      {due.payments && due.payments.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">
          Collections:{' '}
          {due.payments
            .map(
              (p) =>
                `₹${p.amount.toFixed(2)} ${
                  p.mode ? `(${p.mode.toUpperCase()})` : ''
                } on ${new Date(p.timestamp).toLocaleDateString('en-IN')}`
            )
            .join(', ')}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount to collect (₹)
          </label>
          <p className="text-xs text-gray-700 mt-1">*Max: ₹{due.balance.toFixed(2)}</p>
          <input
            type="number"
            min="1"
            step="1"
            max={due.balance}
            value={collectionInputs[due.id] ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setCollectionInputs((prev) => ({ ...prev, [due.id]: v }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder={due.balance.toFixed(2)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Collection Mode
          </label>
          <select
            value={collectionModes[due.id] ?? 'cash'}
            onChange={(e) =>
              setCollectionModes((prev) => ({ ...prev, [due.id]: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
        </div>

        <div className="flex gap-3 md:col-span-1">
          <button
            onClick={() => {
              const val = collectionInputs[due.id];
              const mode = collectionModes[due.id] ?? 'cash';
              collectDue(due, val, mode);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Collect
          </button>
          <button
            onClick={() => settleDue(due)}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Opening Cash (Today)</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Please enter the cash amount present in the drawer at start of day.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opening Cash (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., 2000"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setOpeningCashInput('0');
                    submitOpeningCash();
                  }}
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
    </div>
  );
};

export default POS;
