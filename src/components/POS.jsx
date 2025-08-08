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
  CheckCircle
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

  useEffect(() => {
    if (showReturns) {
      loadAvailableSales();
    }
  }, [showReturns]);

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

    returns.push(returnRecord);
    localStorage.setItem('pos_returns', JSON.stringify(returns));

    // Print return receipt
    printReturnReceipt(returnRecord);

    setShowReturns(false);
    setReturnData({ billNumber: '', selectedItems: [], reason: '', originalSale: null });
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
      billNumber: `INV${Date.now().toString().slice(-6)}`
    };
    sales.push(sale);
    localStorage.setItem('pos_sales', JSON.stringify(sales));

    // Print receipt
    printReceipt(sale);

    // Clear cart
    clearCart();
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
            body { 
              font-family: ${format.fontFamily || 'monospace'}; 
              font-size: ${format.fontSize || '8px'}; 
              margin: 0; 
              padding: 5px; 
              width: 40mm;
              line-height: 1.2;
            }
            .center { text-align: center; }
            .left { text-align: left; }
            .right { text-align: right; }
            .line { border-bottom: 1px dashed #000; margin: 3px 0; }
            table { width: 100%; font-size: ${format.fontSize || '8px'}; }
            .header { font-size: ${format.headerFontSize || '10px'}; font-weight: bold; }
            .footer { font-size: ${format.footerFontSize || '7px'}; }
            .footer-image { 
              text-align: ${format.footerImagePosition || 'center'}; 
              margin: 5px 0; 
            }
            .small { font-size: 7px; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="header">${shopSettings.name}</div>
            <div class="small">${shopSettings.address}</div>
            <div class="small">${shopSettings.phone}</div>
            <div class="small">Email: ${shopSettings.email}</div>
            ${shopSettings.gstNumber ? `<div class="small">GSTIN: ${shopSettings.gstNumber}</div>` : ''}
            <div class="line"></div>
            <div class="header">${format.headerText || 'CASH BILL'}</div>
          </div>
          <div class="left small">
            <div>Bill: ${sale.billNumber}</div>
            <div>Date: ${new Date(sale.timestamp).toLocaleString('en-IN')}</div>
            <div>Cashier: ${sale.cashier}</div>
          </div>
          <div class="line"></div>
          <table>
            <tr>
              <th style="text-align: left; font-size: 7px;">Item</th>
              <th style="text-align: center; font-size: 7px;">Qty</th>
              <th style="text-align: right; font-size: 7px;">Rate</th>
              <th style="text-align: right; font-size: 7px;">Amt</th>
            </tr>
            ${sale.items.map(item => `
              <tr>
                <td style="font-size: 7px;">${item.name}${item.size ? ` (${item.size})` : ''}</td>
                <td class="center" style="font-size: 7px;">${item.quantity}</td>
                <td class="right" style="font-size: 7px;">₹${item.price.toFixed(2)}</td>
                <td class="right" style="font-size: 7px;">₹${getItemTotal(item).toFixed(2)}</td>
              </tr>
              ${item.discount > 0 ? `
                <tr>
                  <td colspan="3" style="font-size: 6px; color: #666;">Discount (${item.discountType === 'percentage' ? item.discount + '%' : '₹' + item.discount})</td>
                  <td class="right" style="font-size: 6px; color: #666;">-₹${((item.price * item.quantity) - getItemTotal(item)).toFixed(2)}</td>
                </tr>
              ` : ''}
            `).join('')}
          </table>
          <div class="line"></div>
          <table>
            <tr><td style="font-size: 7px;">Subtotal:</td><td class="right" style="font-size: 7px;">₹${sale.subtotal.toFixed(2)}</td></tr>
            ${sale.totalDiscount > 0 ? `<tr><td style="font-size: 7px;">Total Discount:</td><td class="right" style="font-size: 7px; color: green;">-₹${sale.totalDiscount.toFixed(2)}</td></tr>` : ''}
            ${format.showGST ? `
              <tr><td style="font-size: 7px;">CGST (${shopSettings.taxRate/2}%):</td><td class="right" style="font-size: 7px;">₹${sale.cgst.toFixed(2)}</td></tr>
              <tr><td style="font-size: 7px;">SGST (${shopSettings.taxRate/2}%):</td><td class="right" style="font-size: 7px;">₹${sale.sgst.toFixed(2)}</td></tr>
            ` : `
              <tr><td style="font-size: 7px;">GST (${shopSettings.taxRate}%):</td><td class="right" style="font-size: 7px;">₹${sale.tax.toFixed(2)}</td></tr>
            `}
            <tr><td style="font-size: 8px;"><strong>Total:</strong></td><td class="right" style="font-size: 8px;"><strong>₹${sale.total.toFixed(2)}</strong></td></tr>
            <tr><td style="font-size: 7px;">Paid (${sale.paymentMethod}):</td><td class="right" style="font-size: 7px;">₹${sale.amountPaid.toFixed(2)}</td></tr>
            <tr><td style="font-size: 7px;">Change:</td><td class="right" style="font-size: 7px;">₹${sale.change.toFixed(2)}</td></tr>
          </table>
          <div class="line"></div>
          ${format.customMessage ? `<div class="center footer">${format.customMessage}</div>` : ''}
          ${format.footerImage ? `
            <div class="footer-image">
              <img src="${format.footerImage}" 
                   style="width: ${format.footerImageSize?.width || 30}px; height: ${format.footerImageSize?.height || 15}px;" />
            </div>
          ` : ''}
          <div class="center">
            <div class="footer">${format.footerText || 'Thank you for shopping!'}</div>
            <div class="footer">Visit again soon!</div>
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
            body { 
              font-family: monospace; 
              font-size: 8px; 
              margin: 0; 
              padding: 5px; 
              width: 40mm;
              line-height: 1.2;
            }
            .center { text-align: center; }
            .left { text-align: left; }
            .right { text-align: right; }
            .line { border-bottom: 1px dashed #000; margin: 3px 0; }
            table { width: 100%; font-size: 8px; }
            .header { font-size: 10px; font-weight: bold; }
            .small { font-size: 7px; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="header">${shopSettings.name}</div>
            <div class="small">${shopSettings.address}</div>
            <div class="header" style="color: red;">RETURN RECEIPT</div>
          </div>
          <div class="left small">
            <div>Return Bill: ${returnRecord.returnBillNumber}</div>
            <div>Original Bill: ${returnRecord.originalBillNumber}</div>
            <div>Date: ${new Date(returnRecord.timestamp).toLocaleString('en-IN')}</div>
            <div>Reason: ${returnRecord.reason}</div>
          </div>
          <div class="line"></div>
          <table>
            <tr>
              <th style="text-align: left;">Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Amount</th>
            </tr>
            ${returnRecord.returnItems.map(item => `
              <tr>
                <td>${item.name}</td>
                <td class="center">${item.returnQuantity}</td>
                <td class="right">₹${(item.price * item.returnQuantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
          <div class="line"></div>
          <div class="center">
            <div><strong>Total Refund: ₹${returnRecord.totalAmount.toFixed(2)}</strong></div>
          </div>
          <div class="line"></div>
          <div class="center small">
            <div>Items returned successfully</div>
            <div>Thank you!</div>
          </div>
        </body>
      </html>
    `);
    receiptWindow.print();
  };

  return (
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
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Select Items to Return</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {returnData.originalSale.items.map((item) => {
                        const isSelected = returnData.selectedItems.find(i => i.id === item.id);
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
                                    Qty: {item.quantity} | Price: ₹{item.price}
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <label className="text-sm">Return Qty:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.quantity}
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
  );
};

export default POS;