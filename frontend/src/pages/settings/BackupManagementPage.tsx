import { useEffect, useState } from "react";
import { listBackups, createBackup, downloadBackup, deleteBackup, restoreBackup, uploadBackup } from "../../api";

export default function BackupManagementPage() {
  const [backups, setBackups] = useState<{ filename: string; size: number; modified: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchBackups();
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

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Gestione Backup</h2>
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
      <ul className="space-y-2">
        {backups.map((backup) => (
            <li key={backup.filename} className="flex flex-col sm:flex-row sm:justify-between sm:items-center border p-2 rounded">
            <div className="flex-1">
                <div className="break-words">{backup.filename}</div>
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
        ))}
      </ul>
    </div>
  );
}
