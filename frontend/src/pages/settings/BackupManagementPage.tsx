import { useEffect, useState } from "react";
import {
  listBackups,
  createBackup,
  downloadBackup,
  deleteBackup,
  restoreBackup,
  uploadBackup,
  getBackupSchedule,
  getSetting
} from "../../api";
import BackupScheduleManager from "./BackupScheduleManager";

export default function BackupManagementPage() {
  const [backups, setBackups] = useState<{ filename: string; size: number; modified: string }[]>([]);
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
          const lastRunSetting = await getSetting("BACKUP_LAST_RUN");
          if (typeof lastRunSetting === "string") {
            setLastRun(new Date(lastRunSetting).toLocaleString());
          }
        } else {
          setScheduleConfig(null);
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
      setBackups((data as { filename: string; size: number; modified: string }[]).sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()));
    } catch (error) {
      console.error("Errore nel caricamento dei backup:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const restoreBackupLocal = async (filename: string) => {
    if (!window.confirm(`Sei sicuro di voler ripristinare il backup ${filename}? Verranno sovrascritti i dati attuali.`)) return;
    setLoading(true);
    try {
      await restoreBackup(filename);
      setMessage("Backup ripristinato con successo!");
      setMessageType("success");
    } catch (error) {
      console.error("Errore nel ripristino del backup:", error);
      setMessage("Errore nel ripristino del backup.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const giorniSettimana = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Gestione Backup</h2>
      <div className="p-2 bg-gray-100 rounded">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div>
            <p className="font-medium">Backup automatico:</p>
            <p className="text-sm text-gray-700">
              {scheduleConfig
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

      <ul className="space-y-2">
        {backups
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
          })
          .map((backup) => {
            const isAuto = backup.filename.startsWith("auto_");
            return (
              <li
                key={backup.filename}
                className={`flex flex-col sm:flex-row sm:justify-between sm:items-center border p-2 rounded ${isAuto ? "bg-yellow-50 border-yellow-400" : ""}`}
              >
                <div className="flex-1">
                  <div className="break-words">{backup.filename}
                    {isAuto && <span className="inline-block text-xs font-semibold text-yellow-700 bg-yellow-200 rounded px-2 py-0.5 ml-2">Automatico</span>}
                  </div>
                  <div className="text-sm text-gray-600">
                    {(backup.size / 1024).toFixed(2)} KB - {new Date(backup.modified).toLocaleString()}
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
                    onClick={() => restoreBackupLocal(backup.filename)}
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
        <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow w-full max-w-lg">
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
    </div>
  );
}
