import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, X, QrCode } from 'lucide-react';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export default function QrLabelPrint({ product, onClose }) {
  const [labels, setLabels] = useState([]);
  const [error, setError] = useState('');
  const availableUnits = useMemo(
    () => (product?.qrUnits || []).filter((unit) => unit.status === 'available').slice(0, Math.max(0, Number(product?.stock) || 0)),
    [product],
  );

  useEffect(() => {
    let cancelled = false;
    setLabels([]);
    setError('');
    Promise.all(availableUnits.map(async (unit) => ({
      ...unit,
      image: await QRCode.toDataURL(unit.qrValue || `DSH1:${unit.unitId}`, {
        errorCorrectionLevel: 'M', margin: 1, width: 240, color: { dark: '#000000', light: '#FFFFFF' },
      }),
    }))).then((result) => { if (!cancelled) setLabels(result); })
      .catch((cause) => { if (!cancelled) setError(cause?.message || 'Could not generate QR labels.'); });
    return () => { cancelled = true; };
  }, [availableUnits]);

  const printLabels = () => {
    if (!labels.length) return;
    const printWindow = window.open('', '_blank', 'width=480,height=720');
    if (!printWindow) {
      setError('The print window was blocked. Allow pop-ups for this site and try again.');
      return;
    }

    // Each label prints on the same thermal roll. A separator follows each label
    // (except the last one), with one blank line before the QR and after the details.
    const labelMarkup = labels.map((unit, index) => `
      <section class="label">
        <div class="blank-line" aria-hidden="true">&nbsp;</div>
        <img class="qr" src="${unit.image}" alt="QR ${escapeHtml(unit.unitId)}" />
        <div class="name">${escapeHtml(product.name)}</div>
        <div>${escapeHtml(product.brand || '')}${product.size ? ` · Size ${escapeHtml(product.size)}` : ''}</div>
        <div class="price">₹${Number(product.price || 0).toLocaleString('en-IN')}</div>
        <div class="id">${escapeHtml(unit.unitId)}</div>
        <div class="blank-line after-details" aria-hidden="true">&nbsp;</div>
        ${index < labels.length - 1 ? '<div class="separator">****************************</div>' : '<h1 class="om-symbol">ॐ</h1>'}
      </section>`).join('');

    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Shoe QR Labels</title><style>
      @page { size: 50mm auto; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 50mm; color: #000; background: #fff; font-family: Arial, sans-serif; }
      .label { width: 45mm; padding: 1mm 1mm 2mm; text-align: center; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
      .blank-line { height: 3mm; line-height: 3mm; font-size: 1pt; }
      .qr { display: block; width: 24mm; height: 24mm; object-fit: contain; margin: 0 auto 1mm; image-rendering: pixelated; }
      .name { font-size: 9pt; font-weight: 700; line-height: 1.1; max-height: 8mm; overflow: hidden; }
      .label div { font-size: 7pt; line-height: 1.2; overflow-wrap: anywhere; }
      .price { font-weight: 700; font-size: 9pt !important; }
      .id { font-family: monospace; font-size: 6.5pt !important; margin-top: 1mm; }
      .after-details { margin-top: 0; }
      .separator { font-family: monospace; font-size: 7pt !important; letter-spacing: 0.1mm; white-space: nowrap; margin: 1mm 0 2mm; padding-top: 1mm; border-top: 0.2mm dashed #000; }
      .om-symbol { margin: 2mm 0 0; font-size: 18pt; line-height: 1.2; font-weight: 700; }
      @media screen { body { width: 45mm; margin: 0 auto; } .label { border-bottom: 1px dashed #aaa; } }
    </style></head><body>${labelMarkup}<script>
      window.onload = () => {
        const images = Array.from(document.images);
        Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })))
          .then(() => { window.focus(); window.print(); });
      };
    </script></body></html>`);
    printWindow.document.close();
  };

  if (!product) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Print shoe QR labels">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-cyan-300" /><div><h2 className="font-semibold text-white">Print shoe QR labels</h2><p className="text-xs text-slate-400">{product.name}</p></div></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" aria-label="Close QR labels"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3"><p className="text-xs text-slate-400">Available stock</p><p className="text-2xl font-bold text-white">{Number(product.stock) || 0}</p></div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3"><p className="text-xs text-slate-400">Labels to print</p><p className="text-2xl font-bold text-cyan-300">{labels.length}</p></div>
          </div>
          {error && <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
          {!error && labels.length === 0 && <p className="rounded-lg bg-slate-800 p-4 text-sm text-slate-300">No available stock units have QR labels to print.</p>}
          {labels.length > 0 && <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 p-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{labels.slice(0, 12).map((label) => <div key={label.unitId} className="rounded-lg bg-white p-2 text-center text-black"><img src={label.image} alt={`QR ${label.unitId}`} className="mx-auto h-24 w-24"/><p className="truncate text-xs font-semibold">{label.unitId}</p><p className="truncate text-[10px]">{product.name}</p></div>)}</div>{labels.length > 12 && <p className="pt-3 text-center text-xs text-slate-400">Previewing 12 of {labels.length} labels; all available labels will print.</p>}</div>}
          <p className="mt-3 text-xs text-slate-400">Print dialog: select your existing thermal printer and use the roll width supported by that printer. Print one test label before printing a large batch.</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Cancel</button><button type="button" disabled={!labels.length} onClick={printLabels} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><Printer className="h-4 w-4" /> Print {labels.length} labels</button></div>
        </div>
      </div>
    </div>
  );
}
