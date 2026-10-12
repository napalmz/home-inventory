import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import {
  createAssignment, createItem, deleteAssignment, getAssignmentsBySource,
  getChecklists, getInventories, getInventoryItems, updateAssignment,
} from '../api';
import type { Assignment, AssignmentSummary, InventoryItem, Item } from '../types';

export const ASSIGNMENTS_CHANGED_EVENT = 'barcode-items-changed';
const notifyChanged = () => window.dispatchEvent(new Event(ASSIGNMENTS_CHANGED_EVENT));

type Named = { id: number; name: string };

function errorMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : 'Operazione non riuscita';
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog open onClose={onClose} className="relative z-[70]">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4">
        <Dialog.Panel className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white dark:bg-gray-800 p-4 space-y-3">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {children}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function QtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" className="h-11 w-11 rounded bg-gray-300 dark:bg-gray-600 text-xl"
        onClick={() => onChange(Math.max(1, value - 1))}>−</button>
      <span className="min-w-[2rem] text-center text-xl font-semibold">{value}</span>
      <button type="button" className="h-11 w-11 rounded bg-gray-300 dark:bg-gray-600 text-xl"
        onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

function Actions({ onClose, onConfirm, label, busy, disabled }: {
  onClose: () => void; onConfirm?: () => void; label?: string; busy?: boolean; disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={onClose} className="flex-1 rounded bg-gray-300 dark:bg-gray-600 py-3">
        {onConfirm ? 'Annulla' : 'Chiudi'}
      </button>
      {onConfirm && (
        <button type="button" onClick={onConfirm} disabled={busy || disabled}
          className="flex-1 rounded bg-blue-600 text-white py-3 disabled:opacity-50">
          {busy ? '...' : label}
        </button>
      )}
    </div>
  );
}

