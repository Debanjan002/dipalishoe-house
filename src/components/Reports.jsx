import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  Search
} from 'lucide-react';

const Reports = () => {
  // Preset date range
  // Allowed values: today | yesterday | 7days | 10days | 30days | all
  const [dateRange, setDateRange] = useState('today');

  // Manual date range (if either is set, it overrides the preset).
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');     // YYYY-MM-DD

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);

  // Extras for new summary
  const [returns, setReturns] = useState([]);
  const [allDues, setAllDues] = useState([]);
  const [duePayments, setDuePayments] = useState([]);

  // Drawer / Daily tender (we only store "today", so show when range includes today)
  const [drawer, setDrawer] = useState({ date: '', opening: 0, current: 0 });
  const [dailyTenders, setDailyTenders] = useState({ date: '', cash: 0, upi: 0 });

  // Modal + selected sale
  const [selectedSale, setSelectedSale] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Shop settings (for labels; printing not used here)
  const [shopSettings, setShopSettings] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
    taxRate: 0,
    logo: ''
  });

  // Product details lookup
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Quick filter for recent transactions list
  const [saleQuery, setSaleQuery] = useState('');

  useEffect(() => {
    loadData();
    loadShopSettings();
    loadDrawerAndTenders();
  }, []);

  const loadDrawerAndTenders = () => {
    try {
      const d = JSON.parse(localStorage.getItem('pos_drawer') || 'null');
      if (d && d.date) setDrawer(d);
    } catch (_) {}
    try {
      const t = JSON.parse(localStorage.getItem('pos_daily_tenders') || 'null');
      if (t && t.date) setDailyTenders(t);
    } catch (_) {}
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

  const loadShopSettings = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('shop_settings') || '{}');
      setShopSettings(prev => ({ ...prev, ...stored }));
    } catch (_) {}
  };

  // Helpers to build start/end boundaries from YYYY-MM-DD (local)
  const dayStart = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };
  // end boundary is exclusive: next day 00:00 to include full chosen end date
  const dayEndExclusive = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  };

  // Compute the active range bounds for ALL range-aware stats
  const getBounds = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Manual overrides preset if any of the fields are set
    if (startDate || endDate) {
      const startB = startDate ? dayStart(startDate) : null;
      let endB = null;
      if (endDate) endB = dayEndExclusive(endDate);
      else if (startDate) endB = dayEndExclusive(startDate);
      return { startB, endB };
    }

    // Presets
    let startB = null, endB = null;
    switch (dateRange) {
      case 'today':
        startB = todayStart; endB = tomorrowStart; break;
      case 'yesterday':
        startB = new Date(todayStart.getTime() - 24*60*60*1000); endB = todayStart; break;
      case '7days':
        startB = new Date(todayStart.getTime() - 7*24*60*60*1000); endB = tomorrowStart; break;
      case '10days':
        startB = new Date(todayStart.getTime() - 10*24*60*60*1000); endB = tomorrowStart; break;
      case '30days':
        startB = new Date(todayStart.getTime() - 30*24*60*60*1000); endB = tomorrowStart; break;
      case 'all':
      default:
        startB = null; endB = null; break;
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

  // ===== Filtered Sales for lists & original KPIs (kept) =====
  const getFilteredSales = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const usingManual = !!(startDate || endDate);

    return sales.filter((sale) => {
      const saleDate = new Date(sale.timestamp);

      if (usingManual) {
        let startB = null;
        let endB = null;

        if (startDate) startB = dayStart(startDate);
        if (endDate)   endB = dayEndExclusive(endDate);
        else if (startDate) endB = dayEndExclusive(startDate); // single date

        if (startB && endB) return saleDate >= startB && saleDate < endB;
        if (startB && !endB) return saleDate >= startB;
        if (!startB && endB) return saleDate < endB;
        return true;
      }

      // Presets
      switch (dateRange) {
        case 'today': {
          const tomorrow = new Date(todayStart.getTime() + 24*60*60*1000);
          return saleDate >= todayStart && saleDate < tomorrow;
        }
        case 'yesterday': {
          const yStart = new Date(todayStart.getTime() - 1 * 24 * 60 * 60 * 1000);
          const yEnd = todayStart;
          return saleDate >= yStart && saleDate < yEnd;
        }
        case '7days': {
          const start = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
          const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
          return saleDate >= start && saleDate < end;
        }
        case '10days': {
          const start = new Date(todayStart.getTime() - 10 * 24 * 60 * 60 * 1000);
          const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
          return saleDate >= start && saleDate < end;
        }
        case '30days': {
          const start = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
          const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
          return saleDate >= start && saleDate < end;
        }
        case 'all':
        default:
          return true;
      }
    });
  };

  const filteredSales = useMemo(getFilteredSales, [sales, dateRange, startDate, endDate]);

  // ===== Original KPI set (kept) =====
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const totalTransactions = filteredSales.length;
  const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const totalTax = filteredSales.reduce((sum, sale) => sum + (Number(sale.tax) || 0), 0);

  // ===== New: Range-aware tender & due summary =====
  // Cash & UPI from fully-paid sales in range
  const paidCash = filteredSales
    .filter(s => s.paymentMethod === 'cash')
    .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const paidUPI = filteredSales
    .filter(s => s.paymentMethod === 'upi')
    .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  // DUE created in range (from pos_dues, createdAt in range)
  const duesCreatedInRange = (allDues || []).filter(d => inRange(d.createdAt));
  const dueCreatedAmount = duesCreatedInRange.reduce((sum, d) => sum + (Number(d.total || 0) - Number(d.upfrontPaid || 0)), 0);

  // Upfront taken for DUE in range, split by mode (from due record)
  const upfrontCash = duesCreatedInRange
    .filter(d => d.upfrontTender === 'cash')
    .reduce((sum, d) => sum + (Number(d.upfrontPaid) || 0), 0);
  const upfrontUPI = duesCreatedInRange
    .filter(d => d.upfrontTender === 'upi')
    .reduce((sum, d) => sum + (Number(d.upfrontPaid) || 0), 0);

  // Due collections in range (from pos_due_payments)
  const duePayInRange = (duePayments || []).filter(p => inRange(p.timestamp));
  const dueCashCollected = duePayInRange
    .filter(p => p.mode === 'cash')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const dueUPICollected = duePayInRange
    .filter(p => p.mode === 'upi')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Returns in range (your POS refunds via CASH)
  const cashRefunds = (returns || [])
    .filter(r => inRange(r.timestamp))
    .reduce((sum, r) => sum + (Number(r.totalRefund) || 0), 0);

  // Net tender totals for the selected range
  const cashInRange = (paidCash + upfrontCash + dueCashCollected) - cashRefunds;
  const upiInRange  = (paidUPI + upfrontUPI + dueUPICollected);

  // Outstanding due (all-time, current balance)
  const outstandingDue = (allDues || []).reduce((sum, d) => sum + (Number(d.balance) || 0), 0);

  // Show drawer opening only if the range includes "today"
  const rangeIncludesToday = (() => {
    const { startB, endB } = getBounds();
    const now = new Date();
    return (!startB || now >= startB) && (!endB || now < endB);
  })();
  const drawerOpeningDisplay = rangeIncludesToday && drawer && drawer.date ? `₹${Number(drawer.opening || 0).toFixed(2)}` : '—';

  // ===== Top Selling Products (kept) =====
  const productSales = {};
  filteredSales.forEach(sale => {
    (sale.items || []).forEach(item => {
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

  // ===== Daily sales (kept) =====
  const dailySalesData = useMemo(() => {
    const daily = {};
    filteredSales.forEach(sale => {
      const date = new Date(sale.timestamp).toLocaleDateString();
      daily[date] = (daily[date] || 0) + (Number(sale.total) || 0);
    });
    return Object.entries(daily).map(([date, total]) => ({ date, total }));
  }, [filteredSales]);

  // ===== Product Details lookup (new) =====
  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [productQuery, products]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find(p => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  // Sales stats for selected product in the CURRENT range
  const selectedProductStats = useMemo(() => {
    if (!selectedProduct) return null;
    let qty = 0, revenue = 0, lastTs = null;
    filteredSales.forEach(sale => {
      (sale.items || []).forEach(it => {
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

  // ===== Export CSV (kept) =====
  const exportToCSV = () => {
    const csvData = [
      ['Date', 'Time', 'Transaction ID', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment Method'],
      ...filteredSales.map(sale => {
        const d = new Date(sale.timestamp);
        const dateStr = d.toLocaleDateString();
        const timeStr = d.toLocaleTimeString();
        const itemsStr = (sale.items || []).map(item => `${item.name} (${item.quantity})`).join('; ');
        return [
          dateStr,
          timeStr,
          sale.id,
          itemsStr,
          (Number(sale.subtotal) || 0).toFixed(2),
          (Number(sale.tax) || 0).toFixed(2),
          (Number(sale.total) || 0).toFixed(2),
          sale.paymentMethod
        ];
      })
    ];

    const csvContent = csvData.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(',')
    ).join('\n');

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

  // ===== Modal handlers (kept) =====
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

  // Recent transactions quick filter
  const visibleRecent = useMemo(() => {
    const q = saleQuery.trim().toLowerCase();
    const list = q
      ? filteredSales.filter(s => {
          const id = String(s.id || '').toLowerCase();
          const pm = String(s.paymentMethod || '').toLowerCase();
          const items = (s.items || []).some(it => (it.name || '').toLowerCase().includes(q));
          return id.includes(q) || pm.includes(q) || items;
        })
      : filteredSales;
    return list.slice(-10).reverse();
  }, [filteredSales, saleQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>

          <div className="w-full sm:w-auto flex flex-col gap-3">
            {/* Presets + actions */}
            <div className="flex flex-wrap gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Quick date range"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="10days">Last 10 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>

              <button
                onClick={loadData}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            {/* Manual calendar range */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 border px-2 py-2 rounded-lg">
                <label className="text-sm text-gray-700">Start:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 border px-2 py-2 rounded-lg">
                <label className="text-sm text-gray-700">End:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={clearManualDates}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Dates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Range-aware Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cash (in range)</p>
              <p className="text-2xl font-bold text-green-600">₹{cashInRange.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Includes cash sales, cash upfront, cash due collections, minus refunds</p>
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
              <p className="text-xs text-gray-500">UPI sales + UPI upfront + UPI due collections</p>
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

      {/* Original Key Metrics (kept) */}
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
              <p className="text-2xl font-bold text-purple-600">₹{averageTransactionValue.toFixed(2)}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products (kept) */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Top Selling Products
          </h2>
          <div className="space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-600">{product.quantity} units sold</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">₹{product.revenue.toFixed(2)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No sales data available</p>
            )}
          </div>
        </div>

        {/* Recent Transactions (kept, with quick search) */}
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
                onChange={(e)=>setSaleQuery(e.target.value)}
                placeholder="Search id / item / mode..."
                className="pl-8 pr-3 py-1.5 border rounded-md text-sm"
              />
            </div>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {visibleRecent.map((sale) => (
              <div
                key={sale.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenDetails(sale)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenDetails(sale); }}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Transaction #{String(sale.id).slice(-6)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(sale.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 capitalize">
                    {sale.paymentMethod}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">₹{Number(sale.total || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-600">{(sale.items || []).length} items</p>
                </div>
              </div>
            ))}
            {filteredSales.length === 0 && (
              <p className="text-gray-500 text-center py-4">No transactions found</p>
            )}
          </div>
        </div>
      </div>

      {/* NEW: Product Details (inventory + range performance) */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-600" />
          Product Details
        </h2>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
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
                {productMatches.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProductId(p.id); setProductQuery(p.name); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.brand || '-'} · {p.category || '-'} · #{p.barcode}</div>
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
                <div>Brand:</div><div className="font-medium">{selectedProduct.brand || '-'}</div>
                <div>Category:</div><div className="font-medium">{selectedProduct.category || '-'}</div>
                <div>Size:</div><div className="font-medium">{selectedProduct.size || '-'}</div>
                <div>Barcode:</div><div className="font-medium break-all">#{selectedProduct.barcode}</div>
                <div>Price:</div><div className="font-medium">₹{Number(selectedProduct.price || 0).toFixed(2)}</div>
                <div>Stock:</div><div className="font-medium">{Number(selectedProduct.stock || 0)}</div>
                <div>Min Stock:</div><div className="font-medium">{Number(selectedProduct.minStock || 0)}</div>
                <div>Supplier:</div><div className="font-medium">{selectedProduct.supplier || '-'}</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Performance (current range)</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Units Sold:</div><div className="font-medium">{selectedProductStats?.qty ?? 0}</div>
                <div>Revenue:</div><div className="font-medium">₹{Number(selectedProductStats?.revenue || 0).toFixed(2)}</div>
                <div>Last Sold:</div><div className="font-medium">{selectedProductStats?.lastSoldAt || '—'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Daily Sales Summary (kept) */}
      {dailySalesData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Daily Sales Overview
          </h2>
          <div className="space-y-3">
            {dailySalesData.map((day, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-900">{day.date}</span>
                <span className="font-bold text-green-600">₹{Number(day.total).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction Detail Modal (kept) */}
      {isDetailOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleCloseDetails}
          />
          {/* Panel */}
          <div className="relative bg-white w-full max-w-2xl mx-4 rounded-xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Transaction #{String(selectedSale.id).slice(-6)}
              </h3>
              <button
                onClick={handleCloseDetails}
                className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 mb-4">
              <div><span className="font-medium">ID:</span> {selectedSale.id}</div>
              <div><span className="font-medium">Date:</span> {new Date(selectedSale.timestamp).toLocaleString()}</div>
              <div><span className="font-medium">Payment:</span> {selectedSale.paymentMethod}</div>
              <div><span className="font-medium">Cashier:</span> {selectedSale.cashier || '-'}</div>
            </div>

            {/* Items */}
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
                  {(selectedSale.items || []).map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">
                        {it.name}{it.size ? ` (${it.size})` : ''}
                      </td>
                      <td className="p-2 text-right">{Number(it.quantity) || 0}</td>
                      <td className="p-2 text-right">₹{Number(it.price).toFixed(2)}</td>
                      <td className="p-2 text-right">₹{((Number(it.price) || 0) * (Number(it.quantity) || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 text-sm text-gray-700">
                <div><span className="font-medium">Subtotal:</span> ₹{Number(selectedSale.subtotal || 0).toFixed(2)}</div>
                {selectedSale.totalDiscount > 0 && (
                  <div><span className="font-medium">Total Discount:</span> -₹{Number(selectedSale.totalDiscount || 0).toFixed(2)}</div>
                )}
                <div><span className="font-medium">CGST:</span> ₹{Number(selectedSale.cgst || 0).toFixed(2)}</div>
                <div><span className="font-medium">SGST:</span> ₹{Number(selectedSale.sgst || 0).toFixed(2)}</div>
              </div>
              <div className="space-y-1 text-sm text-gray-700">
                <div className="text-lg font-semibold">Total: ₹{Number(selectedSale.total || 0).toFixed(2)}</div>
                <div>Paid: ₹{Number(selectedSale.amountPaid ?? selectedSale.total ?? 0).toFixed(2)} ({selectedSale.paymentMethod})</div>
                <div>Change: ₹{Number(selectedSale.change || 0).toFixed(2)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
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
