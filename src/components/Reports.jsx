import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';

const Reports = () => {
  const [dateRange, setDateRange] = useState('today');
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const storedSales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const storedProducts = JSON.parse(localStorage.getItem('pos_products') || '[]');
    setSales(storedSales);
    setProducts(storedProducts);
  };

  const getFilteredSales = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return sales.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      
      switch (dateRange) {
        case 'today':
          return saleDate >= today;
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return saleDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return saleDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const filteredSales = getFilteredSales();
  
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalTransactions = filteredSales.length;
  const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const totalTax = filteredSales.reduce((sum, sale) => sum + sale.tax, 0);

  // Top selling products
  const productSales = {};
  filteredSales.forEach(sale => {
    sale.items.forEach(item => {
      if (productSales[item.id]) {
        productSales[item.id].quantity += item.quantity;
        productSales[item.id].revenue += item.quantity * item.price;
      } else {
        productSales[item.id] = {
          name: item.name,
          quantity: item.quantity,
          revenue: item.quantity * item.price
        };
      }
    });
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Daily sales chart data (simplified)
  const getDailySales = () => {
    const dailySales = {};
    filteredSales.forEach(sale => {
      const date = new Date(sale.timestamp).toLocaleDateString();
      dailySales[date] = (dailySales[date] || 0) + sale.total;
    });
    return Object.entries(dailySales).map(([date, total]) => ({ date, total }));
  };

  const dailySalesData = getDailySales();

  const exportToCSV = () => {
    const csvData = [
      ['Date', 'Transaction ID', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment Method'],
      ...filteredSales.map(sale => [
        new Date(sale.timestamp).toLocaleString(),
        sale.id,
        sale.items.map(item => `₹{item.name} (₹{item.quantity})`).join('; '),
        sale.subtotal.toFixed(2),
        sale.tax.toFixed(2),
        sale.total.toFixed(2),
        sale.paymentMethod
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-₹{dateRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
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
              <Calendar className="w-6 h-6 text-orange-600" />
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
              <div key={sale.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Transaction #{sale.id.slice(-6)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(sale.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 capitalize">
                    {sale.paymentMethod}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">₹{sale.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">{sale.items.length} items</p>
                </div>
              </div>
            ))}
            {filteredSales.length === 0 && (
              <p className="text-gray-500 text-center py-4">No transactions found</p>
            )}
          </div>
        </div>
      </div>

      {/* Daily Sales Chart (Simple visualization) */}
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
                <span className="font-bold text-green-600">₹{day.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;