/** Dall'inventario: scegli lista e quantita', crea la riga e il collegamento. */
export function AssignToListDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const [lists, setLists] = useState<Named[]>([]);
  const [listId, setListId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getChecklists().then((data) => {
      setLists(data);
      if (data.length === 1) setListId(data[0].id);
    }).catch((err) => setError(errorMessage(err)));
  }, []);

  const submit = async () => {
    if (listId == null) return;
    setBusy(true);
    setError(null);
    try {
      const row = await createItem({ name: item.name, description: item.description, quantity: 0, inventory_id: listId });
      await createAssignment(row.id, item.id, qty);
      notifyChanged();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Shell title={`Assegna "${item.name}" a una lista`} onClose={onClose}>
      <select value={listId ?? ''} onChange={(e) => setListId(e.target.value ? Number(e.target.value) : null)}
        className="w-full border rounded p-3 dark:bg-gray-700">
        <option value="">Scegli la lista…</option>
        {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {lists.length === 0 && <p className="text-sm text-gray-500">Non hai ancora nessuna lista.</p>}
      <QtyStepper value={qty} onChange={setQty} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Actions onClose={onClose} onConfirm={submit} label="Assegna" busy={busy} disabled={listId == null} />
    </Shell>
  );
}

/** Dalla lista: scegli un item di inventario da prelevare. */
export function AddFromInventoryDialog({ listId, onClose }: { listId: number; onClose: () => void }) {
  const [inventories, setInventories] = useState<Named[]>([]);
  const [inventoryId, setInventoryId] = useState<number | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInventories().then((data) => {
      setInventories(data);
      if (data.length === 1) setInventoryId(data[0].id);
    }).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (inventoryId == null) return;
    let cancelled = false;
    getInventoryItems(inventoryId).then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); });
    return () => { cancelled = true; };
  }, [inventoryId]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((i) => !needle || i.name.toLowerCase().includes(needle)
      || (i.barcodes ?? []).some((b) => b.code.includes(needle)));
  }, [items, search]);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const row = await createItem({ name: picked.name, description: picked.description, quantity: 0, inventory_id: listId });
      await createAssignment(row.id, picked.id, qty);
      notifyChanged();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (picked) {
    return (
      <Shell title={picked.name} onClose={onClose}>
        <p className="text-sm text-gray-500">Disponibili: {picked.net_qty ?? picked.quantity} · quanti ne vuoi prendere?</p>
        <QtyStepper value={qty} onChange={setQty} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="flex-1 rounded bg-gray-300 dark:bg-gray-600 py-3" onClick={() => setPicked(null)}>Indietro</button>
          <button type="button" className="flex-1 rounded bg-blue-600 text-white py-3 disabled:opacity-50" onClick={submit} disabled={busy}>
            {busy ? '...' : 'Aggiungi'}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Aggiungi da inventario" onClose={onClose}>
      <select value={inventoryId ?? ''} onChange={(e) => setInventoryId(e.target.value ? Number(e.target.value) : null)}
        className="w-full border rounded p-3 dark:bg-gray-700">
        <option value="">Scegli l'inventario…</option>
        {inventories.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      {inventoryId != null && (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per nome o barcode…"
            className="w-full border rounded p-3 dark:bg-gray-700" />
          <ul className="max-h-[45vh] overflow-y-auto divide-y dark:divide-gray-700">
            {visible.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => { setPicked(i); setQty(1); }}
                  className="w-full flex justify-between items-center gap-2 py-3 text-left">
                  <span className="truncate">{i.name}</span>
                  <span className="text-sm text-gray-500 whitespace-nowrap">{i.net_qty ?? i.quantity}</span>
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="py-3 text-sm text-gray-500">Nessun item</li>}
          </ul>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Actions onClose={onClose} />
    </Shell>
  );
}

/** Dalla riga di lista: cambia quantita' o scollega. */
export function EditAssignmentDialog({ assignment, onClose }: { assignment: AssignmentSummary; onClose: () => void }) {
  const [qty, setQty] = useState(assignment.qty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      notifyChanged();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Shell title={assignment.source_name ?? 'Assegnazione'} onClose={onClose}>
      <p className="text-sm text-gray-500">
        📦 {assignment.source_inventory_name} · stock {assignment.source_stock ?? '?'}
      </p>
      <QtyStepper value={qty} onChange={setQty} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={busy}
        onClick={() => { if (window.confirm('Scollegare la riga dall\'inventario?')) run(() => deleteAssignment(assignment.id)); }}
        className="w-full rounded border border-red-500 text-red-600 py-2">
        Scollega dall'inventario
      </button>
      <Actions onClose={onClose} onConfirm={() => run(() => updateAssignment(assignment.id, qty))}
        label="Salva" busy={busy} disabled={qty === assignment.qty} />
    </Shell>
  );
}

/** Dall'inventario: da quali liste arrivano le quantita' assegnate. */
export function SourceAssignmentsDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const [rows, setRows] = useState<Assignment[] | null>(null);
  useEffect(() => {
    getAssignmentsBySource(item.id).then(setRows).catch(() => setRows([]));
  }, [item.id]);

  return (
    <Shell title={item.name} onClose={onClose}>
      <div className="grid grid-cols-3 text-center text-sm">
        <div><div className="text-xl font-semibold">{item.quantity}</div>lordo</div>
        <div><div className="text-xl font-semibold">−{item.assigned_qty ?? 0}</div>assegnato</div>
        <div><div className={`text-xl font-semibold ${(item.net_qty ?? item.quantity) < 0 ? 'text-red-600' : ''}`}>
          {item.net_qty ?? item.quantity}</div>netto</div>
      </div>
      <ul className="divide-y dark:divide-gray-700">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="flex justify-between py-2 text-sm">
            <span>{r.list_name}</span><span>×{r.qty}</span>
          </li>
        ))}
        {rows && rows.length === 0 && <li className="py-2 text-sm text-gray-500">Nessuna assegnazione in essere</li>}
      </ul>
      <Actions onClose={onClose} />
    </Shell>
  );
}
