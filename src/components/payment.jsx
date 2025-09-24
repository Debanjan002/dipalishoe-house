import React, { useState, useMemo, useEffect } from 'react';
import { X, CreditCard } from 'lucide-react';

const clamp2 = (n) => Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;

const Payment = ({
  open,
  onClose,
  totals,   // { subtotal, totalDiscount, afterDiscount, tax, cgst, sgst, total, taxRate }
  cart,     // read-only list
  onConfirm // ({ payType, payments:[{mode:'cash'|'upi', amount:number}], amountPaid:number, customerName?:string })
}) => {
  const [payType, setPayType] = useState('PAID');   // 'PAID' | 'DUE'
  const [cashAmt, setCashAmt] = useState('');
  const [upiAmt, setUpiAmt]   = useState('');
  const [customerName, setCustomerName] = useState('');

  // Autofill helpers when modal opens or payType changes
  useEffect(() => {
    if (!open) return;
    if (payType === 'PAID') {
      // default: suggest full in cash
      setCashAmt(totals.total.toFixed(2));
      setUpiAmt('');
    } else {
      setCashAmt('');
      setUpiAmt('');
    }
  }, [open, payType, totals.total]);

  const parsedCash = useMemo(() => clamp2(parseFloat(cashAmt)), [cashAmt]);
  const parsedUpi  = useMemo(() => clamp2(parseFloat(upiAmt)),  [upiAmt]);
  const sum        = useMemo(() => clamp2((parsedCash || 0) + (parsedUpi || 0)), [parsedCash, parsedUpi]);

  // For PAID, allow overpay to give cash change; we assume UPI is exact (no change via UPI)
  const change = useMemo(() => {
    if (payType !== 'PAID') return 0;
    const over = sum - totals.total;
    if (over <= 0) return 0;
    // only cash can generate change; cap change by cash received
    return clamp2(Math.min(parsedCash || 0, over));
  }, [payType, sum, totals.total, parsedCash]);

  // Friendly warnings / validation state
  const errors = useMemo(() => {
    const list = [];
    if (parsedCash < 0 || parsedUpi < 0) list.push('Amounts must be non-negative.');
    if (payType === 'PAID') {
      if (sum < totals.total) list.push('Total paid is less than bill total.');
    } else {
      if (!customerName.trim()) list.push('Customer name is required for DUE.');
      if (sum > totals.total) list.push('Upfront cannot exceed bill total.');
    }
    return list;
  }, [payType, parsedCash, parsedUpi, sum, totals.total, customerName]);

  const canConfirm = errors.length === 0 && (parsedCash > 0 || parsedUpi > 0 || payType === 'DUE');

  const quickFill = (mode) => {
    if (mode === 'cashFull') { setCashAmt(totals.total.toFixed(2)); setUpiAmt(''); }
    if (mode === 'upiFull')  { setCashAmt(''); setUpiAmt(totals.total.toFixed(2)); }
    if (mode === 'splitHalf') {
      const half = clamp2(totals.total / 2);
      setCashAmt(half.toFixed(2));
      setUpiAmt((totals.total - half).toFixed(2));
    }
    if (mode === 'clear') { setCashAmt(''); setUpiAmt(''); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Payment</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Cart summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-28 overflow-y-auto text-sm">
            {cart.map((it) => (
              <div key={`${it.id}-${it.barcode || ''}`} className="flex justify-between">
                <span className="truncate">{it.name} × {it.quantity}</span>
                <span>
                  ₹{(it.price * it.quantity).toFixed(2)}
                  {it.discount > 0 && (
                    <span className="text-green-700 text-xs ml-1">
                      -{it.discountType === 'percentage' ? `${it.discount}%` : `₹${it.discount}`}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Total Discount</span><span>-₹{totals.totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between"><span>After Discount</span><span>₹{totals.afterDiscount.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>CGST ({(totals.taxRate / 2).toFixed(2)}%)</span><span>₹{totals.cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>SGST ({(totals.taxRate / 2).toFixed(2)}%)</span><span>₹{totals.sgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t pt-2">
              <span>Total</span><span>₹{totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
              <select
                value={payType}
                onChange={(e) => setPayType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="PAID">PAID (Full)</option>
                <option value="DUE">DUE (Credit)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quick Fill</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => quickFill('cashFull')} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">All Cash</button>
                <button type="button" onClick={() => quickFill('upiFull')}  className="px-2 py-1 text-xs border rounded hover:bg-gray-50">All UPI</button>
                <button type="button" onClick={() => quickFill('splitHalf')} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">50/50</button>
                <button type="button" onClick={() => quickFill('clear')}     className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Clear</button>
              </div>
            </div>
          </div>

          {payType === 'DUE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Upfront can be split between Cash & UPI. Remaining will be recorded as DUE.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount (₹)</label>
              <input
                type="number" step="0.01" min="0"
                value={cashAmt}
                onChange={(e) => setCashAmt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UPI Amount (₹)</label>
              <input
                type="number" step="0.01" min="0"
                value={upiAmt}
                onChange={(e) => setUpiAmt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="text-sm">
            <div className="flex justify-between">
              <span>Paid Now</span>
              <span className="font-medium">₹{sum.toFixed(2)}</span>
            </div>
            {payType === 'PAID' ? (
              <>
                <div className="flex justify-between">
                  <span>Change (cash)</span>
                  <span className="font-medium text-green-700">₹{change.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining</span>
                  <span className="font-medium">{Math.max(0, totals.total - sum).toFixed(2) === '0.00' ? '—' : `₹${(totals.total - sum).toFixed(2)}`}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>Will be marked as DUE</span>
                <span className="font-medium text-red-600">₹{Math.max(0, totals.total - sum).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
              {errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={() => {
              // Build payments array; exclude zero entries
              const payments = [];
              if (parsedCash > 0) payments.push({ mode: 'cash', amount: parsedCash });
              if (parsedUpi  > 0) payments.push({ mode: 'upi',  amount: parsedUpi  });
              onConfirm({
                payType,
                payments,
                amountPaid: sum,
                customerName: customerName.trim(),
              });
            }}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default Payment;

