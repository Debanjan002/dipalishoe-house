import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X } from 'lucide-react';

/** QR-only scanner for POS. Uses the device webcam; no hardware scanner is required. */
export default function QrWebcamScanner({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const lastCodeRef = useRef({ code: '', time: 0 });
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError('');
    setCameraReady(false);

    const stop = () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        animationRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context && video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
        if (result?.data) {
          const now = Date.now();
          const previous = lastCodeRef.current;
          if (result.data !== previous.code || now - previous.time > 1800) {
            lastCodeRef.current = { code: result.data, time: now };
            onDetectedRef.current?.(result.data);
          }
        }
      }
      animationRef.current = requestAnimationFrame(scanFrame);
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Webcam access requires HTTPS (or localhost) and a supported browser.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
          animationRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (cameraError) {
        if (!cancelled) setError(cameraError?.message || 'Unable to start webcam. Check browser camera permissions.');
      }
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Scan shoe QR code">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2"><Camera className="h-5 w-5 text-cyan-300" /><h2 className="font-semibold text-white">Scan shoe QR code</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" aria-label="Close scanner"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-cyan-300/90 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
            {!cameraReady && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-white">Starting webcam…</div>}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {error ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : <p className="mt-3 text-sm text-slate-400">Hold one printed shoe QR code inside the frame. The webcam will scan continuously.</p>}
          <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Close scanner</button></div>
        </div>
      </div>
    </div>
  );
}
