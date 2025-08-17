import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar as CalendarIcon,
  Download,
  RefreshCw
} from 'lucide-react';

const Reports = () => {
  // Preset date range
  // Allowed values: today | yesterday | 7days | 10days | 30days | all
  const [dateRange, setDateRange] = useState('today');

  // Manual date range (always visible). If either is set, it overrides the preset.
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');     // YYYY-MM-DD

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);

  // Modal + selected sale (printing removed)
  const [selectedSale, setSelectedSale] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Shop settings kept (useful for tax labels, etc.), but no printing uses it now
  const [shopSettings, setShopSettings] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
    taxRate: 0,
    logo: ''
  });

  useEffect(() => {
    loadData();
    loadShopSettings();
  }, []);

  const loadData = () => {
    const storedSales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const storedProducts = JSON.parse(localStorage.getItem('pos_products') || '[]');
    setSales(storedSales);
    setProducts(storedProducts);
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
        case 'today':
          return saleDate >= todayStart;
        case 'yesterday': {
          const yStart = new Date(todayStart.getTime() - 1 * 24 * 60 * 60 * 1000);
          const yEnd = todayStart;
          return saleDate >= yStart && saleDate < yEnd;
        }
        case '7days': {
          const start = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
          return saleDate >= start;
        }
        case '10days': {
          const start = new Date(todayStart.getTime() - 10 * 24 * 60 * 60 * 1000);
          return saleDate >= start;
        }
        case '30days': {
          const start = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
          return saleDate >= start;
        }
        case 'all':
        default:
          return true;
      }
    });
  };

  const filteredSales = useMemo(getFilteredSales, [sales, dateRange, startDate, endDate]);

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const totalTransactions = filteredSales.length;
  const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const totalTax = filteredSales.reduce((sum, sale) => sum + (Number(sale.tax) || 0), 0);

  // Top selling products
  const productSales = {};
  filteredSales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const id = item.id ?? `${item.name}|${item.price}`;
      if (productSales[id]) {
        productSales[id].quantity += Number(item.quantity) || 0;
        productSales[id].revenue += (Number(item.quantity) || 0) * (Number(item.price) || 0);
      } else {
        productSales[id] = {
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

  // Daily sales (simple)
  const dailySalesData = useMemo(() => {
    const daily = {};
    filteredSales.forEach(sale => {
      const date = new Date(sale.timestamp).toLocaleDateString();
      daily[date] = (daily[date] || 0) + (Number(sale.total) || 0);
    });
    return Object.entries(daily).map(([date, total]) => ({ date, total }));
  }, [filteredSales]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>

          <div className="w-full sm:w-auto flex flex-col gap-3">
            {/* Presets */}
            <div className="flex flex-wrap gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            {/* Manual calendar range (always visible) */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Start:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
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
              <span className="text-xs text-gray-500">
                Tip: Setting either date overrides the preset above.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
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
        {/* Top Products */}
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

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Recent Transactions
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {filteredSales.slice(-10).reverse().map((sale) => (
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

      {/* Daily Sales Summary */}
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

      {/* Transaction Detail Modal */}
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