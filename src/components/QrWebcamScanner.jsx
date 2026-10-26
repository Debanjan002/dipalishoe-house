import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, X } from 'lucide-react';

/**
 * QR-only webcam scanner.
 * - continuous=false: detects one QR, calls onDetected, then closes.
 * - continuous=true: scans multiple unique QR codes and displays the scanned list
 *   inside this modal while forwarding each new value to onDetected.
 */
export default function QrWebcamScanner({ open, onClose, onDetected, onQuantitiesChange, continuous = false, isAlreadyRegistered }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const seenCodesRef = useRef(new Set());
  const onDetectedRef = useRef(onDetected);
  const onQuantitiesChangeRef = useRef(onQuantitiesChange);
  const onCloseRef = useRef(onClose);
  const continuousRef = useRef(continuous);
  const isAlreadyRegisteredRef = useRef(isAlreadyRegistered);
  const duplicateWarningRef = useRef(new Map());
  const pauseScanningUntilRef = useRef(0);
  // A repeated value counts as another unit only after the QR leaves the camera view
  // and is presented again, avoiding quantity inflation while a label stays in frame.
  const lastSuccessfulValueRef = useRef(null);
  const emptyFramesRef = useRef(0);
  const stopCameraRef = useRef(() => {});
  const audioContextRef = useRef(null);

  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [scannedCodes, setScannedCodes] = useState([]);

  const updateScannedCodes = (updater) => {
    setScannedCodes((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return next;
    });
  };

  const updateQuantity = (value, quantity) => {
    const parsed = Number.parseInt(quantity, 10);
    const safeQuantity = Number.isFinite(parsed) ? Math.max(1, Math.min(9999, parsed)) : 1;
    updateScannedCodes((current) => current.map((item) => item.value === value ? { ...item, quantity: safeQuantity } : item));
  };

  onDetectedRef.current = onDetected;
  onQuantitiesChangeRef.current = onQuantitiesChange;

  useEffect(() => {
    onQuantitiesChangeRef.current?.(scannedCodes.map((item) => ({ ...item })));
  }, [scannedCodes]);
  onCloseRef.current = onClose;
  continuousRef.current = continuous;
  isAlreadyRegisteredRef.current = isAlreadyRegistered;

  // Short, clear two-tone confirmation beep using the browser Web Audio API.
  // No external audio file or additional package is required.
  const playScanSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      let audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
      }
      const playTone = (frequency, startAt, duration, volume) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
        gain.gain.setValueAtTime(volume, startAt + Math.max(0.02, duration - 0.035));
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.01);
      };
      const now = audioContext.currentTime + 0.02;
      // Two audible notes; final loudness is also limited by the device volume.
      playTone(880, now, 0.13, 0.32);
      playTone(1175, now + 0.15, 0.17, 0.32);
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (soundError) {
      // Scanning must continue even if browser audio is unavailable or blocked.
    }
  };

  // Different warning tone only for registered/repeated QR codes. No voice playback.
  const playDuplicateSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        let audioContext = audioContextRef.current;
        if (!audioContext || audioContext.state === 'closed') {
          audioContext = new AudioContextClass();
          audioContextRef.current = audioContext;
        }
        const now = audioContext.currentTime + 0.02;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.setValueAtTime(220, now + 0.12);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
        gain.gain.setValueAtTime(0.22, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.23);
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      }
    } catch (_) {
      // Keep scanner working if sound is unavailable.
    }

  };

  const warnDuplicate = (value, message) => {
    const now = Date.now();
    const lastWarning = duplicateWarningRef.current.get(value) || 0;
    if (now - lastWarning < 2500) return;
    duplicateWarningRef.current.set(value, now);
    playDuplicateSound();
  };

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let singleScanHandled = false;
    seenCodesRef.current = new Set();
    duplicateWarningRef.current = new Map();
    pauseScanningUntilRef.current = 0;
    lastSuccessfulValueRef.current = null;
    emptyFramesRef.current = 0;
    setScannedCodes([]);
    setError('');
    setCameraReady(false);

    const stopCamera = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    stopCameraRef.current = stopCamera;

    const scanFrame = () => {
      if (cancelled || singleScanHandled) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        animationRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Briefly pause QR recognition after a successful scan while keeping the camera open.
      if (Date.now() < pauseScanningUntilRef.current) {
        animationRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context && video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'attemptBoth',
        });
        const value = result?.data?.trim();

        if (value) {
          emptyFramesRef.current = 0;
          const isSameLabelStillInView = lastSuccessfulValueRef.current === value;

          if (isSameLabelStillInView) {
            // The same label is still in view after the pause: warn, but do not add units.
            warnDuplicate(value, 'QR already scanned');
          } else if (seenCodesRef.current.has(value)) {
            // This QR was scanned earlier and has now been presented again.
            // Increase the quantity instead of creating a second preview row.
            lastSuccessfulValueRef.current = value;
            updateScannedCodes((current) => current.map((item) =>
              item.value === value ? { ...item, quantity: Math.min(9999, item.quantity + 1) } : item
            ));
            warnDuplicate(value, 'QR already scanned');
            if (continuousRef.current) pauseScanningUntilRef.current = Date.now() + 1000;
          } else {
            const alreadyRegistered = Boolean(isAlreadyRegisteredRef.current?.(value));
            seenCodesRef.current.add(value);
            lastSuccessfulValueRef.current = value;
            updateScannedCodes((current) => [...current, { value, quantity: 1 }]);

            if (alreadyRegistered) {
              warnDuplicate(value, 'QR already registered');
            } else {
              playScanSound();
              onDetectedRef.current?.(value);
            }

            if (continuousRef.current) {
              // Keep the camera open and pause recognition briefly before the next label.
              pauseScanningUntilRef.current = Date.now() + 1000;
            }

            if (!continuousRef.current) {
              singleScanHandled = true;
              stopCamera();
              onCloseRef.current?.();
              return;
            }
          }
        } else {
          // Require several blank frames before the same physical label can count again.
          emptyFramesRef.current += 1;
          if (emptyFramesRef.current >= 5) {
            lastSuccessfulValueRef.current = null;
          }
        }
      }

      animationRef.current = requestAnimationFrame(scanFrame);
    };

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Webcam access requires HTTPS (or localhost) and a supported browser.');
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (!cancelled) {
            setCameraReady(true);
            animationRef.current = requestAnimationFrame(scanFrame);
          }
        }
      } catch (cameraError) {
        if (!cancelled) {
          setError(cameraError?.message || 'Unable to start webcam. Check browser camera permissions.');
        }
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open]);

  const handleClose = () => {
    stopCameraRef.current?.();
    onCloseRef.current?.();
  };

  useEffect(() => () => {
    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scan shoe QR codes"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-cyan-300" />
            <div>
              <h2 className="font-semibold text-white">Scan shoe QR code</h2>
              <p className="text-xs text-slate-400">
                {continuous ? 'Continuous scan mode' : 'Single scan mode'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-cyan-300/90 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
            {!cameraReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
                Starting webcam…
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              {continuous
                ? 'Scan multiple QR labels. Each unique scanned value will appear in the list below.'
                : 'Hold one printed shoe QR code inside the frame. The camera closes after a successful scan.'}
            </p>
          )}

          {continuous && (
            <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/70">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Scanned QR codes</h3>
                </div>
                <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                  {scannedCodes.length} codes · {scannedCodes.reduce((total, item) => total + item.quantity, 0)} units
                </span>
              </div>
              {scannedCodes.length === 0 ? (
                <p className="px-4 py-5 text-center text-sm text-slate-500">
                  No QR codes scanned yet. Hold a label inside the frame.
                </p>
              ) : (
                <ol className="max-h-44 space-y-2 overflow-y-auto p-3">
                  {scannedCodes.map((item, index) => (
                    <li
                      key={`${item.value}-${index}`}
                      className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-xs font-semibold text-emerald-300">
                        {index + 1}
                      </span>
                      <code className="min-w-0 flex-1 break-all text-xs text-slate-200">{item.value}</code>
                      <label className="flex shrink-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Qty
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          step="1"
                          value={item.quantity}
                          onChange={(event) => updateQuantity(item.value, event.target.value)}
                          className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                          aria-label={`Quantity for QR ${index + 1}`}
                        />
                      </label>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              {continuous ? `Done (${scannedCodes.length})` : 'Close scanner'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
