import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getInventoryAuditLogs,
  getItemAuditLogs,
  getSetting,
  setSetting,
} from "../../api";
import { InventoryVersion, ItemVersion } from "../../types";

type OperationFilter = "" | "CREATE" | "UPDATE" | "DELETE";
type TargetFilter = "ALL" | "ITEMS" | "INVENTORIES";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AuditLogPage() {
  const [target, setTarget] = useState<TargetFilter>("ALL");
  const [operation, setOperation] = useState<OperationFilter>("");
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return toLocalInputValue(sevenDaysAgo);
  });
  const [toDate, setToDate] = useState(() => toLocalInputValue(new Date()));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [retentionDays, setRetentionDays] = useState("90");
  const [itemLogs, setItemLogs] = useState<ItemVersion[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryVersion[]>([]);

  const sortedItemLogs = useMemo(
    () => [...itemLogs].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()),
    [itemLogs]
  );
  const sortedInventoryLogs = useMemo(
    () => [...inventoryLogs].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()),
    [inventoryLogs]
  );

  const fieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      name: "Nome",
      description: "Descrizione",
      quantity: "Quantita",
      inventory_id: "Inventario",
      owner_id: "Proprietario",
      type: "Tipo",
    };
    return labels[field] || field;
  };

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "vuoto";
    if (typeof value === "boolean") return value ? "si" : "no";
    return String(value);
  };

  const renderDiff = (log: ItemVersion | InventoryVersion) => {
    if (log.operation === "CREATE") {
      return <span className="text-green-700 dark:text-green-400">Record creato</span>;
    }
    if (log.operation === "DELETE") {
      return <span className="text-red-700 dark:text-red-400">Record eliminato</span>;
    }
    if (!log.diff) {
      return <span className="text-gray-500">Nessuna modifica dettagliata</span>;
    }

    try {
      const parsed = JSON.parse(log.diff) as Record<string, { from: unknown; to: unknown }>;
      const entries = Object.entries(parsed);
      if (entries.length === 0) {
        return <span className="text-gray-500">Nessuna modifica rilevata</span>;
      }

      return (
        <div className="space-y-1">
          {entries.map(([field, values]) => (
            <div key={field}>
              <span className="font-semibold">{fieldLabel(field)}:</span>{" "}
              <span>{formatValue(values?.from)} -&gt; {formatValue(values?.to)}</span>
            </div>
          ))}
        </div>
      );
    } catch {
      return <span className="text-gray-500">Formato diff non valido</span>;
    }
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      if (target === "ALL" || target === "ITEMS") {
        const logs = await getItemAuditLogs(
          undefined,
          undefined,
          operation || undefined,
          fromDate || undefined,
          toDate || undefined
        );
        setItemLogs(logs);
      } else {
        setItemLogs([]);
      }

      if (target === "ALL" || target === "INVENTORIES") {
        const logs = await getInventoryAuditLogs(
          undefined,
          operation || undefined,
          undefined,
          fromDate || undefined,
          toDate || undefined
        );
        setInventoryLogs(logs);
      } else {
        setInventoryLogs([]);
      }
    } catch {
      setMessage("Errore nel caricamento audit logs");
    } finally {
      setLoading(false);
    }
  }, [target, operation, fromDate, toDate]);

  const loadRetention = useCallback(async () => {
    try {
      const setting = await getSetting("AUDIT_RETENTION_DAYS");
      setRetentionDays(setting.value || "90");
    } catch {
      setRetentionDays("90");
    }
  }, []);

  useEffect(() => {
    loadRetention();
    loadLogs();
  }, [loadRetention, loadLogs]);

  const saveRetention = async () => {
    const parsed = Number(retentionDays);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setMessage("AUDIT_RETENTION_DAYS deve essere un intero positivo");
      return;
    }

    try {
      await setSetting("AUDIT_RETENTION_DAYS", String(parsed));
      setMessage("Retention audit aggiornata con successo");
    } catch {
      setMessage("Errore durante il salvataggio della retention audit");
    }
  };

  const applyPreset = (preset: "24h" | "7d" | "30d" | "all") => {
    const now = new Date();
    if (preset === "all") {
      setFromDate("");
      setToDate("");
      return;
    }

    const from = new Date(now);
    if (preset === "24h") {
      from.setHours(from.getHours() - 24);
    } else if (preset === "7d") {
      from.setDate(from.getDate() - 7);
    } else {
      from.setMonth(from.getMonth() - 1);
    }

    setFromDate(toLocalInputValue(from));
    setToDate(toLocalInputValue(now));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Audit</h2>

      <div className="border rounded p-4 space-y-3">
        <h3 className="font-semibold">Retention storico audit</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          I record di audit orfani piu vecchi di questo valore verranno puliti dal job schedulato.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="number"
            min={1}
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            className="border rounded px-2 py-1 w-36"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">giorni</span>
          <button
            onClick={saveRetention}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Salva
          </button>
        </div>
      </div>

      <div className="border rounded p-4 space-y-3">
        <h3 className="font-semibold">Audit logs</h3>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as TargetFilter)}
            className="border rounded px-2 py-1"
          >
            <option value="ALL">Tutti</option>
            <option value="ITEMS">Solo item</option>
            <option value="INVENTORIES">Solo inventari/liste</option>
          </select>

          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value as OperationFilter)}
            className="border rounded px-2 py-1"
          >
            <option value="">Operazioni: tutte</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>

          <button
            onClick={loadLogs}
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Aggiorna
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-end">
          <div className="flex flex-col">
            <label className="text-sm">Da</label>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm">A</label>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
          <button
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset periodo
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyPreset("24h")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
          >
            Ultime 24h
          </button>
          <button
            onClick={() => applyPreset("7d")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
          >
            Ultimi 7 giorni
          </button>
          <button
            onClick={() => applyPreset("30d")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
          >
            Ultimi 30 giorni
          </button>
          <button
            onClick={() => applyPreset("all")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
          >
            Tutto
          </button>
        </div>

        {loading && <p className="text-sm text-gray-500">Caricamento logs...</p>}

        {!loading && (target === "ALL" || target === "ITEMS") && (
          <div className="space-y-2">
            <h4 className="font-semibold">Item logs ({sortedItemLogs.length})</h4>
            <div className="max-h-72 overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="text-left p-2">Quando</th>
                    <th className="text-left p-2">Operazione</th>
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2">Utente</th>
                    <th className="text-left p-2">Versione</th>
                    <th className="text-left p-2">Modifiche</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItemLogs.map((log) => (
                    <tr key={`item-${log.id}`} className="border-t">
                      <td className="p-2">{new Date(log.changed_at).toLocaleString()}</td>
                      <td className="p-2">{log.operation}</td>
                      <td className="p-2">#{log.item_id} - {log.name}</td>
                      <td className="p-2">{log.changed_by_username || "-"}</td>
                      <td className="p-2">v{log.version_num}</td>
                      <td className="p-2">{renderDiff(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && (target === "ALL" || target === "INVENTORIES") && (
          <div className="space-y-2">
            <h4 className="font-semibold">Inventario/lista logs ({sortedInventoryLogs.length})</h4>
            <div className="max-h-72 overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="text-left p-2">Quando</th>
                    <th className="text-left p-2">Operazione</th>
                    <th className="text-left p-2">Entita</th>
                    <th className="text-left p-2">Utente</th>
                    <th className="text-left p-2">Versione</th>
                    <th className="text-left p-2">Modifiche</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInventoryLogs.map((log) => (
                    <tr key={`inv-${log.id}`} className="border-t">
                      <td className="p-2">{new Date(log.changed_at).toLocaleString()}</td>
                      <td className="p-2">{log.operation}</td>
                      <td className="p-2">#{log.inventory_id} - {log.name} ({log.type})</td>
                      <td className="p-2">{log.changed_by_username || "-"}</td>
                      <td className="p-2">v{log.version_num}</td>
                      <td className="p-2">{renderDiff(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {message && (
        <p className={`text-sm ${message.toLowerCase().includes("errore") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
