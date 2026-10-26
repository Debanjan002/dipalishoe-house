import React, { useState, useMemo, useEffect, useRef } from 'react';



import { X, CreditCard, QrCode, CheckCircle, ArrowLeft } from 'lucide-react';







const UPI_ID = 'BHARATPE.9T0W0M0B7E407332@unitype';



const PAYEE_NAME = 'Sudip Hui';







let qrLibraryPromise;







const loadQRCodeLibrary = () => {



  if (window.QRCode) return Promise.resolve(window.QRCode);



  if (qrLibraryPromise) return qrLibraryPromise;







  qrLibraryPromise = new Promise((resolve, reject) => {



    const existing = document.querySelector(



      'script[data-upi-qrcode="true"]'



    );







    const script = existing || document.createElement('script');







    const handleLoad = () => {



      if (window.QRCode) {



        resolve(window.QRCode);



      } else {



        qrLibraryPromise = null;



        reject(new Error('QR library failed to initialize.'));



      }



    };







    const handleError = () => {



      qrLibraryPromise = null;



      reject(new Error('Unable to load the QR library.'));



    };







    script.addEventListener('load', handleLoad, { once: true });



    script.addEventListener('error', handleError, { once: true });







    if (!existing) {



      script.src =



        'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';



      script.async = true;



      script.dataset.upiQrcode = 'true';



      document.head.appendChild(script);



    }



  });







  return qrLibraryPromise;



};







const createUPILink = (amount) =>



  'upi://pay?' +



  new URLSearchParams({



    pa: UPI_ID,



    pn: PAYEE_NAME,



    am: Number(amount).toFixed(2),



    cu: 'INR',



  }).toString();







const clamp2 = (n) =>



  Number.isFinite(n)



    ? Math.max(0, Math.round(n * 100) / 100)



    : 0;







const formatAmount = (amount) =>



  `₹${Number(amount || 0).toLocaleString('en-IN', {



    minimumFractionDigits: 2,



    maximumFractionDigits: 2,



  })}`;







