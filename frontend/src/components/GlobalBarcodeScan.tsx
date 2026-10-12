import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog } from '@headlessui/react';
import {
  addItemBarcode,
  createItem,
  getChecklistItems,
  getChecklists,
  getInventories,
  getInventoryItems,
  lookupBarcode,
  updateItem,
} from '../api';
import type { BarcodeLookupResult, BarcodeMatch } from '../types';
import BarcodeScanner from './BarcodeScanner';
import { useAuth } from '../useAuth';
import { useKeyboardScanner } from '../useKeyboardScanner';

export const ITEMS_CHANGED_EVENT = 'barcode-items-changed';

type Kind = 'inventories' | 'checklists';
type Target = { id: number; name: string; kind: Kind };
type ListItem = { id: number; name: string; description?: string | null; quantity: number; inventory_id: number; barcodes?: unknown[] };
type Scan = { code: string; format: string | null; lookup: BarcodeLookupResult };
type Mode = 'menu' | 'create' | 'associate';

const kindOf = (m: BarcodeMatch): Kind => (m.inventory_type === 'CHECKLIST' ? 'checklists' : 'inventories');
const targetKey = (t: Target) => `${t.kind}:${t.id}`;

function errorMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return err instanceof Error && err.message ? err.message : 'Operazione non riuscita';
}

const fetchItems = (kind: Kind, id: number): Promise<ListItem[]> =>
  (kind === 'checklists' ? getChecklistItems(id) : getInventoryItems(id)) as Promise<ListItem[]>;

