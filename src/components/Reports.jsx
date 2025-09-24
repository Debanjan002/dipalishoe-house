// Reports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  Search,
  Printer,
  Receipt,
  X
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

const Reports = () => {
  // Preset date range: today | yesterday | 7days | 10days | 30days | all
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [returns, setReturns] = useState([]);
  const [allDues, setAllDues] = useState([]);
  const [duePayments, setDuePayments] = useState([]);

  const [drawer, setDrawer] = useState({ date: '', opening: 0, current: 0 });
  const [dailyTenders, setDailyTenders] = useState({ date: '', cash: 0, upi: 0 });

  const [selectedSale, setSelectedSale] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Shop settings (same source as POS)
  const { shopSettings } = useSettings();

  const [productQuery, setProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [saleQuery, setSaleQuery] = useState('');

  // Quick Reprint
  const [reprintQuery, setReprintQuery] = useState('');
  const [reprintMatch, setReprintMatch] = useState(null);

  useEffect(() => {
    loadData();
    loadDrawerAndTenders();
  }, []);

  useEffect(() => {
    if (!reprintQuery) {
      setReprintMatch(null);
      return;
    }
    const q = reprintQuery.trim().toLowerCase();
    const found =
      sales.find((s) => String(s.id || '').toLowerCase() === q) ||
      sales.find((s) => String(s.id || '').toLowerCase().includes(q));
    setReprintMatch(found || null);
  }, [reprintQuery, sales]);

  const loadDrawerAndTenders = () => {
    try {
      const d = JSON.parse(localStorage.getItem('pos_drawer') || 'null');
      if (d && d.date) setDrawer(d);
    } catch {}
    try {
      const t = JSON.parse(localStorage.getItem('pos_daily_tenders') || 'null');
      if (t && t.date) setDailyTenders(t);
    } catch {}
  };

  const loadData = () => {
    const storedSales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const storedProducts = JSON.parse(localStorage.getItem('pos_products') || '[]');
    const storedReturns = JSON.parse(localStorage.getItem('pos_returns') || '[]');
    const storedDues = JSON.parse(localStorage.getItem('pos_dues') || '[]');
    const storedDuePayments = JSON.parse(localStorage.getItem('pos_due_payments') || '[]');

    setSales(storedSales);
    setProducts(storedProducts);
    setReturns(storedReturns);
    setAllDues(storedDues);
    setDuePayments(storedDuePayments);
  };

  // Date helpers
  const dayStart = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };
  const dayEndExclusive = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  };
  const getBounds = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);

    if (startDate || endDate) {
      const startB = startDate ? dayStart(startDate) : null;
      let endB = null;
      if (endDate) endB = dayEndExclusive(endDate);
      else if (startDate) endB = dayEndExclusive(startDate);
      return { startB, endB };
    }

    let startB = null,
      endB = null;
    switch (dateRange) {
      case 'today':
        startB = todayStart;
        endB = tomorrowStart;
        break;
      case 'yesterday':
        startB = new Date(todayStart.getTime() - 86400000);
        endB = todayStart;
        break;
      case '7days':
        startB = new Date(todayStart.getTime() - 7 * 86400000);
        endB = tomorrowStart;
        break;
      case '10days':
        startB = new Date(todayStart.getTime() - 10 * 86400000);
        endB = tomorrowStart;
        break;
      case '30days':
        startB = new Date(todayStart.getTime() - 30 * 86400000);
        endB = tomorrowStart;
        break;
      case 'all':
      default:
        startB = null;
        endB = null;
        break;
    }
    return { startB, endB };
  };
  const inRange = (ts) => {
    const { startB, endB } = getBounds();
    const d = new Date(ts);
    if (startB && d < startB) return false;
    if (endB && d >= endB) return false;
    return true;
  };

  // Filtered sales
  const getFilteredSales = () => {
    const usingManual = !!(startDate || endDate);
    return sales.filter((sale) => {
      const saleDate = new Date(sale.timestamp);
      if (usingManual) {
        let startB = null,
          endB = null;
        if (startDate) startB = dayStart(startDate);
        if (endDate) endB = dayEndExclusive(endDate);
        else if (startDate) endB = dayEndExclusive(startDate);
        if (startB && endB) return saleDate >= startB && saleDate < endB;
        if (startB && !endB) return saleDate >= startB;
        if (!startB && endB) return saleDate < endB;
        return true;
      }
      const { startB, endB } = getBounds();
      if (startB && saleDate < startB) return false;
      if (endB && saleDate >= endB) return false;
      return true;
    });
  };
  const filteredSales = useMemo(getFilteredSales, [sales, dateRange, startDate, endDate]);

  // KPIs
  const totalRevenue = filteredSales.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const totalTransactions = filteredSales.length;
  const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const totalTax = filteredSales.reduce((s, x) => s + (Number(x.tax) || 0), 0);

  // Range-aware tender/due
  const paidCash = filteredSales
    .filter((s) => s.paymentMethod === 'cash')
    .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const paidUPI = filteredSales
    .filter((s) => s.paymentMethod === 'upi')
    .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  const duesCreatedInRange = (allDues || []).filter((d) => inRange(d.createdAt));
  const dueCreatedAmount = duesCreatedInRange.reduce(
    (sum, d) => sum + (Number(d.total || 0) - Number(d.upfrontPaid || 0)),
    0
  );

  const upfrontCash = duesCreatedInRange
    .filter((d) => d.upfrontTender === 'cash')
    .reduce((sum, d) => sum + (Number(d.upfrontPaid) || 0), 0);
  const upfrontUPI = duesCreatedInRange
    .filter((d) => d.upfrontTender === 'upi')
    .reduce((sum, d) => sum + (Number(d.upfrontPaid) || 0), 0);

  const duePayInRange = (duePayments || []).filter((p) => inRange(p.timestamp));
  const dueCashCollected = duePayInRange
    .filter((p) => p.mode === 'cash')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const dueUPICollected = duePayInRange
    .filter((p) => p.mode === 'upi')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const cashRefunds = (returns || [])
    .filter((r) => inRange(r.timestamp))
    .reduce((sum, r) => sum + (Number(r.totalRefund) || 0), 0);

  const cashInRange = paidCash + upfrontCash + dueCashCollected - cashRefunds;
  const upiInRange = paidUPI + upfrontUPI + dueUPICollected;

  const outstandingDue = (allDues || []).reduce((sum, d) => sum + (Number(d.balance) || 0), 0);

  const rangeIncludesToday = (() => {
    const { startB, endB } = getBounds();
    const now = new Date();
    return (!startB || now >= startB) && (!endB || now < endB);
  })();
  const drawerOpeningDisplay =
    rangeIncludesToday && drawer && drawer.date ? `₹${Number(drawer.opening || 0).toFixed(2)}` : '—';

  // Top products
  const productSales = {};
  filteredSales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const id = item.id ?? `${item.name}|${item.price}`;
      if (productSales[id]) {
        productSales[id].quantity += Number(item.quantity) || 0;
        productSales[id].revenue += (Number(item.quantity) || 0) * (Number(item.price) || 0);
      } else {
        productSales[id] = {
          id: item.id,
          name: item.name,
          quantity: Number(item.quantity) || 0,
          revenue: (Number(item.quantity) || 0) * (Number(item.price) || 0)
        };
      }
    });
  });
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Daily sales
  const dailySalesData = useMemo(() => {
    const daily = {};
    filteredSales.forEach((sale) => {
      const date = new Date(sale.timestamp).toLocaleDateString();
      daily[date] = (daily[date] || 0) + (Number(sale.total) || 0);
    });
    return Object.entries(daily).map(([date, total]) => ({ date, total }));
  }, [filteredSales]);

  // Product lookup
  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [productQuery, products]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  const selectedProductStats = useMemo(() => {
    if (!selectedProduct) return null;
    let qty = 0,
      revenue = 0,
      lastTs = null;
    filteredSales.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        if (it.id === selectedProduct.id) {
          const q = Number(it.quantity) || 0;
          qty += q;
          revenue += q * (Number(it.price) || 0);
          const ts = new Date(sale.timestamp);
          if (!lastTs || ts > lastTs) lastTs = ts;
        }
      });
    });
    return {
      qty,
      revenue,
      lastSoldAt: lastTs ? lastTs.toLocaleString() : '—'
    };
  }, [selectedProduct, filteredSales]);

  // Export
  const exportToCSV = () => {
    const csvData = [
      ['Date', 'Time', 'Transaction ID', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment Method'],
      ...filteredSales.map((sale) => {
        const d = new Date(sale.timestamp);
        const itemsStr = (sale.items || [])
          .map((item) => `${item.name} (${item.quantity})`)
          .join('; ');
        return [
          d.toLocaleDateString(),
          d.toLocaleTimeString(),
          sale.id,
          itemsStr,
          (Number(sale.subtotal) || 0).toFixed(2),
          (Number(sale.tax) || 0).toFixed(2),
          (Number(sale.total) || 0).toFixed(2),
          sale.paymentMethod
        ];
      })
    ];
    const csvContent = csvData
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let suffix = dateRange;
    if (startDate || endDate) {
      const sd = startDate || 'NA';
      const ed = endDate || startDate || 'NA';
      suffix = `custom_${sd}_${ed}`;
    }
    a.download = `sales-report-${suffix}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // COPY BILL – same header/footer as POS
  const printCopyBill = (sale) => {
    if (!sale) return;
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Copy Bill</title>
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
    <div class="rule"></div>
    <div>SALE RECEIPT <span class="tag">COPY BILL</span></div>
  </div>

  <div class="sub">
    <div>Bill No: ${sale.id}</div>
    <div>Original Date: ${new Date(sale.timestamp).toLocaleString('en-IN')}</div>
    <div>Reprint: ${new Date().toLocaleString('en-IN')}</div>
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
              ? `<tr class="no-break">
                  <td colspan="3" class="left sub nowrap">Discount ${
                    item.discountType === 'percentage' ? `(${item.discount}%)` : item.discount ? `(₹${item.discount})` : ''
                  }</td>
                  <td class="right sub mono nowrap">-₹${saved}</td>
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
    <tr class="emph-row"><td class="left">${sale.paymentMethod === 'DUE' ? 'Balance' : 'Change'}</td>
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
</html>`.trim();

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  };

  // Modal handlers
  const handleOpenDetails = (sale) => {
    setSelectedSale(sale);
    setIsDetailOpen(true);
  };
  const handleCloseDetails = () => {
    setIsDetailOpen(false);
    setSelectedSale(null);
  };

  const clearManualDates = () => {
    setStartDate('');
    setEndDate('');
  };

  // Recent (click to open full detail, like original)
  const visibleRecent = useMemo(() => {
    const q = saleQuery.trim().toLowerCase();
    const list = q
      ? filteredSales.filter((s) => {
          const id = String(s.id || '').toLowerCase();
          const pm = String(s.paymentMethod || '').toLowerCase();
          const items = (s.items || []).some((it) => (it.name || '').toLowerCase().includes(q));
          return id.includes(q) || pm.includes(q) || items;
        })
      : filteredSales;
    return list.slice(-100).reverse();
  }, [filteredSales, saleQuery]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5 sticky top-4">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Filters</h2>
            </div>
            <div className="space-y-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="10days">Last 10 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-600">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-600">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={clearManualDates}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear Dates
                </button>
                <button
                  onClick={loadData}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>

              <button
                onClick={exportToCSV}
                className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Printer className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">Quick Reprint</h2>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={reprintQuery}
                onChange={(e) => setReprintQuery(e.target.value)}
                placeholder="Enter Bill / Invoice No."
                className="w-full pl-9 pr-3 py-2 border rounded-lg"
              />
            </div>
            <div className="mt-3">
              <button
                disabled={!reprintMatch}
                onClick={() => printCopyBill(reprintMatch)}
                className={`w-full px-3 py-2 rounded-lg flex items-center justify-center gap-2 ${
                  reprintMatch
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Printer className="w-4 h-4" /> Print Copy Bill
              </button>
              <p className="text-xs text-gray-500 mt-2">
                {reprintMatch
                  ? `Found: ${reprintMatch.id} • ${new Date(reprintMatch.timestamp).toLocaleString()}`
                  : 'Search by exact or partial Bill No.'}
              </p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="xl:col-span-9 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Cash (in range)</p>
                  <p className="text-2xl font-bold text-green-600">₹{cashInRange.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">
                    Cash sales + upfront + due collections − refunds
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">UPI (in range)</p>
                  <p className="text-2xl font-bold text-indigo-600">₹{upiInRange.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">UPI sales + upfront + due collections</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Due Created (range)</p>
                  <p className="text-2xl font-bold text-orange-600">₹{dueCreatedAmount.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Outstanding Due (all-time)</p>
                  <p className="text-2xl font-bold text-red-600">₹{outstandingDue.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Drawer Opening (today)</p>
                  <p className="text-2xl font-bold text-purple-600">{drawerOpeningDisplay}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold text-blue-600">{totalTransactions}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. Transaction</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ₹{averageTransactionValue.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tax</p>
                  <p className="text-2xl font-bold text-orange-600">₹{totalTax.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent & Top / Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Transactions (click opens FULL detail like original) */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Recent Transactions
                </h2>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    value={saleQuery}
                    onChange={(e) => setSaleQuery(e.target.value)}
                    placeholder="Search id / item / mode..."
                    className="pl-8 pr-3 py-1.5 border rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {visibleRecent.map((sale) => (
                  <div key={sale.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenDetails(sale)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') handleOpenDetails(sale);
                        }}
                        className="cursor-pointer"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          Transaction #{String(sale.id).slice(-6)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(sale.timestamp).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 capitalize">{sale.paymentMethod}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          ₹{Number(sale.total || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600 text-right">
                          {(sale.items || []).length} items
                        </p>
                        <button
                          onClick={() => printCopyBill(sale)}
                          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                          title="Print copy bill"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Copy Bill
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredSales.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No transactions found</p>
                )}
              </div>
            </div>

            {/* Top products + product details */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Top Selling Products
                </h2>
                <div className="space-y-3">
                  {topProducts.length > 0 ? (
                    topProducts.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-sm text-gray-600">{p.quantity} units sold</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">₹{p.revenue.toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No sales data available</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-600" />
                  Product Details
                </h2>

                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative md:w-96">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Search by name / brand / barcode"
                      className="w-full pl-9 pr-3 py-2 border rounded-lg"
                    />
                    {productMatches.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow">
                        {productMatches.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setProductQuery(p.name);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50"
                          >
                            <div className="text-sm font-medium">{p.name}</div>
                            <div className="text-xs text-gray-500">
                              {p.brand || '-'} · {p.category || '-'} · #{p.barcode}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedProduct && (
                    <div className="text-sm text-gray-600">
                      Selected: <span className="font-medium">{selectedProduct.name}</span>
                    </div>
                  )}
                </div>

                {selectedProduct && (
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-2">Inventory</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Brand:</div>
                        <div className="font-medium">{selectedProduct.brand || '-'}</div>
                        <div>Category:</div>
                        <div className="font-medium">{selectedProduct.category || '-'}</div>
                        <div>Size:</div>
                        <div className="font-medium">{selectedProduct.size || '-'}</div>
                        <div>Barcode:</div>
                        <div className="font-medium break-all">#{selectedProduct.barcode}</div>
                        <div>Price:</div>
                        <div className="font-medium">
                          ₹{Number(selectedProduct.price || 0).toFixed(2)}
                        </div>
                        <div>Stock:</div>
                        <div className="font-medium">{Number(selectedProduct.stock || 0)}</div>
                        <div>Min Stock:</div>
                        <div className="font-medium">{Number(selectedProduct.minStock || 0)}</div>
                        <div>Supplier:</div>
                        <div className="font-medium">{selectedProduct.supplier || '-'}</div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-2">
                        Performance (current range)
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Units Sold:</div>
                        <div className="font-medium">{selectedProductStats?.qty ?? 0}</div>
                        <div>Revenue:</div>
                        <div className="font-medium">
                          ₹{Number(selectedProductStats?.revenue || 0).toFixed(2)}
                        </div>
                        <div>Last Sold:</div>
                        <div className="font-medium">
                          {selectedProductStats?.lastSoldAt || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Daily Sales */}
          {dailySalesData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Daily Sales Overview
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dailySalesData.map((day, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-900">{day.date}</span>
                    <span className="font-bold text-green-600">
                      ₹{Number(day.total).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FULL DETAIL MODAL (matches your original fields) */}
      {isDetailOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseDetails} />
          <div className="relative bg-white w-full max-w-2xl mx-4 rounded-xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Transaction #{String(selectedSale.id).slice(-6)}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printCopyBill(selectedSale)}
                  className="px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2"
                  title="Print copy bill"
                >
                  <Printer className="w-4 h-4" /> Copy Bill
                </button>
                <button
                  onClick={handleCloseDetails}
                  className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Close
                </button>
              </div>
            </div>

            {/* Meta (same style as your original) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 mb-4">
              <div>
                <span className="font-medium">ID:</span> {selectedSale.id}
              </div>
              <div>
                <span className="font-medium">Date:</span>{' '}
                {new Date(selectedSale.timestamp).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Payment:</span> {selectedSale.paymentMethod}
              </div>
              <div>
                <span className="font-medium">Cashier:</span> {selectedSale.cashier || '-'}
              </div>
              {selectedSale.paymentMethod === 'DUE' && selectedSale.customerName && (
                <div className="sm:col-span-2">
                  <span className="font-medium">Customer:</span> {selectedSale.customerName}
                </div>
              )}
            </div>

            {/* Items Table (adds per-item discount row like receipt when applicable) */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Item</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Rate</th>
                    <th className="text-right p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSale.items || []).map((it, idx) => {
                    const q = Number(it.quantity) || 0;
                    const rate = Number(it.price) || 0;
                    const amount = (rate * q).toFixed(2);
                    const hadDiscount =
                      Number(it.discount) > 0 ||
                      (it.finalPrice && Number(it.finalPrice) !== Number(it.price));
                    const saved = hadDiscount
                      ? (rate * q - (Number(it.finalPrice || rate) * q)).toFixed(2)
                      : null;
                    return (
                      <React.Fragment key={idx}>
                        <tr className="border-t">
                          <td className="p-2">
                            {it.name}
                            {it.size ? ` (${it.size})` : ''}
                          </td>
                          <td className="p-2 text-right">{q}</td>
                          <td className="p-2 text-right">₹{rate.toFixed(2)}</td>
                          <td className="p-2 text-right">₹{amount}</td>
                        </tr>
                        {hadDiscount && (
                          <tr className="border-t bg-gray-50">
                            <td className="p-2 text-xs text-gray-600" colSpan={3}>
                              Discount{' '}
                              {it.discountType === 'percentage'
                                ? `(${it.discount}%)`
                                : it.discount
                                ? `(₹${it.discount})`
                                : ''}
                            </td>
                            <td className="p-2 text-right text-xs text-gray-700">-₹{saved}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals (show ALL like original) */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 text-sm text-gray-700">
                <div>
                  <span className="font-medium">Subtotal:</span> ₹
                  {Number(selectedSale.subtotal || 0).toFixed(2)}
                </div>
                {Number(selectedSale.totalDiscount || 0) > 0 && (
                  <div>
                    <span className="font-medium">Total Discount:</span> -₹
                    {Number(selectedSale.totalDiscount || 0).toFixed(2)}
                  </div>
                )}
                <div>
                  <span className="font-medium">After Discount:</span> ₹
                  {Number(
                    selectedSale.afterDiscount ??
                      (selectedSale.subtotal || 0) - (selectedSale.totalDiscount || 0)
                  ).toFixed(2)}
                </div>
                <div>
                  <span className="font-medium">CGST:</span> ₹
                  {Number(selectedSale.cgst || 0).toFixed(2)}
                </div>
                <div>
                  <span className="font-medium">SGST:</span> ₹
                  {Number(selectedSale.sgst || 0).toFixed(2)}
                </div>
              </div>
              <div className="space-y-1 text-sm text-gray-700">
                <div className="text-lg font-semibold">
                  Total: ₹{Number(selectedSale.total || 0).toFixed(2)}
                </div>
                <div>
                  Paid: ₹
                  {Number(selectedSale.amountPaid ?? selectedSale.total ?? 0).toFixed(2)} (
                  {selectedSale.paymentMethod})
                </div>
                <div>
                  {selectedSale.paymentMethod === 'DUE' ? 'Balance' : 'Change'}: ₹
                  {selectedSale.paymentMethod === 'DUE'
                    ? Math.max(
                        0,
                        Number(selectedSale.total || 0) -
                          Number(selectedSale.amountPaid || 0)
                      ).toFixed(2)
                    : Number(selectedSale.change || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => printCopyBill(selectedSale)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Copy Bill
              </button>
              <button
                onClick={handleCloseDetails}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
