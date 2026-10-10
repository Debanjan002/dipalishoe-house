import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const QUAGGA_CDN = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2/dist/quagga.min.js';
const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@2.1.5/dist/tesseract.min.js';

const DEFAULT_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'codabar',
  'qr_code',
];

const QUAGGA_READERS = [
  'ean_reader',
  'ean_8_reader',
  'upc_reader',
  'upc_e_reader',
  'code_128_reader',
  'code_39_reader',
  'i2of5_reader',
  'codabar_reader',
];

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find((script) => script.src === src);
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load scanner library: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Could not load the scanner library. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });

const parseStickerText = (text = '') => {
  const lines = text.split(/\n|\r/).map((line) => line.trim()).filter(Boolean);
  const joined = lines.join(' ');
  const details = {};

  const priceMatch = joined.match(/(?:MRP|M\.?R\.?P\.?|Price|Rs\.?|₹)\s*[:\-]?\s*([0-9]{2,6}(?:[.,][0-9]{2})?)/i);
  if (priceMatch) details.price = priceMatch[1].replace(/,/g, '.');

  const sizeMatch = joined.match(/(?:Size|UK|EU|EUR|US)\s*[:\-]?\s*([0-9]{1,2}(?:\.[0-9])?)/i);
  if (sizeMatch) details.size = sizeMatch[1];

  const caps = lines.flatMap((line) => line.split(/\s+/)).filter(
    (word) => /^[A-Z][A-Z0-9-]{2,}$/.test(word) && !/^(MRP|SIZE|PRICE|UK|EU|EUR|US|RS)$/.test(word)
  );
  if (caps.length) details.brand = caps[0];

  const nameLine = lines.find((line) => /[A-Za-z]{3,}/.test(line) && !/MRP|PRICE|SIZE|UK|EU|EUR|US/i.test(line));
  if (nameLine) details.name = nameLine;

  return details;
};

