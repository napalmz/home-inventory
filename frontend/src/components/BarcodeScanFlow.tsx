import { useCallback, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { addItemBarcode, createItem, lookupBarcode, updateItem } from '../api';
import { BarcodeLookupResult, Inventory, Item } from '../types';
import BarcodeScanner from './BarcodeScanner';
import { useKeyboardScanner } from '../useKeyboardScanner';

interface Props {
  inventory: Inventory | null;
  items: Item[];
  isChecklist: boolean;
  keyboardEnabled: boolean;
  onItemsChanged: () => Promise<void>;
  onOpenItem: (item: Item) => void;
}

type Scan = { code: string; format: string | null; lookup: BarcodeLookupResult };
type Mode = 'create' | 'associate';

function errorMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return err instanceof Error && err.message ? err.message : 'Operazione non riuscita';
}

export default function BarcodeScanFlow({ inventory, items, isChecklist, keyboardEnabled, onItemsChanged, onOpenItem }: Props) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('create');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const handleCode = useCallback(
    async (rawCode: string, format: string | null) => {
      if (!inventory) return;
      setScannerOpen(false);
      setError(null);
      setDone(null);
      setLoading(true);
      try {
        const lookup = await lookupBarcode(rawCode, true);
        const product = lookup.product;
        const elsewhere = lookup.matches.find((m) => m.inventory_id !== inventory.id);
        setNewName(product?.name ?? elsewhere?.name ?? '');
        setNewDescription([product?.brand, product?.quantity_label].filter(Boolean).join(' - '));
        setNewQuantity(isChecklist ? 0 : 1);
        setMode('create');
        setSearch('');
        setSelectedItemId(null);
        setScan({ code: lookup.code, format, lookup });
      } catch (err) {
        setScan(null);
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [inventory, isChecklist],
  );

  useKeyboardScanner(keyboardEnabled && !scannerOpen && !!inventory, (code) => void handleCode(code, null));

  const localMatches = useMemo(
    () => (scan && inventory ? scan.lookup.matches.filter((m) => m.inventory_id === inventory.id) : []),
    [scan, inventory],
  );
  const otherMatches = useMemo(
    () => (scan && inventory ? scan.lookup.matches.filter((m) => m.inventory_id !== inventory.id) : []),
    [scan, inventory],
  );
  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items
      .filter((item) => !needle || item.name.toLowerCase().includes(needle) || (item.description ?? '').toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [items, search]);

  const closeAll = () => {
    setScan(null);
    setError(null);
    setDone(null);
  };

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      const message = await action();
      await onItemsChanged();
      setDone(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changeQuantity = (itemId: number, delta: number | 'toggle') =>
    run(async () => {
      const item = items.find((i) => i.id === itemId);
      if (!item) throw new Error('Oggetto non trovato');
      const quantity = delta === 'toggle' ? (item.quantity > 0 ? 0 : 1) : Math.max(0, item.quantity + delta);
      await updateItem(item.id, {
        name: item.name,
        description: item.description ?? '',
        quantity,
        inventory_id: item.inventory_id,
      });
      return delta === 'toggle'
        ? `${item.name}: ${quantity > 0 ? 'completato' : 'da fare'}`
        : `${item.name}: quantità ${quantity}`;
    });

  const submitCreate = () =>
    run(async () => {
      if (!scan || !inventory) throw new Error('Scansione non valida');
      const name = newName.trim();
      if (!name) throw new Error('Nome obbligatorio');
      await createItem({
        name,
        description: newDescription.trim() || undefined,
        quantity: newQuantity,
        inventory_id: inventory.id,
        barcodes: [{ code: scan.code, format: scan.format }],
      });
      return `Creato "${name}" con codice ${scan.code}`;
    });

  const submitAssociate = () =>
    run(async () => {
      if (!scan || selectedItemId === null) throw new Error('Seleziona un oggetto');
      const item = items.find((i) => i.id === selectedItemId);
      await addItemBarcode(selectedItemId, scan.code, scan.format);
      return `Codice ${scan.code} associato a "${item?.name ?? ''}"`;
    });

  const rescan = () => {
    closeAll();
    setScannerOpen(true);
  };

  const product = scan?.lookup.product ?? null;

  return (
    <>
      <button
        onClick={() => setScannerOpen(true)}
        disabled={!inventory}
        className="py-2 px-4 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 disabled:opacity-50"
        title="Scansiona barcode / QR code"
      >
        <span className="inline md:hidden">📷</span>
        <span className="hidden md:inline">📷 Scansiona</span>
      </button>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={(code, format) => void handleCode(code, format)} />

      <Dialog open={loading || scan !== null || error !== null} onClose={() => !busy && !loading && closeAll()} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-900 dark:text-white p-6 rounded w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {loading && <p>Ricerca codice...</p>}

            {!loading && !scan && error && (
              <>
                <p className="text-red-600 mb-4">{error}</p>
                <div className="flex justify-end">
                  <button onClick={closeAll} className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600">Chiudi</button>
                </div>
              </>
            )}

            {!loading && scan && (
              <>
                <Dialog.Title className="text-lg font-semibold mb-1">
                  {localMatches.length > 0 ? 'Oggetto trovato' : 'Codice nuovo'}
                </Dialog.Title>
                <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-3 break-all">{scan.code}</p>

                {done ? (
                  <>
                    <p className="mb-4 text-green-700 dark:text-green-400">✅ {done}</p>
                    <div className="flex justify-end gap-2">
                      <button onClick={closeAll} className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600">Chiudi</button>
                      <button onClick={rescan} className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">Scansiona altro</button>
                    </div>
                  </>
                ) : localMatches.length > 0 ? (
                  <>
                    <ul className="mb-4 space-y-2">
                      {localMatches.map((match) => {
                        const full = items.find((i) => i.id === match.item_id);
                        return (
                          <li key={match.item_id} className="border rounded p-3">
                            <div className="font-medium">{match.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                              {isChecklist ? (match.quantity ? 'Completato' : 'Da fare') : `Quantità: ${match.quantity ?? 0}`}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {isChecklist ? (
                                <button disabled={busy} onClick={() => void changeQuantity(match.item_id, 'toggle')} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                                  {match.quantity ? 'Segna da fare' : 'Segna completato'}
                                </button>
                              ) : (
                                <>
                                  <button disabled={busy} onClick={() => void changeQuantity(match.item_id, 1)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">+1</button>
                                  <button disabled={busy || !match.quantity} onClick={() => void changeQuantity(match.item_id, -1)} className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">−1</button>
                                </>
                              )}
                              {full && (
                                <button
                                  onClick={() => {
                                    closeAll();
                                    onOpenItem(full);
                                  }}
                                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                >
                                  Modifica
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                    <div className="flex justify-end gap-2">
                      <button onClick={closeAll} className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600">Chiudi</button>
                      <button onClick={rescan} className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">Scansiona altro</button>
                    </div>
                  </>
                ) : (
                  <>
                    {product && (
                      <div className="flex gap-3 items-center border rounded p-2 mb-3 bg-blue-50 dark:bg-gray-800">
                        {product.image_url && <img src={product.image_url} alt="" className="w-14 h-14 object-contain rounded bg-white" />}
                        <div className="text-sm">
                          <div className="font-medium">{product.name ?? 'Prodotto senza nome'}</div>
                          <div className="text-gray-600 dark:text-gray-300">{[product.brand, product.quantity_label].filter(Boolean).join(' - ')}</div>
                          <div className="text-xs text-gray-500">Fonte: {product.source}</div>
                        </div>
                      </div>
                    )}
                    {otherMatches.length > 0 && (
                      <p className="text-sm border rounded p-2 mb-3 bg-yellow-50 dark:bg-gray-800">
                        Già presente in altri inventari: {otherMatches.map((m) => `${m.name} (${m.inventory_name ?? m.inventory_id})`).join(', ')}
                      </p>
                    )}
                    <p className="text-sm mb-2">Nessun oggetto di questo inventario ha questo codice.</p>
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => setMode('create')}
                        className={`px-3 py-1 rounded ${mode === 'create' ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                      >
                        Crea nuovo
                      </button>
                      <button
                        onClick={() => setMode('associate')}
                        className={`px-3 py-1 rounded ${mode === 'associate' ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                      >
                        Associa a esistente
                      </button>
                    </div>

                    {mode === 'create' ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitCreate();
                        }}
                      >
                        <div className="mb-2">
                          <label className="block text-sm font-medium">Nome</label>
                          <input autoFocus className="w-full border rounded p-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
                        </div>
                        <div className="mb-2">
                          <label className="block text-sm font-medium">Descrizione</label>
                          <input className="w-full border rounded p-1" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                        </div>
                        {!isChecklist && (
                          <div className="mb-3">
                            <label className="block text-sm font-medium">Quantità</label>
                            <input
                              type="number"
                              min="0"
                              className="w-20 border rounded p-1 text-center"
                              value={newQuantity}
                              onChange={(e) => setNewQuantity(Math.max(0, Number(e.target.value)))}
                            />
                          </div>
                        )}
                        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={closeAll} className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600">Annulla</button>
                          <button type="submit" disabled={busy || !newName.trim()} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">Crea</button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <input
                          className="w-full border rounded p-1 mb-2"
                          placeholder="Cerca oggetto..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        <ul className="border rounded max-h-56 overflow-y-auto mb-3">
                          {candidates.length === 0 && <li className="p-2 text-sm text-gray-500">Nessun oggetto</li>}
                          {candidates.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedItemId(item.id)}
                                className={`w-full text-left px-2 py-1 ${selectedItemId === item.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                              >
                                {item.name}
                                {(item.barcodes?.length ?? 0) > 0 && <span className="ml-2 text-xs opacity-70">🏷️ {item.barcodes?.length}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={closeAll} className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600">Annulla</button>
                          <button
                            type="button"
                            disabled={busy || selectedItemId === null}
                            onClick={() => void submitAssociate()}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                          >
                            Associa
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
