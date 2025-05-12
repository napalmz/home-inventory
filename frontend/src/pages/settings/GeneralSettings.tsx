import { useEffect, useState } from "react";
import { getAllSettings, setSetting, deleteSetting } from "../../api";

interface Setting {
  key: string;
  value: string;
  protected?: boolean;
}

export default function GeneralSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showProtected, setShowProtected] = useState(false);
  const [showEditable, setShowEditable] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getAllSettings();
        setSettings(data);
      } catch {
        setMessage("Errore durante il caricamento dei settings.");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleUpdate = async (key: string, value: string) => {
    try {
      await setSetting(key, value);
      setMessage(`Setting "${key}" aggiornato`);
    } catch {
      setMessage("Errore durante l'aggiornamento.");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  const handleDelete = async (key: string) => {
    try {
      const confirmed = window.confirm(`Sei sicuro di voler eliminare il setting "${key}"?`);
      if (!confirmed) return;
      await deleteSetting(key);
      setSettings(settings.filter((s) => s.key !== key));
      setMessage(`Setting "${key}" rimosso`);
    } catch {
      setMessage("Errore durante l'eliminazione.");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  const handleCreate = async () => {
    if (!newKey.trim()) return;
    const upperKey = newKey.toUpperCase();
    try {
      await setSetting(upperKey, newValue);
      setSettings([...settings, { key: upperKey, value: newValue }].sort((a, b) => a.key.localeCompare(b.key)));
      setMessage(`Setting "${upperKey}" creato`);
      setNewKey("");
      setNewValue("");
    } catch {
      setMessage("Errore durante la creazione.");
    }
    setTimeout(() => setMessage(""), 3000);
  };

  if (loading) return <div>Caricamento impostazioni...</div>;

  return (
    <div className="p-4 sm:px-6 space-y-4 overflow-x-auto">
      <h2 className="text-lg font-semibold">Impostazioni generali</h2>

      <button onClick={() => setShowProtected(!showProtected)} className="text-md font-semibold mt-4 flex items-center">
        {showProtected ? "▼" : "►"} Parametri protetti ({settings.filter((s) => s.protected).length})
      </button>
      {showProtected && (
        <div className="space-y-2">
          {settings
            .filter((s) => s.protected)
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((setting, idx) => (
              <div key={`protected-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-2 w-full">
                <span className="w-1/4">
                  {setting.key}
                  <span className="ml-1 text-xs text-gray-500">(protetto)</span>
                </span>
                <input
                  className="border rounded px-2 py-1 w-full sm:w-auto flex-grow"
                  value={setting.value}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setSettings((prev) =>
                      prev.map((s) => (s.key === setting.key ? { ...s, value: newVal } : s))
                    );
                  }}
                />
                <button onClick={() => handleUpdate(setting.key, setting.value)} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                  Salva
                </button>
                <button
                  disabled
                  className="bg-gray-300 text-black px-3 py-1 rounded hover:bg-gray-400"
                >
                  Elimina
                </button>
              </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowEditable(!showEditable)} className="text-md font-semibold mt-4 flex items-center">
        {showEditable ? "▼" : "►"} Parametri modificabili ({settings.filter((s) => !s.protected).length})
      </button>
      {showEditable && (
        <div className="space-y-2">
          {settings
            .filter((s) => !s.protected)
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((setting, idx) => (
              <div key={`editable-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-2 w-full">
                <span className="w-1/4">{setting.key}</span>
                <input
                  className="border rounded px-2 py-1 w-full sm:w-auto flex-grow"
                  value={setting.value}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setSettings((prev) =>
                      prev.map((s) => (s.key === setting.key ? { ...s, value: newVal } : s))
                    );
                  }}
                />
                <button onClick={() => handleUpdate(setting.key, setting.value)} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                  Salva
                </button>
                <button
                  onClick={() => handleDelete(setting.key)}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Elimina
                </button>
              </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t pt-4">
        <h3 className="text-md font-semibold">Aggiungi nuovo setting</h3>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 sm:space-x-2 mt-2 w-full">
          <input
            className="border rounded px-2 py-1 w-full sm:w-auto flex-grow"
            placeholder="Chiave"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
          />
          <input
            className="border rounded px-2 py-1 w-full sm:w-auto flex-grow"
            placeholder="Valore"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <button onClick={handleCreate} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
            Aggiungi
          </button>
        </div>
      </div>

      {message && (
        <div className="text-sm" style={{ color: message.includes("Errore") ? "red" : "green" }}>
          {message}
        </div>
      )}
    </div>
  );
}