export default function BarcodeScanner({
  open,
  onClose,
  onDetected,
  onExtractedDetails,
  continuous = false,
  formats,
  autoPickPhoto = false,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const quaggaHandlerRef = useRef(null);
  const detectBufferRef = useRef([]);
  const lastAcceptedRef = useRef({ code: '', at: 0 });
  const detectingRef = useRef(false);
  const stoppedRef = useRef(false);
  const fileInputRef = useRef(null);
  const photoUrlRef = useRef(null);

  const [error, setError] = useState('');
  const [usingQuagga, setUsingQuagga] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [status, setStatus] = useState('Starting camera…');

  const stop = useCallback(() => {
    stoppedRef.current = true;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const Q = window.Quagga;
    if (Q) {
      if (quaggaHandlerRef.current && Q.offDetected) {
        try { Q.offDetected(quaggaHandlerRef.current); } catch (_) {}
      }
      try { Q.stop(); } catch (_) {}
      try { Q.offProcessed?.(); } catch (_) {}
    }
    quaggaHandlerRef.current = null;

    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    stop();
    onClose?.();
  }, [onClose, stop]);

  const acceptDetection = useCallback((rawCode, stable = true) => {
    const code = String(rawCode ?? '').trim();
    if (!code) return false;

    const now = Date.now();
    if (!stable) {
      const previous = lastAcceptedRef.current;
      if (previous.code === code && now - previous.at < 1800) return false;
      lastAcceptedRef.current = { code, at: now };
      onDetected?.(code);
      if (!continuous) close();
      return true;
    }

    detectBufferRef.current = detectBufferRef.current.filter((item) => now - item.at < 1800);
    detectBufferRef.current.push({ code, at: now });
    const count = detectBufferRef.current.filter((item) => item.code === code).length;

    // Accept after two matching reads instead of requiring three reads in a short window.
    if (count < 2) return false;

    const previous = lastAcceptedRef.current;
    if (previous.code === code && now - previous.at < 1800) return false;

    lastAcceptedRef.current = { code, at: now };
    detectBufferRef.current = [];
    onDetected?.(code);
    if (!continuous) close();
    return true;
  }, [close, continuous, onDetected]);

  useEffect(() => {
    if (!open) {
      stop();
      return undefined;
    }

    let cancelled = false;
    stoppedRef.current = false;
    setError('');
    setStatus('Requesting camera access…');
    setUsingQuagga(false);
    detectBufferRef.current = [];
    detectingRef.current = false;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is unavailable. Use HTTPS or localhost and allow camera permission.');
        }

        const nativeAvailable = 'BarcodeDetector' in window;
        if (nativeAvailable) {
          let detector;
          try {
            const supported = await window.BarcodeDetector.getSupportedFormats?.();
            const requested = formats?.length ? formats : DEFAULT_FORMATS;
            const selected = supported?.length ? requested.filter((format) => supported.includes(format)) : requested;
            detector = new window.BarcodeDetector({ formats: selected.length ? selected : ['code_128', 'code_39'] });
          } catch (_) {
            detector = new window.BarcodeDetector({ formats: ['code_128', 'code_39'] });
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });

          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;
          const video = videoRef.current;
          if (!video) throw new Error('Camera preview could not be initialized.');
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          await video.play();
          setStatus('Point the camera at a barcode');

          timerRef.current = window.setInterval(async () => {
            if (cancelled || stoppedRef.current || detectingRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
            detectingRef.current = true;
            try {
              const results = await detector.detect(videoRef.current);
              for (const result of results || []) {
                if (acceptDetection(result.rawValue)) break;
              }
            } catch (_) {
              // Some frames are blurry or incomplete; continue scanning.
            } finally {
              detectingRef.current = false;
            }
          }, 250);
          return;
        }

        // Quagga fallback for browsers without native BarcodeDetector.
        setUsingQuagga(true);
        await loadScript(QUAGGA_CDN);
        if (cancelled) return;
        const Q = window.Quagga;
        if (!Q) throw new Error('Barcode scanner library did not initialize. Refresh and try again.');

        const target = containerRef.current;
        if (!target) throw new Error('Scanner preview could not be initialized.');

        await new Promise((resolve, reject) => {
          Q.init({
            inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target,
              constraints: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            locator: { patchSize: 'medium', halfSample: true },
            decoder: { readers: QUAGGA_READERS },
            locate: true,
            frequency: 10,
          }, (initError) => initError ? reject(initError) : resolve());
        });

        if (cancelled) {
          try { Q.stop(); } catch (_) {}
          return;
        }

        const handler = (result) => {
          const code = result?.codeResult?.code;
          if (code) acceptDetection(code);
        };
        quaggaHandlerRef.current = handler;
        Q.onDetected(handler);
        Q.start();
        setStatus('Point the camera at a barcode');
      } catch (scanError) {
        if (!cancelled) {
          setError(scanError?.message || 'Unable to start the barcode scanner.');
          setStatus('');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, formats, acceptDetection, stop]);

  useEffect(() => {
    if (!open || !autoPickPhoto) return undefined;
    const id = window.setTimeout(() => fileInputRef.current?.click(), 250);
    return () => window.clearTimeout(id);
  }, [open, autoPickPhoto]);

  const scanPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScanningImage(true);
    setError('');
    try {
      // Try native detector first when available.
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: formats?.length ? formats : DEFAULT_FORMATS });
          const bitmap = await createImageBitmap(file);
          try {
            const results = await detector.detect(bitmap);
            if (results?.length) {
              acceptDetection(results[0].rawValue, false);
            } else {
              throw new Error('No barcode detected by the browser scanner.');
            }
          } finally {
            bitmap.close?.();
          }
        } catch (nativeError) {
          // Fall through to Quagga for formats the native detector cannot read.
          await scanPhotoWithQuagga(file);
        }
      } else {
        await scanPhotoWithQuagga(file);
      }

      // OCR is optional; barcode scanning should still succeed if OCR fails.
      if (onExtractedDetails) {
        try {
          await loadScript(TESSERACT_CDN);
          if (window.Tesseract) {
            const result = await window.Tesseract.recognize(file, 'eng');
            const details = parseStickerText(result?.data?.text || '');
            if (Object.keys(details).length) onExtractedDetails(details);
          }
        } catch (_) {}
      }
    } catch (scanError) {
      setError(scanError?.message || 'No barcode found. Try a sharper, well-lit photo with the barcode filling more of the image.');
    } finally {
      setScanningImage(false);
      event.target.value = '';
    }
  };

  const scanPhotoWithQuagga = async (file) => {
    await loadScript(QUAGGA_CDN);
    const Q = window.Quagga;
    if (!Q) throw new Error('Could not load the photo barcode scanner.');

    const src = URL.createObjectURL(file);
    photoUrlRef.current = src;
    const result = await new Promise((resolve, reject) => {
      Q.decodeSingle({
        src,
        numOfWorkers: 0,
        locate: true,
        decoder: { readers: QUAGGA_READERS },
      }, resolve);
    });
    if (!result?.codeResult?.code) {
      throw new Error('No barcode found in this photo. Try a clearer, closer image.');
    }
    acceptDetection(result.codeResult.code, false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Scan Barcode</h3>
          <button type="button" onClick={close} aria-label="Close scanner" className="rounded-lg p-2 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            {!usingQuagga ? (
              <>
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-2/3 w-5/6 rounded-md border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.2)]" />
                </div>
              </>
            ) : (
              <div ref={containerRef} className="h-full w-full [&>video]:h-full [&>video]:w-full [&>canvas]:hidden" />
            )}
            {status && <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">{status}</div>}
          </div>

          <p className="text-xs text-gray-600">
            Keep the barcode inside the frame, hold the device steady, and use good lighting. Product barcodes such as EAN/UPC and Code 128/39 are supported where the browser scanner allows them.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={scanningImage} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
              {scanningImage ? 'Scanning photo…' : 'Scan from Photo'}
            </button>
            {scanningImage && <span className="text-xs text-gray-500">Reading barcode and label…</span>}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={scanPhoto}
            />
          </div>

          {!continuous && (
            <div className="flex justify-end">
              <button type="button" onClick={close} className="rounded-lg border px-4 py-2 hover:bg-gray-50">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