const Payment = ({



  open,



  onClose,



  totals,



  cart,



  onConfirm,



}) => {



  const [payType, setPayType] = useState('PAID');



  const [cashAmt, setCashAmt] = useState('');



  const [upiAmt, setUpiAmt] = useState('');



  const [customerName, setCustomerName] = useState('');



  const [showUpiQR, setShowUpiQR] = useState(false);



  const [qrError, setQrError] = useState('');



  const [submitting, setSubmitting] = useState(false);







  const qrRef = useRef(null);



  const submittedRef = useRef(false);







  useEffect(() => {



    if (!open) return;







    setPayType('PAID');



    setCashAmt(totals.total.toFixed(2));



    setUpiAmt('');



    setCustomerName('');



    setShowUpiQR(false);



    setQrError('');



    setSubmitting(false);



    submittedRef.current = false;



  }, [open, totals.total]);







  const parsedCash = useMemo(



    () => clamp2(Number.parseFloat(cashAmt)),



    [cashAmt]



  );







  const parsedUpi = useMemo(



    () => clamp2(Number.parseFloat(upiAmt)),



    [upiAmt]



  );







  const sum = useMemo(



    () => clamp2(parsedCash + parsedUpi),



    [parsedCash, parsedUpi]



  );







  const change = useMemo(() => {



    if (payType !== 'PAID') return 0;







    return clamp2(



      Math.min(parsedCash, Math.max(0, sum - totals.total))



    );



  }, [payType, parsedCash, sum, totals.total]);







  const errors = useMemo(() => {



    const list = [];







    if (



      (cashAmt.trim() !== '' && !Number.isFinite(Number(cashAmt))) ||



      (upiAmt.trim() !== '' && !Number.isFinite(Number(upiAmt)))



    ) {



      list.push('Enter valid payment amounts.');



    }







    if (parsedCash < 0 || parsedUpi < 0) {



      list.push('Amounts cannot be negative.');



    }







    if (payType === 'PAID') {



      if (sum < totals.total) {



        list.push('Total paid is less than the bill total.');



      }







      if (parsedUpi > 0 && parsedUpi > totals.total) {



        list.push('UPI amount cannot exceed the bill total.');



      }



    } else {



      if (!customerName.trim()) {



        list.push('Customer name is required for DUE.');



      }







      if (sum > totals.total) {



        list.push('Upfront payment cannot exceed the bill total.');



      }



    }







    return list;



  }, [



    cashAmt,



    upiAmt,



    parsedCash,



    parsedUpi,



    payType,



    sum,



    totals.total,



    customerName,



  ]);







  const canConfirm =



    errors.length === 0 &&



    (parsedCash > 0 || parsedUpi > 0 || payType === 'DUE');







  const buildPayload = () => {



    const payments = [];







    if (parsedCash > 0) {



      payments.push({ mode: 'cash', amount: parsedCash });



    }







    if (parsedUpi > 0) {



      payments.push({ mode: 'upi', amount: parsedUpi });



    }







    return {



      payType,



      payments,



      amountPaid: sum,



      customerName: customerName.trim(),



    };



  };







  const quickFill = (mode) => {



    if (mode === 'cashFull') {



      setCashAmt(totals.total.toFixed(2));



      setUpiAmt('');



    }







    if (mode === 'upiFull') {



      setCashAmt('');



      setUpiAmt(totals.total.toFixed(2));



    }







    if (mode === 'splitHalf') {



      const half = clamp2(totals.total / 2);



      setCashAmt(half.toFixed(2));



      setUpiAmt(clamp2(totals.total - half).toFixed(2));



    }







    if (mode === 'clear') {



      setCashAmt('');



      setUpiAmt('');



    }



  };







  // Render the QR locally in the browser.



  useEffect(() => {



    if (!open || !showUpiQR || parsedUpi <= 0) return;







    let cancelled = false;







    const renderQR = async () => {



      setQrError('');







      try {



        const QRCode = await loadQRCodeLibrary();







        if (cancelled || !qrRef.current) return;







        qrRef.current.innerHTML = '';







        new QRCode(qrRef.current, {



          text: createUPILink(parsedUpi),



          width: 220,



          height: 220,



          correctLevel: QRCode.CorrectLevel.H,



        });



      } catch {



        if (!cancelled) {



          setQrError(



            'Could not generate the QR. Check your internet connection and try again.'



          );



        }



      }



    };







    renderQR();







    return () => {



      cancelled = true;



    };



  }, [open, showUpiQR, parsedUpi]);







  const handlePayTypeChange = (nextPayType) => {
    setPayType(nextPayType);

    if (nextPayType === 'DUE') {
      // DUE starts with zero upfront payment; users can still edit these amounts.
      setCashAmt('0');
      setUpiAmt('0');
      setShowUpiQR(false);
      setQrError('');
    } else {
      setCashAmt(totals.total.toFixed(2));
      setUpiAmt('');
      setShowUpiQR(false);
      setQrError('');
    }
  };

  const handleConfirm = () => {



    if (!canConfirm || submitting || submittedRef.current) return;







    // UPI payments require the manual confirmation screen first.



    if (parsedUpi > 0 && !showUpiQR) {



      setQrError('');



      setShowUpiQR(true);



      return;



    }







    // Prevent accidental double submission.



    submittedRef.current = true;



    setSubmitting(true);







    try {



      // Calls the existing POS processSale() through onConfirm.



      onConfirm(buildPayload());



    } catch (error) {



      submittedRef.current = false;



      setSubmitting(false);



      setQrError('Could not complete the sale. Please try again.');



    }



  };







  useEffect(() => {
    if (!open) return;

    const handlePaymentEnter = (event) => {
      if (
        event.key !== 'Enter' ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey
      ) return;

      const tagName = event.target?.tagName?.toUpperCase();
      if (tagName === 'SELECT' || tagName === 'TEXTAREA') return;

      event.preventDefault();
      handleConfirm();
    };

    window.addEventListener('keydown', handlePaymentEnter);
    return () => window.removeEventListener('keydown', handlePaymentEnter);
  }, [open, canConfirm, submitting, parsedUpi, showUpiQR, errors, cashAmt, upiAmt, customerName, payType, totals.total]);

  if (!open) return null;







  return (



    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020617]/80 p-3 backdrop-blur-sm sm:p-6">



      <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl border border-slate-700 bg-[#0b1220] shadow-2xl shadow-black/50">







        {/* Header */}



        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-[#0b1220]/95 px-5 py-4 backdrop-blur sm:px-8">



          <div className="flex items-center gap-3">



            {showUpiQR ? (



              <QrCode className="h-5 w-5 text-cyan-400" />



            ) : (



              <CreditCard className="h-5 w-5 text-cyan-400" />



            )}







            <h2 className="text-lg font-bold tracking-tight text-slate-100">



              {showUpiQR ? 'UPI Payment' : 'Payment'}



            </h2>



          </div>







          <button



            type="button"



            onClick={() => {



              if (submitting) return;







              if (showUpiQR) {



                setShowUpiQR(false);



                setQrError('');



              } else {



                onClose();



              }



            }}



            disabled={submitting}



            className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"



            aria-label={showUpiQR ? 'Back to payment' : 'Close payment'}



          >



            {showUpiQR ? (



              <ArrowLeft className="w-5 h-5" />



            ) : (



              <X className="w-5 h-5" />



            )}



          </button>



        </div>







        {!showUpiQR ? (



          <>



            {/* Cart summary */}



            <div className="grid grid-cols-1 gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">



              <div className="max-h-36 space-y-2 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-200">



                {cart.map((it) => (



                  <div



                    key={`${it.id}-${it.barcode || ''}`}



                    className="flex items-center justify-between gap-3 py-1"



                  >



                    <span className="truncate">



                      {it.name} × {it.quantity}



                    </span>







                    <span>



                      {formatAmount(it.price * it.quantity)}



                    </span>



                  </div>



                ))}



              </div>







              {/* Totals */}



              <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm">



                <div className="flex items-center justify-between gap-3">



                  <span>Subtotal</span>



                  <span>{formatAmount(totals.subtotal)}</span>



                </div>







                {totals.totalDiscount > 0 && (



                  <div className="flex items-center justify-between gap-3 text-emerald-300">



                    <span>Total Discount</span>



                    <span>



                      -{formatAmount(totals.totalDiscount)}



                    </span>



                  </div>



                )}







                <div className="flex items-center justify-between gap-3">



                  <span>After Discount</span>



                  <span>{formatAmount(totals.afterDiscount)}</span>



                </div>







                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">



                  <span>



                    CGST ({(totals.taxRate / 2).toFixed(2)}%)



                  </span>



                  <span>{formatAmount(totals.cgst)}</span>



                </div>







                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">



                  <span>



                    SGST ({(totals.taxRate / 2).toFixed(2)}%)



                  </span>



                  <span>{formatAmount(totals.sgst)}</span>



                </div>







                <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-700 pt-3 text-base font-bold text-slate-100">



                  <span>Total</span>



                  <span>{formatAmount(totals.total)}</span>



                </div>



              </div>







              {/* Payment type and quick fill */}



              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">



                <div>



                  <label className="mb-2 block text-sm font-semibold text-slate-200">



                    Payment Type



                  </label>







                  <select



                    value={payType}



                    onChange={(e) => handlePayTypeChange(e.target.value)}



                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"



                  >



                    <option value="PAID">PAID (Full)</option>



                    <option value="DUE">DUE (Credit)</option>



                  </select>



                </div>







                {payType === 'PAID' && (



                  <div>



                    <label className="mb-2 block text-sm font-semibold text-slate-200">



                      Quick Fill



                    </label>







                    <div className="flex flex-wrap gap-2">



                      <button type="button" onClick={() => quickFill('cashFull')}



                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-300">



                        All Cash



                      </button>







                      <button type="button" onClick={() => quickFill('upiFull')}



                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-300">



                        All UPI



                      </button>







                      <button type="button" onClick={() => quickFill('splitHalf')}



                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-300">



                        50/50



                      </button>







                      <button type="button" onClick={() => quickFill('clear')}



                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 hover:text-cyan-300">



                        Clear



                      </button>



                    </div>



                  </div>



                )}



              </div>







              {payType === 'DUE' && (



                <div>



                  <label className="mb-2 block text-sm font-semibold text-slate-200">



                    Customer Name



                  </label>







                  <input



                    value={customerName}



                    onChange={(e) => setCustomerName(e.target.value)}



                    placeholder="Enter customer name"



                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"



                  />







                  <p className="mt-2 text-xs text-slate-400">



                    Any unpaid balance will be recorded as DUE.



                  </p>



                </div>



              )}







              {/* Cash and UPI amounts */}



              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">



                <div>



                  <label className="mb-2 block text-sm font-semibold text-slate-200">



                    Cash Amount (₹)



                  </label>







                  <input



                    type="number"



                    min="0"



                    step="0.01"



                    value={cashAmt}



                    onChange={(e) => setCashAmt(e.target.value)}



                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"



                    placeholder="0.00"



                  />



                </div>







                <div>



                  <label className="mb-2 block text-sm font-semibold text-slate-200">



                    UPI Amount (₹)



                  </label>







                  <input



                    type="number"



                    min="0"



                    step="0.01"



                    value={upiAmt}



                    onChange={(e) => setUpiAmt(e.target.value)}



                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"



                    placeholder="0.00"



                  />



                </div>



              </div>







              <div className="space-y-3 rounded-2xl bg-slate-950/70 p-4 text-sm">



                <div className="flex items-center justify-between gap-3">



                  <span>Paid Now</span>



                  <span className="font-semibold tabular-nums text-slate-100">{formatAmount(sum)}</span>



                </div>







                {payType === 'PAID' && (



                  <div className="flex items-center justify-between gap-3">



                    <span>Change (cash)</span>



                    <span className="font-semibold tabular-nums text-emerald-300">



                      {formatAmount(change)}



                    </span>



                  </div>



                )}







                <div className="flex items-center justify-between gap-3">



                  <span>



                    {payType === 'DUE' ? 'Remaining Due' : 'Remaining'}



                  </span>



                  <span className="font-semibold tabular-nums text-slate-100">



                    {formatAmount(Math.max(0, totals.total - sum))}



                  </span>



                </div>



              </div>







              {errors.length > 0 && (



                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">



                  {errors.map((error, i) => (



                    <div key={i}>• {error}</div>



                  ))}



                </div>



              )}



            </div>







            <div className="flex gap-3 border-t border-slate-800 bg-[#080d18] p-5 sm:px-8 sm:py-5">



              <button



                type="button"



                onClick={onClose}



                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"



              >



                Cancel



              </button>







              <button



                type="button"



                disabled={!canConfirm || submitting}



                onClick={handleConfirm}



                className="flex-1 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"



              >



                {parsedUpi > 0 ? 'Generate UPI QR' : 'Confirm Payment'}



              </button>



            </div>



          </>



        ) : (



          <>



            {/* UPI QR screen */}



            <div className="mx-auto max-w-xl space-y-5 p-5 text-center sm:p-8">



              <div>



                <p className="text-sm font-medium text-slate-400">



                  UPI payment amount



                </p>







                <h3 className="mt-1 text-4xl font-extrabold tracking-tight text-cyan-300 tabular-nums">



                  {formatAmount(parsedUpi)}



                </h3>







                <p className="mt-2 text-sm text-slate-300">



                  Paying to {PAYEE_NAME}



                </p>



              </div>







              <div className="flex justify-center">



                <div className="flex min-h-[260px] min-w-[260px] items-center justify-center rounded-3xl border border-slate-700 bg-white p-4 shadow-xl shadow-black/30">



                  <div ref={qrRef} aria-label="UPI payment QR code" />



                </div>



              </div>







              {qrError && (



                <div className="bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg p-3 text-sm">



                  {qrError}



                </div>



              )}







              <p className="text-sm leading-6 text-slate-300">



                Scan this QR using your UPI app and approve the payment.



                After checking the transaction, click Payment Done.



              </p>







              <div className="rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-left text-xs leading-5 text-amber-200">



                Manual confirmation only. This website does not verify



                whether the money was received. Check the actual transaction



                before completing the sale.



              </div>







              <div className="flex gap-3 pt-1">



                <button



                  type="button"



                  disabled={submitting}



                  onClick={() => {



                    setShowUpiQR(false);



                    setQrError('');



                  }}



                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"



                >



                  Back



                </button>







                <button



                  type="button"



                  disabled={!!qrError || submitting}



                  onClick={handleConfirm}



                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"



                >



                  <CheckCircle className="w-5 h-5" />



                  Payment Done



                </button>



              </div>



            </div>



          </>



        )}



      </div>



    </div>



  );



};







export default Payment;