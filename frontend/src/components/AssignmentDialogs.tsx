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

function QtyStepper({ value, onChange, max }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" className="h-11 w-11 rounded bg-gray-300 dark:bg-gray-600 text-xl"
        onClick={() => onChange(Math.max(1, value - 1))}>−</button>
      <span className="min-w-[2rem] text-center text-xl font-semibold">{value}</span>
      <button type="button" className="h-11 w-11 rounded bg-gray-300 dark:bg-gray-600 text-xl disabled:opacity-40"
        disabled={max != null && value >= max}
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}>+</button>
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
      <p className="text-sm text-gray-500">Stock disponibile: {item.quantity}</p>
      <QtyStepper value={qty} onChange={setQty} max={Math.max(1, item.quantity)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Actions onClose={onClose} onConfirm={submit} label="Assegna" busy={busy} disabled={listId == null || item.quantity < 1} />
    </Shell>
  );
}

/** Scegli un item di inventario e la quantita' da prelevare (max = stock). */
export function InventoryPickerDialog({ onClose, onPick }: {
  onClose: () => void;
  onPick: (item: InventoryItem, qty: number) => Promise<void>;
}) {
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
      await onPick(picked, qty);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (picked) {
    return (
      <Shell title={picked.name} onClose={onClose}>
        <p className="text-sm text-gray-500">Stock: {picked.quantity} · quanti ne vuoi prendere?</p>
        <QtyStepper value={qty} onChange={setQty} max={Math.max(1, picked.quantity)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="flex-1 rounded bg-gray-300 dark:bg-gray-600 py-3" onClick={() => setPicked(null)}>Indietro</button>
          <button type="button" className="flex-1 rounded bg-blue-600 text-white py-3 disabled:opacity-50" onClick={submit} disabled={busy || picked.quantity < 1}>
            {busy ? '...' : 'Conferma'}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Scegli da inventario" onClose={onClose}>
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

/** Dalla lista: crea una nuova riga collegata a un item di inventario. */
export function AddFromInventoryDialog({ listId, onClose }: { listId: number; onClose: () => void }) {
  return (
    <InventoryPickerDialog
      onClose={onClose}
      onPick={async (picked, qty) => {
        const row = await createItem({ name: picked.name, description: picked.description, quantity: 0, inventory_id: listId });
        await createAssignment(row.id, picked.id, qty);
        notifyChanged();
        onClose();
      }}
    />
  );
}

/** Nel form di creazione/modifica di una riga di lista: collega (o scollega) un item di inventario. */
export function ListLinkField({ current, onPick, onClear }: {
  current: { name: string; inventoryName?: string | null; qty: number } | null;
  onPick: (item: InventoryItem, qty: number) => Promise<void>;
  onClear: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 rounded border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div className="text-sm font-medium">Preleva da inventario</div>
      {current ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>📦 ×{current.qty} · {current.name}{current.inventoryName ? ` (${current.inventoryName})` : ''}</span>
          <button type="button" onClick={() => onClear()} className="rounded border border-red-500 text-red-600 px-2 py-1">Scollega</button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="w-full rounded bg-gray-200 dark:bg-gray-700 py-2">
          📥 Collega a un item di inventario
        </button>
      )}
      {open && (
        <InventoryPickerDialog
          onClose={() => setOpen(false)}
          onPick={async (item, qty) => { await onPick(item, qty); setOpen(false); }}
        />
      )}
    </div>
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
        {assignment.source_net_qty != null && ` · netto ${assignment.source_net_qty}`}
      </p>
      {(assignment.source_net_qty ?? 0) < 0 && (
        <p className="rounded bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 p-2 text-sm">
          ⚠️ Le assegnazioni in essere superano lo stock di {Math.abs(assignment.source_net_qty ?? 0)}.
        </p>
      )}
      <QtyStepper value={qty} onChange={setQty} max={Math.max(assignment.qty, assignment.source_stock ?? assignment.qty)} />
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

/** Dall'inventario: lordo/netto e assegnazioni in essere, modificabili. */
export function SourceAssignmentsDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAssignmentsBySource(item.id).then(setRows).catch(() => setRows([]));
  }, [item.id]);

  const assigned = (rows ?? []).reduce((sum, r) => sum + r.qty, 0);
  const net = item.quantity - assigned;

  const change = async (row: Assignment, qty: number) => {
    setError(null);
    try {
      await updateAssignment(row.id, qty);
      setRows((cur) => (cur ?? []).map((r) => (r.id === row.id ? { ...r, qty } : r)));
      notifyChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (row: Assignment) => {
    if (!window.confirm(`Rimuovere l'assegnazione da "${row.list_name}"?`)) return;
    setError(null);
    try {
      await deleteAssignment(row.id);
      setRows((cur) => (cur ?? []).filter((r) => r.id !== row.id));
      notifyChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Shell title={item.name} onClose={onClose}>
      <div className="grid grid-cols-3 text-center text-sm">
        <div><div className="text-xl font-semibold">{item.quantity}</div>lordo</div>
        <div><div className="text-xl font-semibold">−{assigned}</div>assegnato</div>
        <div><div className={`text-xl font-semibold ${net < 0 ? 'text-red-600' : ''}`}>{net}</div>netto</div>
      </div>
      {net < 0 && (
        <p className="rounded bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 p-2 text-sm">
          ⚠️ Assegnato oltre lo stock di {Math.abs(net)}.
        </p>
      )}
      <ul className="divide-y dark:divide-gray-700">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="truncate">{r.list_name}</span>
            <span className="flex items-center gap-2">
              <button type="button" className="h-9 w-9 rounded bg-gray-300 dark:bg-gray-600 disabled:opacity-40"
                disabled={r.qty <= 1} onClick={() => change(r, r.qty - 1)}>−</button>
              <span className="min-w-[1.5rem] text-center font-semibold">{r.qty}</span>
              <button type="button" className="h-9 w-9 rounded bg-gray-300 dark:bg-gray-600 disabled:opacity-40"
                disabled={r.qty >= item.quantity} onClick={() => change(r, r.qty + 1)}>+</button>
              <button type="button" className="h-9 w-9 rounded bg-red-600 text-white" onClick={() => remove(r)} title="Rimuovi">🗑️</button>
            </span>
          </li>
        ))}
        {rows && rows.length === 0 && <li className="py-2 text-sm text-gray-500">Nessuna assegnazione in essere</li>}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Actions onClose={onClose} />
    </Shell>
  );
}
