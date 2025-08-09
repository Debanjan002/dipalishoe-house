import React, { useState, useEffect } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useSettings } from '../contexts/SettingsContext';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  DollarSign, 
  Printer,
  ShoppingCart,
  X,
  RotateCcw,
  Percent,
  Receipt,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  IndianRupee
} from 'lucide-react';

const POS = () => {
  const { products, updateStock } = useInventory();
  const { shopSettings } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showDirectBill, setShowDirectBill] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [selectedItemForDiscount, setSelectedItemForDiscount] = useState(null);
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [directBillItem, setDirectBillItem] = useState({
    name: '',
    price: '',
    quantity: 1,
    size: '',
    brand: ''
  });
  const [returnData, setReturnData] = useState({
    billNumber: '',
    selectedItems: [],
    reason: '',
    originalSale: null
  });
  const [availableSales, setAvailableSales] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    todaySales: 0,
    todayReturns: 0,
    monthlySales: 0,
    monthlyReturns: 0,
    netSales: 0,
    netMonthlySales: 0
  });

  useEffect(() => {
    if (showReturns) {
      loadAvailableSales();
    }
    calculateDashboardStats();
  }, [showReturns]);

  const calculateDashboardStats = () => {
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const returns = JSON.parse(localStorage.getItem('pos_returns') || '[]');
    
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Calculate today's sales and returns
    const todaySales = sales
      .filter(sale => new Date(sale.timestamp) >= todayStart)
      .reduce((sum, sale) => sum + sale.total, 0);
    
    const todayReturns = returns
      .filter(ret => new Date(ret.timestamp) >= todayStart)
      .reduce((sum, ret) => sum + ret.totalAmount, 0);
    
    // Calculate monthly sales and returns
    const monthlySales = sales
      .filter(sale => new Date(sale.timestamp) >= monthStart)
      .reduce((sum, sale) => sum + sale.total, 0);
    
    const monthlyReturns = returns
      .filter(ret => new Date(ret.timestamp) >= monthStart)
      .reduce((sum, ret) => sum + ret.totalAmount, 0);
    
    setDashboardStats({
      todaySales,
      todayReturns,
      monthlySales,
      monthlyReturns,
      netSales: todaySales - todayReturns,
      netMonthlySales: monthlySales - monthlyReturns
    });
  };

  const loadAvailableSales = () => {
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    setAvailableSales(sales.slice(-20)); // Show last 20 sales
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.includes(searchTerm) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert('Product out of stock!');
      return;
    }
    
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert('Cannot add more items than available stock!');
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1, discount: 0, discountType: 'percentage' }]);
    }
  };

  const updateCartQuantity = (id, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(id);
      return;
    }
    
    const product = products.find(p => p.id === id);
    if (product && newQuantity > product.stock) {
      alert('Cannot exceed available stock!');
      return;
    }
    
    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity: newQuantity } : item
    ));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setShowPayment(false);
    setAmountPaid('');
  };

  const applyDiscount = () => {
    if (!selectedItemForDiscount || !discountValue) return;
    
    const discount = parseFloat(discountValue);
    if (discount < 0) {
      alert('Discount cannot be negative');
      return;
    }
    
    if (discountType === 'percentage' && discount > 100) {
      alert('Percentage discount cannot exceed 100%');
      return;
    }
    
    setCart(cart.map(item =>
      item.id === selectedItemForDiscount.id
        ? { ...item, discount, discountType }
        : item
    ));
    
    setShowDiscount(false);
    setSelectedItemForDiscount(null);
    setDiscountValue('');
  };

  const getItemTotal = (item) => {
    const basePrice = item.price * item.quantity;
    if (item.discount > 0) {
      if (item.discountType === 'percentage') {
        return basePrice - (basePrice * item.discount / 100);
      } else {
        return Math.max(0, basePrice - item.discount);
      }
    }
    return basePrice;
  };

  const subtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
  const cgst = subtotal * (shopSettings.taxRate / 2 / 100);
  const sgst = subtotal * (shopSettings.taxRate / 2 / 100);
  const tax = cgst + sgst;
  const total = subtotal + tax;
  const change = parseFloat(amountPaid) - total;
  const totalDiscount = cart.reduce((sum, item) => {
    const basePrice = item.price * item.quantity;
    return sum + (basePrice - getItemTotal(item));
  }, 0);

  const addDirectBillItem = () => {
    if (!directBillItem.name || !directBillItem.price) {
      alert('Please enter item name and price');
      return;
    }

    const item = {
      id: `direct_${Date.now()}`,
      name: directBillItem.name,
      price: parseFloat(directBillItem.price),
      quantity: directBillItem.quantity,
      size: directBillItem.size,
      brand: directBillItem.brand,
      category: 'Direct Bill',
      isDirect: true,
      discount: 0,
      discountType: 'percentage'
    };

    setCart([...cart, item]);
    setDirectBillItem({ name: '', price: '', quantity: 1, size: '', brand: '' });
    setShowDirectBill(false);
  };

  const selectSaleForReturn = (sale) => {
    setReturnData({
      ...returnData,
      billNumber: sale.billNumber,
      originalSale: sale,
      selectedItems: []
    });
  };

  const toggleItemForReturn = (item) => {
    const isSelected = returnData.selectedItems.find(i => i.id === item.id);
    if (isSelected) {
      setReturnData({
        ...returnData,
        selectedItems: returnData.selectedItems.filter(i => i.id !== item.id)
      });
    } else {
      setReturnData({
        ...returnData,
        selectedItems: [...returnData.selectedItems, { ...item, returnQuantity: 1 }]
      });
    }
  };

  const updateReturnQuantity = (itemId, quantity) => {
    setReturnData({
      ...returnData,
      selectedItems: returnData.selectedItems.map(item =>
        item.id === itemId ? { ...item, returnQuantity: Math.min(quantity, item.quantity) } : item
      )
    });
  };

  const processReturn = () => {
    if (!returnData.billNumber || returnData.selectedItems.length === 0) {
      alert('Please select a bill and items to return');
      return;
    }

    const returns = JSON.parse(localStorage.getItem('pos_returns') || '[]');
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    
    const returnRecord = {
      id: Date.now().toString(),
      originalBillNumber: returnData.billNumber,
      returnItems: returnData.selectedItems,
      reason: returnData.reason,
      timestamp: new Date().toISOString(),
      cashier: 'Current User',
      returnBillNumber: `RET${Date.now().toString().slice(-6)}`,
      totalAmount: returnData.selectedItems.reduce((sum, item) => sum + (item.price * item.returnQuantity), 0)
    };

    // Update stock for returned items
    returnData.selectedItems.forEach(item => {
      if (!item.isDirect) {
        const product = products.find(p => p.id === item.id);
        if (product) {
          updateStock(item.id, product.stock + item.returnQuantity);
        }
      }
    });

    // Update original sale to remove returned items
    const updatedSales = sales.map(sale => {
      if (sale.billNumber === returnData.billNumber) {
        const updatedItems = sale.items.map(saleItem => {
          const returnItem = returnData.selectedItems.find(ri => ri.id === saleItem.id);
          if (returnItem) {
            return {
              ...saleItem,
              quantity: saleItem.quantity - returnItem.returnQuantity,
              returned: (saleItem.returned || 0) + returnItem.returnQuantity
            };
          }
          return saleItem;
        }).filter(item => item.quantity > 0); // Remove items with 0 quantity

        // Recalculate sale totals
        const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const newCgst = newSubtotal * (shopSettings.taxRate / 2 / 100);
        const newSgst = newSubtotal * (shopSettings.taxRate / 2 / 100);
        const newTax = newCgst + newSgst;
        const newTotal = newSubtotal + newTax;

        return {
          ...sale,
          items: updatedItems,
          subtotal: newSubtotal,
          cgst: newCgst,
          sgst: newSgst,
          tax: newTax,
          total: newTotal,
          returnAmount: (sale.returnAmount || 0) + returnRecord.totalAmount
        };
      }
      return sale;
    });

    returns.push(returnRecord);
    localStorage.setItem('pos_returns', JSON.stringify(returns));
    localStorage.setItem('pos_sales', JSON.stringify(updatedSales));

    // Print return receipt
    printReturnReceipt(returnRecord);

    setShowReturns(false);
    setReturnData({ billNumber: '', selectedItems: [], reason: '', originalSale: null });
    calculateDashboardStats();
    alert('Return processed successfully!');
  };

  const completeSale = () => {
    if (parseFloat(amountPaid) < total) {
      alert('Insufficient payment amount');
      return;
    }

    // Update stock for each item (except direct bill items)
    cart.forEach(item => {
      if (!item.isDirect) {
        updateStock(item.id, item.stock - item.quantity);
      }
    });

    // Store sale in localStorage
    const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
    const sale = {
      id: Date.now().toString(),
      items: cart,
      subtotal,
      cgst,
      sgst,
      tax,
      total,
      totalDiscount,
      paymentMethod,
      amountPaid: parseFloat(amountPaid),
      change,
      timestamp: new Date().toISOString(),
      cashier: 'Current User',
      billNumber: `INV${Date.now().toString().slice(-6)}`,
      returnAmount: 0
    };
    sales.push(sale);
    localStorage.setItem('pos_sales', JSON.stringify(sales));

    // Print receipt
    printReceipt(sale);

    // Clear cart and update stats
    clearCart();
    calculateDashboardStats();
    alert('Sale completed successfully!');
  };

  const printReceipt = (sale) => {
    const receiptWindow = window.open('', '_blank');
    const { receiptFormat } = JSON.parse(localStorage.getItem('pos_printer_settings') || '{}');
    const format = receiptFormat || {};
    
    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap');
            
            body { 
              font-family: ${format.fontFamily || "'Inter', 'Roboto', sans-serif"}; 
              font-size: ${format.fontSize || '8px'}; 
              margin: 0; 
              padding: 5px; 
              width: 40mm;
              line-height: 1.3;
              color: #000;
              background: #fff;
            }
            .center { text-align: center; }
            .left { text-align: left; }
            .right { text-align: right; }
            .line { border-bottom: 1px dashed #000; margin: 3px 0; }
            .double-line { border-bottom: 2px solid #000; margin: 3px 0; }
            table { width: 100%; font-size: ${format.fontSize || '8px'}; border-collapse: collapse; }
            th, td { padding: 1px 2px; vertical-align: top; }
            .header { 
              font-size: ${format.headerFontSize || '10px'}; 
              font-weight: 700; 
              margin-bottom: 2px;
              font-family: 'Inter', sans-serif;
            }
            .sub-header { font-size: 8px; margin-bottom: 1px; }
            .footer { 
              font-size: ${format.footerFontSize || '7px'}; 
              margin-top: 2px;
            }
            .footer-image { 
              text-align: ${format.footerImagePosition || 'center'}; 
              margin: 5px 0; 
            }
            .small { font-size: 7px; }
            .medium { font-size: 8px; font-weight: 500; }
            .large { font-size: 10px; font-weight: 600; }
            .bold { font-weight: 600; }
            .discount-text { color: #666; font-style: italic; }
            .gst-text { color: #555; }
            .total-section { margin-top: 5px; padding-top: 3px; border-top: 1px solid #000; }
            
            /* Professional styling */
            .shop-header { 
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white;
              padding: 8px 4px;
              margin: -5px -5px 8px -5px;
              border-radius: 0 0 8px 8px;
            }
            .bill-info { 
              background: #f8fafc;
              padding: 4px;
              border-radius: 4px;
              margin: 4px 0;
            }
            .item-row { border-bottom: 1px dotted #e2e8f0; }
            .amount-highlight { 
              background: #dcfce7;
              padding: 2px 4px;
              border-radius: 3px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="shop-header center">
            <div class="header">${shopSettings.name}</div>
            <div class="small">${shopSettings.address}</div>
          </div>
          
          <div class="center">
            <div class="small">Ph: ${shopSettings.phone} | Email: ${shopSettings.email}</div>
            ${shopSettings.gstNumber ? `<div class="small">GSTIN: ${shopSettings.gstNumber}</div>` : ''}
            <div class="line"></div>
            <div class="header">TAX INVOICE</div>
          </div>
          
          <div class="bill-info small">
            <div><strong>Bill:</strong> ${sale.billNumber}</div>
            <div><strong>Date:</strong> ${new Date(sale.timestamp).toLocaleString('en-IN')}</div>
            <div><strong>Cashier:</strong> ${sale.cashier}</div>
          </div>
          <div class="line"></div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align: left; font-size: 7px; font-weight: 600;">Item</th>
                <th style="text-align: center; font-size: 7px; font-weight: 600;">Qty</th>
                <th style="text-align: right; font-size: 7px; font-weight: 600;">Rate</th>
                <th style="text-align: right; font-size: 7px; font-weight: 600;">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => `
                <tr class="item-row">
                  <td style="font-size: 7px;">${item.name}${item.size ? ` (${item.size})` : ''}</td>
                  <td class="center" style="font-size: 7px;">${item.quantity}</td>
                  <td class="right" style="font-size: 7px;">₹${item.price.toFixed(2)}</td>
                  <td class="right" style="font-size: 7px;">₹${getItemTotal(item).toFixed(2)}</td>
                </tr>
                ${item.discount > 0 ? `
                  <tr>
                    <td colspan="3" class="small discount-text">Discount (${item.discountType === 'percentage' ? item.discount + '%' : '₹' + item.discount})</td>
                    <td class="right small discount-text">-₹${((item.price * item.quantity) - getItemTotal(item)).toFixed(2)}</td>
                  </tr>
                ` : ''}
              `).join('')}
            </tbody>
          </table>
          <div class="line"></div>
          
          <div class="total-section">
            <table>
              <tr><td class="small">Subtotal:</td><td class="right small">₹${sale.subtotal.toFixed(2)}</td></tr>
              ${sale.totalDiscount > 0 ? `<tr><td class="small">Total Discount:</td><td class="right small" style="color: #059669;">-₹${sale.totalDiscount.toFixed(2)}</td></tr>` : ''}
              <tr><td class="small gst-text">CGST (${shopSettings.taxRate/2}%):</td><td class="right small gst-text">₹${sale.cgst.toFixed(2)}</td></tr>
              <tr><td class="small gst-text">SGST (${shopSettings.taxRate/2}%):</td><td class="right small gst-text">₹${sale.sgst.toFixed(2)}</td></tr>
              <tr class="double-line">
                <td class="medium bold">TOTAL:</td>
                <td class="right amount-highlight">₹${sale.total.toFixed(2)}</td>
              </tr>
              <tr><td class="small">Paid (${sale.paymentMethod}):</td><td class="right small">₹${sale.amountPaid.toFixed(2)}</td></tr>
              <tr><td class="small">Change:</td><td class="right small">₹${sale.change.toFixed(2)}</td></tr>
            </table>
          </div>
          <div class="line"></div>
          
          ${format.customMessage ? `<div class="center footer">${format.customMessage}</div>` : ''}
          ${format.footerImage ? `
            <div class="footer-image">
              <img src="${format.footerImage}" 
                   style="width: ${format.footerImageSize?.width || 30}px; height: ${format.footerImageSize?.height || 15}px;" />
            </div>
          ` : ''}
          
          <div class="center">
            <div class="footer">${format.footerText || 'धन्यवाद! Thank you for shopping!'}</div>
            <div class="footer">फिर आइएगा! Visit again soon!</div>
            <div class="small" style="margin-top: 8px; color: #6b7280;">Powered by Sharma POS System</div>
          </div>
        </body>
      </html>
    `);
    receiptWindow.print();
  };

  const printReturnReceipt = (returnRecord) => {
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
      <html>
        <head>
          <title>Return Receipt</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            body { 
              font-family: 'Inter', sans-serif; 
              font-size: 8px; 
              margin: 0; 
              padding: 5px; 
              width: 40mm;
              line-height: 1.3;
              color: #000;
            }
            .center { text-align: center; }
            .left { text-align: left; }
            .right { text-align: right; }
            .line { border-bottom: 1px dashed #000; margin: 3px 0; }
            table { width: 100%; font-size: 8px; border-collapse: collapse; }
            th, td { padding: 1px 2px; }
            .header { font-size: 10px; font-weight: 700; }
            .small { font-size: 7px; }
            .return-header { 
              background: #fef3c7;
              color: #92400e;
              padding: 6px 4px;
              margin: -5px -5px 6px -5px;
              border-radius: 0 0 6px 6px;
              border: 2px solid #f59e0b;
            }
          </style>
        </head>
        <body>
          <div class="return-header center">
            <div class="header">${shopSettings.name}</div>
            <div class="small">${shopSettings.address}</div>
            <div class="header" style="color: #dc2626; margin-top: 4px;">RETURN RECEIPT</div>
          </div>
          
          <div class="left small">
            <div><strong>Return Bill:</strong> ${returnRecord.returnBillNumber}</div>
            <div><strong>Original Bill:</strong> ${returnRecord.originalBillNumber}</div>
            <div><strong>Date:</strong> ${new Date(returnRecord.timestamp).toLocaleString('en-IN')}</div>
            <div><strong>Reason:</strong> ${returnRecord.reason}</div>
          </div>
          <div class="line"></div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${returnRecord.returnItems.map(item => `
                <tr>
                  <td style="font-size: 7px;">${item.name}</td>
                  <td class="center" style="font-size: 7px;">${item.returnQuantity}</td>
                  <td class="right" style="font-size: 7px;">₹${(item.price * item.returnQuantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="line"></div>
          
          <div class="center">
            <div style="background: #dcfce7; padding: 4px; border-radius: 4px; margin: 4px 0;">
              <strong style="font-size: 9px;">Total Refund: ₹${returnRecord.totalAmount.toFixed(2)}</strong>
            </div>
          </div>
          <div class="line"></div>
          
          <div class="center small">
            <div>Items returned successfully</div>
            <div>Stock updated automatically</div>
            <div style="margin-top: 6px;">धन्यवाद! Thank you!</div>
          </div>
        </body>
      </html>
    `);
    receiptWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Today's Sales</p>
              <p className="text-2xl font-bold">₹{dashboardStats.todaySales.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Today's Returns</p>
              <p className="text-2xl font-bold">₹{dashboardStats.todayReturns.toFixed(2)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Net Today</p>
              <p className="text-2xl font-bold">₹{dashboardStats.netSales.toFixed(2)}</p>
            </div>
            <IndianRupee className="w-8 h-8 text-green-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-sm p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Monthly Net</p>
              <p className="text-2xl font-bold">₹{dashboardStats.netMonthlySales.toFixed(2)}</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search shoes by name, brand, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setShowDirectBill(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Direct Bill Item
              </button>
              <button
                onClick={() => setShowReturns(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Process Return
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer ${
                    product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-1">{product.brand} - {product.category}</p>
                  {product.size && <p className="text-xs text-gray-500 mb-2">Size: {product.size}</p>}
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-blue-600">
                      ₹{product.price.toFixed(2)}
                    </span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      product.stock > 10 
                        ? 'bg-green-100 text-green-800' 
                        : product.stock > 0 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      Stock: {product.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Direct Bill Modal */}
        {showDirectBill && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold">Add Direct Bill Item</h2>
                <button
                  onClick={() => setShowDirectBill(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={directBillItem.name}
                    onChange={(e) => setDirectBillItem({...directBillItem, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Custom Leather Shoes"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={directBillItem.price}
                      onChange={(e) => setDirectBillItem({...directBillItem, price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="2999"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={directBillItem.quantity}
                      onChange={(e) => setDirectBillItem({...directBillItem, quantity: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      value={directBillItem.brand}
                      onChange={(e) => setDirectBillItem({...directBillItem, brand: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nike, Adidas"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Size
                    </label>
                    <input
                      type="text"
                      value={directBillItem.size}
                      onChange={(e) => setDirectBillItem({...directBillItem, size: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="7, 8, 9, 10"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowDirectBill(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addDirectBillItem}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Returns Modal */}
        {showReturns && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-90vh overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold">Process Return</h2>
                <button
                  onClick={() => setShowReturns(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {!returnData.originalSale ? (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Select Sale to Return</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {availableSales.map((sale) => (
                        <div
                          key={sale.id}
                          onClick={() => selectSaleForReturn(sale)}
                          className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Bill: {sale.billNumber}</p>
                              <p className="text-sm text-gray-600">
                                Date: {new Date(sale.timestamp).toLocaleString('en-IN')}
                              </p>
                              <p className="text-sm text-gray-600">
                                Items: {sale.items.length} | Total: ₹{sale.total.toFixed(2)}
                              </p>
                              {sale.returnAmount > 0 && (
                                <p className="text-sm text-orange-600">
                                  Previous Returns: ₹{sale.returnAmount.toFixed(2)}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Payment: {sale.paymentMethod}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-medium text-blue-900">Selected Sale</h3>
                      <p className="text-blue-800">Bill: {returnData.billNumber}</p>
                      <p className="text-sm text-blue-700">
                        Date: {new Date(returnData.originalSale.timestamp).toLocaleString('en-IN')}
                      </p>
                      <p className="text-sm text-blue-700">
                        Original Total: ₹{returnData.originalSale.total.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Select Items to Return</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {returnData.originalSale.items.map((item) => {
                          const isSelected = returnData.selectedItems.find(i => i.id === item.id);
                          const availableQty = item.quantity - (item.returned || 0);
                          
                          if (availableQty <= 0) return null;
                          
                          return (
                            <div
                              key={item.id}
                              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => toggleItemForReturn(item)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                  }`}>
                                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                  </div>
                                  <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-gray-600">
                                      Available: {availableQty} | Price: ₹{item.price}
                                    </p>
                                    {item.returned > 0 && (
                                      <p className="text-xs text-orange-600">
                                        Previously returned: {item.returned}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="flex items-center gap-2">
                                    <label className="text-sm">Return Qty:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={availableQty}
                                      value={isSelected.returnQuantity}
                                      onChange={(e) => updateReturnQuantity(item.id, parseInt(e.target.value))}
                                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Return Reason
                      </label>
                      <select
                        value={returnData.reason}
                        onChange={(e) => setReturnData({...returnData, reason: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select Reason</option>
                        <option value="Defective Product">Defective Product</option>
                        <option value="Wrong Size">Wrong Size</option>
                        <option value="Customer Changed Mind">Customer Changed Mind</option>
                        <option value="Damaged During Delivery">Damaged During Delivery</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {returnData.selectedItems.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-2">Return Summary</h4>
                        <div className="space-y-1">
                          {returnData.selectedItems.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.name} (Qty: {item.returnQuantity})</span>
                              <span>₹{(item.price * item.returnQuantity).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-2 font-medium">
                            <div className="flex justify-between">
                              <span>Total Refund:</span>
                              <span>₹{returnData.selectedItems.reduce((sum, item) => sum + (item.price * item.returnQuantity), 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setReturnData({ billNumber: '', selectedItems: [], reason: '', originalSale: null })}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Back to Sales
                      </button>
                      <button
                        onClick={processReturn}
                        disabled={returnData.selectedItems.length === 0}
                        className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Process Return
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Discount Modal */}
        {showDiscount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold">Apply Discount</h2>
                <button
                  onClick={() => setShowDiscount(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Item: {selectedItemForDiscount?.name}
                  </label>
                  <p className="text-sm text-gray-600">
                    Original Price: ₹{selectedItemForDiscount?.price} × {selectedItemForDiscount?.quantity}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDiscountType('percentage')}
                      className={`p-3 rounded-lg border transition-colors ${
                        discountType === 'percentage'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Percent className="w-4 h-4 mx-auto mb-1" />
                      Percentage
                    </button>
                    <button
                      onClick={() => setDiscountType('fixed')}
                      className={`p-3 rounded-lg border transition-colors ${
                        discountType === 'fixed'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 mx-auto mb-1" />
                      Fixed Amount
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={discountType === 'percentage' ? '10' : '100'}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowDiscount(false)}
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

        {/* Cart and Payment */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Shopping Cart</h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="ml-auto text-red-600 hover:text-red-700 text-sm"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Cart is empty</p>
              ) : (
                cart.map((item) => (
                  <div key={`${item.id}-${Date.now()}`} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-sm text-gray-600">₹{item.price.toFixed(2)} each</p>
                      {item.discount > 0 && (
                        <p className="text-xs text-green-600">
                          Discount: {item.discountType === 'percentage' ? `${item.discount}%` : `₹${item.discount}`}
                        </p>
                      )}
                      <p className="text-sm font-medium text-blue-600">
                        Total: ₹{getItemTotal(item).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        className="p-1 rounded text-gray-600 hover:bg-gray-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        className="p-1 rounded text-gray-600 hover:bg-gray-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedItemForDiscount(item);
                          setDiscountValue(item.discount.toString());
                          setDiscountType(item.discountType);
                          setShowDiscount(true);
                        }}
                        className="p-1 rounded text-green-600 hover:bg-green-100 ml-1"
                        title="Apply Discount"
                      >
                        <Percent className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 rounded text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{(subtotal + totalDiscount).toFixed(2)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Total Discount:</span>
                    <span>-₹{totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>After Discount:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST ({shopSettings.taxRate/2}%):</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST ({shopSettings.taxRate/2}%):</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Section */}
          {cart.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Payment</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        paymentMethod === 'cash'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        paymentMethod === 'card'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      Card
                    </button>
                    <button
                      onClick={() => setPaymentMethod('upi')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                        paymentMethod === 'upi'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Receipt className="w-4 h-4" />
                      UPI
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {amountPaid && parseFloat(amountPaid) >= total && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between font-medium">
                      <span>Change:</span>
                      <span className="text-green-600">₹{change.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={completeSale}
                  disabled={!amountPaid || parseFloat(amountPaid) < total}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-5 h-5" />
                  Complete Sale & Print
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POS;