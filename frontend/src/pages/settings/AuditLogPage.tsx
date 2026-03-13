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

export default function AuditLogPage() {
  const [target, setTarget] = useState<TargetFilter>("ALL");
  const [operation, setOperation] = useState<OperationFilter>("");
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

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      if (target === "ALL" || target === "ITEMS") {
        const logs = await getItemAuditLogs(undefined, undefined, operation || undefined);
        setItemLogs(logs);
      } else {
        setItemLogs([]);
      }

      if (target === "ALL" || target === "INVENTORIES") {
        const logs = await getInventoryAuditLogs(undefined, operation || undefined, undefined);
        setInventoryLogs(logs);
      } else {
        setInventoryLogs([]);
      }
    } catch {
      setMessage("Errore nel caricamento audit logs");
    } finally {
      setLoading(false);
    }
  }, [target, operation]);

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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Audit</h2>

      <div className="border rounded p-4 space-y-3">
        <h3 className="font-semibold">Retention storico audit</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          I record di audit piu vecchi di questo valore verranno puliti dal job schedulato.
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
