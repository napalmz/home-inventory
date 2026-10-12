import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat } from '@zxing/library';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string, format: string | null) => void;
}

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]>;
}
type NativeDetectorCtor = {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix'];

export default function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!open || !videoReady || !videoEl) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setError('Fotocamera non disponibile (serve HTTPS o localhost): inserisci il codice a mano.'));
      return;
    }

    let cancelled = false;
    let stop: () => void = () => {};
    const emit = (code: string, format: string | null) => {
      if (cancelled) return;
      cancelled = true;
      stop();
      onDetectedRef.current(code, format);
    };
    const fail = (err: unknown) => {
      if (cancelled) return;
      const name = (err as { name?: string })?.name;
      setError(
        name === 'NotAllowedError'
          ? 'Permesso fotocamera negato: inserisci il codice a mano o abilita la fotocamera.'
          : 'Impossibile avviare la fotocamera: inserisci il codice a mano.',
      );
    };

    const Native = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;

    const startNative = async (Ctor: NativeDetectorCtor) => {
      const supported = (await Ctor.getSupportedFormats?.()) ?? NATIVE_FORMATS;
      const detector = new Ctor({ formats: NATIVE_FORMATS.filter((f) => supported.includes(f)) });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      videoEl.srcObject = stream;
      await videoEl.play();
      const timer = window.setInterval(async () => {
        if (cancelled || videoEl.readyState < 2) return;
        try {
          const found = await detector.detect(videoEl);
          if (found.length > 0) emit(found[0].rawValue, found[0].format);
        } catch {
          // frame non leggibile: si riprova al tick successivo
        }
      }, 200);
      stop = () => {
        window.clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        videoEl.srcObject = null;
      };
    };

    const startZxing = async () => {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoEl,
        (result) => {
          if (result) emit(result.getText(), BarcodeFormat[result.getBarcodeFormat()]?.toLowerCase() ?? null);
        },
      );
      if (cancelled) {
        controls.stop();
        return;
      }
      stop = () => controls.stop();
    };

    (Native ? startNative(Native).catch(() => startZxing()) : startZxing()).catch(fail);

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, videoReady, onDetected]);

  const closeAndReset = () => {
    setError(null);
    setManualCode('');
    onClose();
  };

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    onDetected(code, null);
  };

  return (
    <Dialog open={open} onClose={closeAndReset} className="relative z-[60]">
      <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-900 dark:text-white p-4 rounded w-full max-w-lg">
          <Dialog.Title className="text-lg font-semibold mb-2">Scansiona codice</Dialog.Title>
          {error ? (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          ) : (
            <video
              ref={(el) => {
                videoRef.current = el;
                setVideoReady(el !== null);
              }}
              className="w-full rounded bg-black aspect-video object-cover mb-3"
              muted
              playsInline
            />
          )}
          <form
            className="flex gap-2 mb-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitManual();
            }}
          >
            <input
              type="text"
              inputMode="text"
              placeholder="Oppure digita / incolla il codice"
              className="flex-1 border rounded p-2"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button type="submit" className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              OK
            </button>
          </form>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeAndReset}
              className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600"
            >
              Chiudi
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
