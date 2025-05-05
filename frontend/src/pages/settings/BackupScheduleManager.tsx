import { useState } from "react";
import { updateBackupSchedule, triggerScheduledBackup } from "../../api";

interface BackupScheduleManagerProps {
  currentConfig: {
    frequency: string;
    interval_days?: number;
    interval_hours?: number;
    interval_minutes?: number;
    retention: number;
  } | null;
  onSaved: () => void;
}

export default function BackupScheduleManager({ currentConfig, onSaved }: BackupScheduleManagerProps) {
  const [schedule, setSchedule] = useState<{
    frequency: string;
    interval_days?: number;
    interval_hours?: number;
    interval_minutes?: number;
    retention: number;
  }>(
    currentConfig ?? {
      frequency: "none",
      retention: 5,
    }
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateBackupSchedule(schedule);
      setMessage("Schedulazione aggiornata!");
      setMessageType("success");
    } catch (error) {
      console.error("Errore nell'aggiornamento della schedulazione:", error);
      setMessage("Errore nell'aggiornamento.");
      setMessageType("error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setMessage("");
        setMessageType("");
        onSaved();
      }, 5000);
    }
  };

  const handleTriggerBackup = async () => {
    setLoading(true);
    try {
      await triggerScheduledBackup();
      setMessage("Backup eseguito manualmente!");
      setMessageType("success");
    } catch (error) {
      console.error("Errore nell'esecuzione manuale del backup:", error);
      setMessage("Errore nell'esecuzione manuale.");
      setMessageType("error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 5000);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Schedulazione Backup</h2>
      <div className="flex flex-col space-y-2">
        <label className="flex flex-col">
          Frequenza
          <select
            value={schedule.frequency}
            onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}
            className="border rounded p-1"
          >
            <option value="none">Disabilitato</option>
            <option value="hourly">Ogni ora</option>
            <option value="daily">Giornaliero</option>
            <option value="weekly">Settimanale</option>
          </select>
        </label>

        {schedule.frequency === "hourly" && (
          <label className="flex flex-col">
            Minuto
            <input
              type="number"
              value={schedule.interval_minutes ?? ""}
              onChange={(e) => setSchedule({ ...schedule, interval_minutes: Number(e.target.value) })}
              className="border rounded p-1"
              min={0}
              max={59}
            />
          </label>
        )}

        {schedule.frequency === "daily" && (
          <div className="flex flex-col sm:flex-row sm:space-x-2">
            <label className="flex flex-col">
              Ora
              <input
                type="number"
                value={schedule.interval_hours ?? ""}
                onChange={(e) => setSchedule({ ...schedule, interval_hours: Number(e.target.value) })}
                className="border rounded p-1"
                min={0}
                max={23}
              />
            </label>
            <label className="flex flex-col">
              Minuto
              <input
                type="number"
                value={schedule.interval_minutes ?? ""}
                onChange={(e) => setSchedule({ ...schedule, interval_minutes: Number(e.target.value) })}
                className="border rounded p-1"
                min={0}
                max={59}
              />
            </label>
          </div>
        )}

        {schedule.frequency === "weekly" && (
          <div className="flex flex-col sm:flex-row sm:space-x-2">
            <label className="flex flex-col">
              Giorno (0 = lunedì)
              <input
                type="number"
                value={schedule.interval_days ?? ""}
                onChange={(e) => setSchedule({ ...schedule, interval_days: Number(e.target.value) })}
                className="border rounded p-1"
                min={0}
                max={6}
              />
            </label>
            <label className="flex flex-col">
              Ora
              <input
                type="number"
                value={schedule.interval_hours ?? ""}
                onChange={(e) => setSchedule({ ...schedule, interval_hours: Number(e.target.value) })}
                className="border rounded p-1"
                min={0}
                max={23}
              />
            </label>
            <label className="flex flex-col">
              Minuto
              <input
                type="number"
                value={schedule.interval_minutes ?? ""}
                onChange={(e) => setSchedule({ ...schedule, interval_minutes: Number(e.target.value) })}
                className="border rounded p-1"
                min={0}
                max={59}
              />
            </label>
          </div>
        )}

        <label className="flex flex-col">
          Retention (numero massimo di backup da mantenere)
          <input
            type="number"
            value={schedule.retention}
            onChange={(e) => setSchedule({ ...schedule, retention: Number(e.target.value) })}
            className="border rounded p-1"
            min={1}
          />
        </label>

        <div className="flex flex-col sm:flex-row sm:space-x-2">
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Salva Configurazione
          </button>
          <button
            onClick={handleTriggerBackup}
            disabled={loading}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Esegui Backup Ora
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`fixed bottom-4 right-4 z-50 p-3 rounded shadow-lg text-white ${
            messageType === "success" ? "bg-green-500" : "bg-red-500"
          } transition-opacity duration-1000`}
        >
          {message}
        </div>
      )}
    </div>
  );
}