import { useEffect, useMemo, useState } from "react";
import {
  listBackups,
  createBackup,
  downloadBackup,
  deleteBackup,
  deleteBackupsBulk,
  restoreBackup,
  restoreBackupGuided,
  uploadBackup,
  getBackupSchedule,
  getSetting
} from "../../api";
import BackupScheduleManager from "./BackupScheduleManager";

export default function BackupManagementPage() {
  const [backups, setBackups] = useState<{
    filename: string;
    size: number;
    modified: string;
    has_metadata?: boolean;
    db_alembic_version?: string | null;
    current_db_alembic_version?: string | null;
    restorable_on_current_db?: boolean;
    metadata?: {
      format?: string;
      created_at?: string;
      db_alembic_version?: string;
    } | null;
  }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState<{
    frequency: string;
    interval_days?: number;
    interval_hours?: number;
    interval_minutes?: number;
    retention: number;
  } | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("");
  const [backupTypeFilter, setBackupTypeFilter] = useState<"all" | "manual" | "auto">("all");
  const [sortField, setSortField] = useState<"filename" | "modified" | "size">("modified");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedBackupNames, setSelectedBackupNames] = useState<string[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<{
    filename: string;
    metadata?: {
      format?: string;
      created_at?: string;
      db_alembic_version?: string;
    } | null;
    db_alembic_version?: string | null;
    current_db_alembic_version?: string | null;
    restorable_on_current_db?: boolean;
  } | null>(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const settings = await getBackupSchedule();
        if (settings && typeof settings === "object") {
          setScheduleConfig({
            frequency: settings.frequency || "none",
            interval_days: settings.interval_days || 0,
            interval_hours: settings.interval_hours || 0,
            interval_minutes: settings.interval_minutes || 0,
            retention: settings.retention || 7
          });
        } else {
          setScheduleConfig(null);
        }
        // Caricamento di lastRunSetting separato dal controllo su settings
        try {
          const lastRunSetting = await getSetting("BACKUP_LAST_RUN");
          if (typeof lastRunSetting === "string") {
            setLastRun(new Date(lastRunSetting).toLocaleString());
          } else if (lastRunSetting && typeof lastRunSetting === "object" && "value" in lastRunSetting) {
            setLastRun(new Date(lastRunSetting.value).toLocaleString());
          }
        } catch (err) {
          console.error("Errore nel caricamento di BACKUP_LAST_RUN:", err);
        }
      } catch (error) {
        console.error("Errore nel caricamento della schedulazione:", error);
      }
    };
    fetchSchedule();
  }, []);

  useEffect(() => {
    if (message !== "") {
      const timer = setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const data = await listBackups();
      setBackups(
        (
          data as {
            filename: string;
            size: number;
            modified: string;
            has_metadata?: boolean;
            db_alembic_version?: string | null;
            current_db_alembic_version?: string | null;
            restorable_on_current_db?: boolean;
            metadata?: {
              format?: string;
              created_at?: string;
              db_alembic_version?: string;
            } | null;
          }[]
        ).sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      );
    } catch (error) {
      console.error("Errore nel caricamento dei backup:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayedBackups = useMemo(() => {
    return backups
      .filter((b) => {
        const matchText = b.filename.toLowerCase().includes(filterText.toLowerCase());
        const isAuto = b.filename.startsWith("auto_");
        const matchType =
          backupTypeFilter === "all" ||
          (backupTypeFilter === "manual" && !isAuto) ||
          (backupTypeFilter === "auto" && isAuto);
        return matchText && matchType;
      })
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (sortField === "modified") {
          return sortDirection === "asc"
            ? new Date(aVal).getTime() - new Date(bVal).getTime()
            : new Date(bVal).getTime() - new Date(aVal).getTime();
        }
        return sortDirection === "asc"
          ? aVal > bVal
            ? 1
            : -1
          : aVal < bVal
          ? 1
          : -1;
      });
  }, [backups, filterText, backupTypeFilter, sortField, sortDirection]);

  useEffect(() => {
    const available = new Set(displayedBackups.map((b) => b.filename));
    setSelectedBackupNames((prev) => prev.filter((name) => available.has(name)));
  }, [displayedBackups]);

  const createBackupLocal = async () => {
    setLoading(true);
    try {
      const success = await createBackup();
      if (success) {
        setMessage("Backup creato con successo!");
        setMessageType("success");
        fetchBackups();
      } else {
        setMessage("Errore nella creazione del backup.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Errore nella creazione del backup:", error);
      setMessage("Errore nella creazione del backup.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const uploadBackupLocal = async () => {
    if (!selectedFile) {
      setMessage("Nessun file selezionato.");
      setMessageType("error");
      return;
    }
    setLoading(true);
    try {
      await uploadBackup(selectedFile);
      setMessage("Backup caricato con successo!");
      setMessageType("success");
      setSelectedFile(null);
      fetchBackups();
    } catch (error) {
      console.error("Errore nel caricamento del backup:", error);
      setMessage("Errore nel caricamento del backup.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupLocal = (filename: string) => {
    downloadBackup(filename);
  };

  const deleteBackupLocal = async (filename: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il backup ${filename}?`)) return;
    setLoading(true);
    try {
      await deleteBackup(filename);
      setMessage("Backup eliminato con successo!");
      setMessageType("success");
      fetchBackups();
    } catch (error) {
      console.error("Errore nell'eliminazione del backup:", error);
      setMessage("Errore nell'eliminazione del backup.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const toggleBackupSelection = (filename: string) => {
    setSelectedBackupNames((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]
    );
  };

  const selectAllDisplayed = () => {
    setSelectedBackupNames(displayedBackups.map((b) => b.filename));
  };

  const clearSelection = () => {
    setSelectedBackupNames([]);
  };

  const downloadSelectedBackups = () => {
    if (selectedBackupNames.length === 0) return;
    selectedBackupNames.forEach((filename) => downloadBackupLocal(filename));
    setMessage(`Avviato download di ${selectedBackupNames.length} backup`);
    setMessageType("success");
  };

  const deleteSelectedBackups = async () => {
    if (selectedBackupNames.length === 0) return;
    if (!window.confirm(`Sei sicuro di voler eliminare ${selectedBackupNames.length} backup selezionati?`)) return;

    setLoading(true);
    try {
      const result = await deleteBackupsBulk(selectedBackupNames);
      const deletedCount = result.deleted.length;
      const skippedCount = result.missing.length + result.invalid.length;
      setMessage(
        skippedCount > 0
          ? `Eliminati ${deletedCount} backup. Saltati ${skippedCount} elementi non validi/non trovati.`
          : `Eliminati ${deletedCount} backup con successo!`
      );
      setMessageType(skippedCount > 0 ? "error" : "success");
      clearSelection();
      fetchBackups();
    } catch (error) {
      console.error("Errore nell'eliminazione massiva dei backup:", error);
      setMessage("Errore nell'eliminazione massiva dei backup.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const restoreBackupLocal = async (filename: string) => {
    setLoading(true);
    try {
      await restoreBackup(filename);
      setMessage("Ripristino base avviato con successo!");
      setMessageType("success");
    } catch (error) {
      console.error("Errore nel ripristino del backup:", error);
      setMessage("Errore nel ripristino del backup.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const restoreBackupAdvancedLocal = async (filename: string) => {
    const overwriteUsersRoles = window.confirm("Vuoi sovrascrivere anche utenti e ruoli?");
    const overwriteSettings = window.confirm("Vuoi sovrascrivere anche i settings?");

    let overwriteAdmin = false;
    if (overwriteUsersRoles) {
      overwriteAdmin = window.confirm("Per sovrascrivere utenti/ruoli devi sovrascrivere anche admin. Confermi?");
      if (!overwriteAdmin) {
        setMessage("Ripristino avanzato annullato: senza sovrascrivere admin non è possibile sovrascrivere utenti/ruoli.");
        setMessageType("error");
        return;
      }
    }

    setLoading(true);
    try {
      await restoreBackupGuided(filename, {
        mode: "advanced",
        overwrite_users_roles: overwriteUsersRoles,
        overwrite_settings: overwriteSettings,
        overwrite_admin: overwriteAdmin,
      });
      setMessage("Ripristino avanzato avviato con successo!");
      setMessageType("success");
    } catch (error) {
      console.error("Errore nel ripristino avanzato:", error);
      setMessage("Errore nel ripristino avanzato.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBaseFromModal = async () => {
    if (!restoreTarget) return;
    if (!window.confirm(`Confermi il ripristino BASE del backup ${restoreTarget.filename}?`)) return;
    await restoreBackupLocal(restoreTarget.filename);
    setRestoreTarget(null);
  };

  const handleRestoreAdvancedFromModal = async () => {
    if (!restoreTarget) return;
    if (!window.confirm(`Confermi il ripristino AVANZATO del backup ${restoreTarget.filename}?`)) return;
    await restoreBackupAdvancedLocal(restoreTarget.filename);
    setRestoreTarget(null);
  };

  const giorniSettimana = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Gestione Backup</h2>
      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div>
            <p className="font-medium">Backup automatico:</p>
            <p className="text-sm text-gray-700 dark:text-white">
              {scheduleConfig && scheduleConfig.frequency !== "none"
                ? `Attivo - Frequenza: ${scheduleConfig.frequency} ${
                    scheduleConfig.frequency === "hourly"
                      ? `ogni ${scheduleConfig.interval_minutes ?? 60} minuti`
                      : scheduleConfig.frequency === "daily"
                        ? `alle ${scheduleConfig.interval_hours?.toString().padStart(2, "0")}:${scheduleConfig.interval_minutes?.toString().padStart(2, "0")}`
                        : scheduleConfig.frequency === "weekly"
                          ? ` giorno: ${giorniSettimana[scheduleConfig.interval_days ?? 0]} alle ${scheduleConfig.interval_hours ?? 0}:${scheduleConfig.interval_minutes ?? 0}`
                          : ""
                } - Retention: ${scheduleConfig.retention} backup${
                  lastRun ? ` - Ultimo backup: ${lastRun}` : ""
                }`
                : "Nessuna schedulazione configurata."}
            </p>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="mt-2 sm:mt-0 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Modifica Schedulazione
          </button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
        <input
          type="file"
          accept=".sql"
          onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
          className="border rounded p-1"
        />
        <button
          onClick={uploadBackupLocal}
          disabled={loading || !selectedFile}
          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Carica Backup
          {loading && <span className="ml-2 animate-spin">⏳</span>}
        </button>
      </div>
      <button
        onClick={createBackupLocal}
        disabled={loading}
        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Crea Backup
        {loading && <span className="ml-2 animate-spin">⏳</span>}
      </button>
      {message && (
        <div className={`fixed bottom-4 right-4 z-50 p-3 rounded shadow-lg text-white ${messageType === "success" ? "bg-green-500" : "bg-red-500"} transition-opacity duration-1000`}>
          {message}
        </div>
      )}

      {/* Filtri e ordinamenti */}
      <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-2 md:space-y-0">
        <div>
          <label className="block text-sm font-medium">Filtra per nome:</label>
          <input
            type="text"
            placeholder="Filtra per nome..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFilterText("");
            }}
            className="border rounded p-1 w-full sm:w-64"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Visualizza:</label>
          <select
            value={backupTypeFilter}
            onChange={(e) => setBackupTypeFilter(e.target.value as "all" | "manual" | "auto")}
            className="border rounded px-2 py-1"
          >
            <option value="all">Tutti</option>
            <option value="manual">Manuali</option>
            <option value="auto">Automatici</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Ordina per:</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as "filename" | "modified" | "size")}
            className="border rounded px-2 py-1"
          >
            <option value="modified">Data</option>
            <option value="filename">Nome</option>
            <option value="size">Dimensione</option>
          </select>
          <button
            onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="ml-2 px-2 py-1 border rounded"
          >
            {sortDirection === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={selectAllDisplayed}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
        >
          Seleziona tutti (visibili)
        </button>
        <button
          onClick={clearSelection}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
        >
          Deseleziona
        </button>
        <button
          onClick={downloadSelectedBackups}
          disabled={selectedBackupNames.length === 0}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Scarica selezionati ({selectedBackupNames.length})
        </button>
        <button
          onClick={deleteSelectedBackups}
          disabled={selectedBackupNames.length === 0}
          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Elimina selezionati ({selectedBackupNames.length})
        </button>
      </div>

      <ul className="space-y-2">
        {displayedBackups.map((backup) => {
            const isAuto = backup.filename.startsWith("auto_");
            return (
              <li
                key={backup.filename}
                className={`flex flex-col sm:flex-row sm:justify-between sm:items-center border p-2 rounded ${isAuto ? "bg-yellow-50 border-yellow-400 dark:bg-yellow-500 dark:border-yellow-700 dark:text-black" : ""}`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedBackupNames.includes(backup.filename)}
                    onChange={() => toggleBackupSelection(backup.filename)}
                    className="mt-1 w-4 h-4"
                    title={`Seleziona ${backup.filename}`}
                  />
                  <div className="flex-1">
                  <div className="break-words">{backup.filename}
                    {isAuto && <span className="inline-block text-xs font-semibold text-yellow-700 bg-yellow-200 rounded px-2 py-0.5 ml-2">Automatico</span>}
                  </div>
                  <div className="text-sm text-gray-600">
                    {(backup.size / 1024).toFixed(2)} KB - {new Date(backup.modified).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 space-y-1">
                    <div>
                      <span className="font-semibold">Formato:</span>{" "}
                      {backup.metadata?.format || (backup.has_metadata ? "n/d" : "legacy/no-metadata")}
                    </div>
                    <div>
                      <span className="font-semibold">Revisione backup:</span>{" "}
                      {backup.db_alembic_version || "n/d"}
                    </div>
                    <div>
                      <span className="font-semibold">Revisione DB corrente:</span>{" "}
                      {backup.current_db_alembic_version || "n/d"}
                    </div>
                    <div>
                      <span className="font-semibold">Ripristinabile:</span>{" "}
                      {backup.restorable_on_current_db ? (
                        <span className="text-green-700 dark:text-green-400 font-semibold">SI</span>
                      ) : (
                        <span className="text-red-700 dark:text-red-400 font-semibold">NO</span>
                      )}
                    </div>
                    {backup.metadata?.created_at && (
                      <div>
                        <span className="font-semibold">Creato (meta):</span>{" "}
                        {new Date(backup.metadata.created_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0">
                  <button
                    onClick={() => downloadBackupLocal(backup.filename)}
                    className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Scarica
                  </button>
                  <button
                    onClick={() =>
                      setRestoreTarget({
                        filename: backup.filename,
                        metadata: backup.metadata,
                        db_alembic_version: backup.db_alembic_version,
                        current_db_alembic_version: backup.current_db_alembic_version,
                        restorable_on_current_db: backup.restorable_on_current_db,
                      })
                    }
                    className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Ripristina
                  </button>
                  <button
                    onClick={() => deleteBackupLocal(backup.filename)}
                    className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Elimina
                  </button>
                </div>
              </li>
            );
          })}
      </ul>
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/30 bg-opacity-30 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-full max-w-lg">
            <BackupScheduleManager
              currentConfig={scheduleConfig}
              onSaved={() => {
                setShowScheduleModal(false);
                fetchBackups();
              }}
            />
            <div className="text-right mt-4">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreTarget && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-full max-w-xl space-y-4">
            <h3 className="text-lg font-semibold">Ripristino backup</h3>
            <p className="text-sm break-all">
              <span className="font-semibold">File:</span> {restoreTarget.filename}
            </p>

            <div className="text-sm space-y-1 border rounded p-3 bg-gray-50 dark:bg-gray-800">
              <p>
                <span className="font-semibold">Formato:</span> {restoreTarget.metadata?.format || "n/d"}
              </p>
              <p>
                <span className="font-semibold">Revisione backup:</span> {restoreTarget.db_alembic_version || "n/d"}
              </p>
              <p>
                <span className="font-semibold">Revisione DB corrente:</span> {restoreTarget.current_db_alembic_version || "n/d"}
              </p>
              <p>
                <span className="font-semibold">Creato (meta):</span>{" "}
                {restoreTarget.metadata?.created_at ? new Date(restoreTarget.metadata.created_at).toLocaleString() : "n/d"}
              </p>
              <p>
                <span className="font-semibold">Ripristinabile:</span>{" "}
                {restoreTarget.restorable_on_current_db ? (
                  <span className="text-green-700 dark:text-green-400 font-semibold">SI</span>
                ) : (
                  <span className="text-red-700 dark:text-red-400 font-semibold">NO</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={handleRestoreBaseFromModal}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Base
              </button>
              <button
                onClick={handleRestoreAdvancedFromModal}
                className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Avanzato
              </button>
              <button
                onClick={() => setRestoreTarget(null)}
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