export default function GlobalBarcodeScan() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const canEdit = user?.role.name !== 'viewer';

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('menu');

  const [targets, setTargets] = useState<Target[]>([]);
  const [targetKeySel, setTargetKeySel] = useState('');
  const [targetItems, setTargetItems] = useState<ListItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [matchQty, setMatchQty] = useState<Record<number, number>>({});

  const currentTarget = useMemo(() => {
    const m = pathname.match(/^\/(inventories|checklists)\/(\d+)/);
    return m ? { kind: m[1] as Kind, id: Number(m[2]) } : null;
  }, [pathname]);

  const target = targets.find((t) => targetKey(t) === targetKeySel) ?? null;

  const loadTargets = useCallback(async () => {
    const [inv, chk] = await Promise.all([getInventories(), getChecklists()]);
    const all: Target[] = [
      ...inv.map((i) => ({ id: i.id, name: i.name, kind: 'inventories' as Kind })),
      ...chk.map((c) => ({ id: c.id, name: c.name, kind: 'checklists' as Kind })),
    ];
    setTargets(all);
    return all;
  }, []);

  const handleCode = useCallback(
    async (rawCode: string, format: string | null) => {
      setScannerOpen(false);
      setError(null);
      setDone(null);
      setLoading(true);
      try {
        const lookup = await lookupBarcode(rawCode, true);
        const product = lookup.product;
        setNewName(product?.name ?? lookup.matches[0]?.name ?? '');
        setNewDescription([product?.brand, product?.quantity_label].filter(Boolean).join(' - '));
        setNewQuantity(1);
        setSearch('');
        setSelectedItemId(null);
        setQuantities({});
        setMatchQty(Object.fromEntries(lookup.matches.map((m) => [m.item_id, m.quantity ?? 0])));
        setMode(lookup.matches.length > 0 ? 'menu' : canEdit ? 'create' : 'menu');
        setScan({ code: lookup.code, format, lookup });

        if (canEdit && lookup.matches.length === 0) {
          const all = await loadTargets();
          const preferred =
            all.find((t) => currentTarget && t.kind === currentTarget.kind && t.id === currentTarget.id) ?? all[0];
          setTargetKeySel(preferred ? targetKey(preferred) : '');
        }
      } catch (err) {
        setScan(null);
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [canEdit, currentTarget, loadTargets],
  );

  useKeyboardScanner(!!user?.username && !scannerOpen && scan === null && !loading, (code) => void handleCode(code, null));

  // Elenco item dell'inventario/lista selezionato come destinazione (per l'associazione)
  useEffect(() => {
    if (!target || mode !== 'associate') return;
    let cancelled = false;
    fetchItems(target.kind, target.id)
      .then((list) => !cancelled && setTargetItems(list))
      .catch(() => !cancelled && setTargetItems([]));
    return () => {
      cancelled = true;
    };
  }, [target, mode]);

  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return targetItems
      .filter((i) => !needle || i.name.toLowerCase().includes(needle) || (i.description ?? '').toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [targetItems, search]);

  const closeAll = () => {
    setScan(null);
    setError(null);
    setDone(null);
    setMode('menu');
  };

  const notifyChanged = () => window.dispatchEvent(new Event(ITEMS_CHANGED_EVENT));

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      const message = await action();
      notifyChanged();
      setDone(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openMatch = (m: BarcodeMatch) => {
    closeAll();
    navigate(`/${kindOf(m)}/${m.inventory_id}?item=${m.item_id}`, { state: { scanAt: Date.now() } });
  };

  const setQuantity = async (m: BarcodeMatch, quantity: number) => {
    setBusy(true);
    setError(null);
    try {
      const list = await fetchItems(kindOf(m), m.inventory_id);
      const item = list.find((i) => i.id === m.item_id);
      if (!item) throw new Error('Oggetto non trovato');
      const value = Math.max(0, Math.floor(quantity));
      await updateItem(item.id, {
        name: item.name,
        description: item.description ?? '',
        quantity: value,
        inventory_id: item.inventory_id,
      });
      setMatchQty((prev) => ({ ...prev, [m.item_id]: value }));
      setQuantities((prev) => ({ ...prev, [m.item_id]: '' }));
      notifyChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = () =>
    run(async () => {
      if (!scan || !target) throw new Error('Seleziona inventario o lista');
      const name = newName.trim();
      if (!name) throw new Error('Nome obbligatorio');
      await createItem({
        name,
        description: newDescription.trim() || undefined,
        quantity: target.kind === 'checklists' ? 0 : newQuantity,
        inventory_id: target.id,
        barcodes: [{ code: scan.code, format: scan.format }],
      });
      return `Creato "${name}" in ${target.name} con codice ${scan.code}`;
    });

  const submitAssociate = () =>
    run(async () => {
      if (!scan || selectedItemId === null) throw new Error('Seleziona un oggetto');
      const item = targetItems.find((i) => i.id === selectedItemId);
      await addItemBarcode(selectedItemId, scan.code, scan.format);
      return `Codice ${scan.code} associato a "${item?.name ?? ''}"`;
    });

  const startManage = async (nextMode: Mode) => {
    setError(null);
    setMode(nextMode);
    if (targets.length === 0) {
      try {
        const all = await loadTargets();
        const preferred =
          all.find((t) => currentTarget && t.kind === currentTarget.kind && t.id === currentTarget.id) ?? all[0];
        setTargetKeySel(preferred ? targetKey(preferred) : '');
      } catch (err) {
        setError(errorMessage(err));
      }
    }
  };

  const rescan = () => {
    closeAll();
    setScannerOpen(true);
  };

  if (!user?.username) return null;

  const product = scan?.lookup.product ?? null;
  const matches = scan?.lookup.matches ?? [];
  const isChecklistMatch = (m: BarcodeMatch) => m.inventory_type === 'CHECKLIST';

  const targetSelect = (
    <div className="mb-2">
      <label className="block text-sm font-medium">Inventario / lista</label>
      <select
        className="w-full border rounded p-1 dark:bg-gray-800"
        value={targetKeySel}
        onChange={(e) => {
          setTargetKeySel(e.target.value);
          setSelectedItemId(null);
        }}
      >
        {targets.map((t) => (
          <option key={targetKey(t)} value={targetKey(t)}>
            {t.kind === 'checklists' ? '☑️' : '📦'} {t.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      {/* mobile: in alto a destra (in basso ci sono le azioni di pagina); desktop: in basso a destra */}
      <button
        onClick={() => setScannerOpen(true)}
        title="Scansiona barcode / QR code"
        aria-label="Scansiona barcode / QR code"
        className="fixed top-4 right-4 md:top-auto md:bottom-4 z-30 w-12 h-12 md:w-14 md:h-14 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-2xl shadow-lg flex items-center justify-center"
      >
        📷
      </button>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={(c, f) => void handleCode(c, f)} />

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
                  {matches.length > 1 ? 'Seleziona l\'oggetto' : matches.length === 1 ? 'Oggetto trovato' : 'Codice nuovo'}
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
                ) : mode === 'menu' ? (
                  <>
                    {matches.length === 0 && (
                      <p className="text-sm mb-3">Nessun oggetto ha questo codice.</p>
                    )}
                    <ul className="mb-4 space-y-2">
                      {matches.map((m) => {
                        const qty = matchQty[m.item_id] ?? m.quantity ?? 0;
                        return (
                          <li key={m.item_id} className="border rounded p-3">
                            <div className="font-medium">{m.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              {isChecklistMatch(m) ? '☑️ Lista' : '📦 Inventario'}: {m.inventory_name ?? m.inventory_id}
                              {' · '}
                              {isChecklistMatch(m) ? (qty ? 'Completato' : 'Da fare') : `Quantità: ${qty}`}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {canEdit && isChecklistMatch(m) && (
                                <button disabled={busy} onClick={() => void setQuantity(m, qty ? 0 : 1)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                                  {qty ? 'Segna da fare' : 'Segna completato'}
                                </button>
                              )}
                              {canEdit && !isChecklistMatch(m) && (
                                <>
                                  <button disabled={busy} onClick={() => void setQuantity(m, qty + 1)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">+1</button>
                                  <button disabled={busy || !qty} onClick={() => void setQuantity(m, qty - 1)} className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">−1</button>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Qtà"
                                    className="w-16 border rounded p-1 text-center dark:bg-gray-800"
                                    value={quantities[m.item_id] ?? ''}
                                    onChange={(e) => setQuantities((prev) => ({ ...prev, [m.item_id]: e.target.value }))}
                                  />
                                  <button
                                    disabled={busy || !(quantities[m.item_id] ?? '').trim()}
                                    onClick={() => void setQuantity(m, Number(quantities[m.item_id]))}
                                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                  >
                                    Imposta
                                  </button>
                                </>
                              )}
                              <button onClick={() => openMatch(m)} className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">
                                {canEdit ? 'Apri / modifica' : 'Apri'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                    {canEdit && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        <button onClick={() => void startManage('create')} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                          Crea nuovo oggetto
                        </button>
                        <button onClick={() => void startManage('associate')} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                          Associa ad altro oggetto
                        </button>
                      </div>
                    )}
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

                    {targetSelect}

                    {mode === 'create' ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitCreate();
                        }}
                      >
                        <div className="mb-2">
                          <label className="block text-sm font-medium">Nome</label>
                          <input autoFocus className="w-full border rounded p-1 dark:bg-gray-800" value={newName} onChange={(e) => setNewName(e.target.value)} />
                        </div>
                        <div className="mb-2">
                          <label className="block text-sm font-medium">Descrizione</label>
                          <input className="w-full border rounded p-1 dark:bg-gray-800" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                        </div>
                        {target?.kind !== 'checklists' && (
                          <div className="mb-3">
                            <label className="block text-sm font-medium">Quantità</label>
                            <input
                              type="number"
                              min="0"
                              className="w-20 border rounded p-1 text-center dark:bg-gray-800"
                              value={newQuantity}
                              onChange={(e) => setNewQuantity(Math.max(0, Number(e.target.value)))}
                            />
                          </div>
                        )}
                        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={matches.length > 0 ? () => setMode('menu') : closeAll} className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600">
                            {matches.length > 0 ? 'Indietro' : 'Annulla'}
                          </button>
                          <button type="submit" disabled={busy || !newName.trim() || !target} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">Crea</button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <input
                          className="w-full border rounded p-1 mb-2 dark:bg-gray-800"
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
                          <button type="button" onClick={matches.length > 0 ? () => setMode('menu') : closeAll} className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600">
                            {matches.length > 0 ? 'Indietro' : 'Annulla'}
                          </button>
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
