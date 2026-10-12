import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@headlessui/react';
import { isAxiosError } from 'axios';
import { lookupBarcode } from '../api';
import type { BarcodeMatch } from '../types';
import BarcodeScanner from './BarcodeScanner';

const matchPath = (m: BarcodeMatch) =>
  `/${m.inventory_type === 'CHECKLIST' ? 'checklists' : 'inventories'}/${m.inventory_id}?item=${m.item_id}`;

export default function GlobalBarcodeScan() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [matches, setMatches] = useState<BarcodeMatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const open = useCallback(
    (m: BarcodeMatch) => {
      setCode(null);
      navigate(matchPath(m));
    },
    [navigate],
  );

  const handleDetected = useCallback(
    async (scanned: string) => {
      setScanning(false);
      try {
        const result = await lookupBarcode(scanned, false);
        if (result.matches.length === 1) {
          open(result.matches[0]);
          return;
        }
        setMatches(result.matches);
        setMessage(result.matches.length === 0 ? 'Nessun item associato a questo codice.' : null);
        setCode(result.code);
      } catch (err) {
        setMatches([]);
        setMessage(
          isAxiosError(err) && err.response?.data?.detail
            ? String(err.response.data.detail)
            : 'Errore durante la ricerca del codice.',
        );
        setCode(scanned);
      }
    },
    [open],
  );

  return (
    <>
      <button
        onClick={() => setScanning(true)}
        title="Scansiona barcode / QR code"
        aria-label="Scansiona barcode / QR code"
        className="fixed bottom-4 right-4 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-2xl shadow-lg flex items-center justify-center"
      >
        📷
      </button>

      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={handleDetected} />

      <Dialog open={code !== null} onClose={() => setCode(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md rounded bg-white dark:bg-gray-800 dark:text-white p-4 shadow-xl">
            <Dialog.Title className="font-bold mb-1">
              {matches.length > 1 ? 'Seleziona l\'item' : 'Codice scansionato'}
            </Dialog.Title>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-300 mb-3 break-all">{code}</p>
            {message && <p className="text-sm mb-3">{message}</p>}
            <ul className="space-y-2 max-h-72 overflow-auto">
              {matches.map((m) => (
                <li key={m.item_id}>
                  <button
                    onClick={() => open(m)}
                    className="w-full text-left p-2 rounded border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-300">
                      {m.inventory_type === 'CHECKLIST' ? 'Lista' : 'Inventario'}: {m.inventory_name ?? m.inventory_id}
                      {m.quantity !== null && ` · qtà ${m.quantity}`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-between mt-4">
              <button
                onClick={() => {
                  setCode(null);
                  setScanning(true);
                }}
                className="px-3 py-1 rounded bg-blue-600 text-white"
              >
                Scansiona altro
              </button>
              <button onClick={() => setCode(null)} className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-600">
                Chiudi
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
