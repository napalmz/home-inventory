import { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import QRCode from 'qrcode';

interface Props {
  name: string;
  path: string;
  onClose: () => void;
}

export default function InventoryQrDialog({ name, path, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');
  const url = `${window.location.origin}${path}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 2, width: 480 })
      .then((result) => active && setDataUrl(result))
      .catch(() => active && setError('Impossibile generare il QR code.'));
    return () => { active = false; };
  }, [url]);

  const print = () => {
    if (!dataUrl) return;
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) {
      setError('Il browser ha bloccato la finestra di stampa. Consenti i popup e riprova.');
      return;
    }

    const heading = printWindow.document.createElement('h1');
    heading.textContent = name;
    const image = printWindow.document.createElement('img');
    image.src = dataUrl;
    image.alt = `QR code per ${name}`;
    image.style.width = '80mm';
    image.style.height = '80mm';
    const address = printWindow.document.createElement('p');
    address.textContent = url;
    address.style.fontFamily = 'monospace';
    address.style.overflowWrap = 'anywhere';
    printWindow.document.title = `QR code - ${name}`;
    printWindow.document.body.style.cssText = 'font-family: sans-serif; text-align: center; margin: 20mm;';
    printWindow.document.body.append(heading, image, address);
    image.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  return (
    <Dialog open onClose={onClose} className="relative z-[70]">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded bg-white p-6 text-center shadow-xl dark:bg-gray-900 dark:text-white">
          <Dialog.Title className="mb-1 text-xl font-semibold">QR code: {name}</Dialog.Title>
          <p className="mb-4 break-all text-xs text-gray-600 dark:text-gray-300">{url}</p>
          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
          {dataUrl ? <img src={dataUrl} alt={`QR code per ${name}`} className="mx-auto mb-4 w-64" /> : <p>Generazione QR code…</p>}
          <div className="flex justify-center gap-2">
            <button type="button" onClick={onClose} className="rounded bg-gray-300 px-4 py-2 text-gray-900">Chiudi</button>
            <button type="button" onClick={print} disabled={!dataUrl} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Stampa</button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
