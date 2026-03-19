import { useState, useEffect, useContext, useMemo, ReactNode, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { ItemVersion, InventoryVersion } from '../types';
import {
  getItemHistory,
  rollbackItem,
  getInventoryHistory,
  rollbackInventory,
  getChecklistHistory,
  rollbackChecklist,
  deleteItemHistoryVersion,
  deleteItemHistoryVersions,
  deleteInventoryHistoryVersion,
  deleteInventoryHistoryVersions,
  deleteChecklistHistoryVersion,
  deleteChecklistHistoryVersions,
} from '../api';
import { AuthContext } from '../auth-context-instance';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRollback?: () => void;
  entityType: 'item' | 'inventory' | 'checklist';
  itemContainerType?: 'INVENTORY' | 'CHECKLIST';
  entityId: number;
  entityName: string;
}

export function HistoryModal({
  isOpen,
  onClose,
  onRollback,
  entityType,
  itemContainerType,
  entityId,
  entityName,
}: HistoryModalProps) {
  const authContext = useContext(AuthContext);
  const isAdmin = authContext?.user?.role?.name === 'admin';
  const canRollback = authContext?.user?.role?.name !== 'viewer';
  const [versions, setVersions] = useState<(ItemVersion | InventoryVersion)[]>([]);
    const displayedVersions = useMemo(
      () => [...versions].sort((a, b) => b.version_num - a.version_num),
      [versions]
    );

    const latestVersionNum = useMemo(
      () => (versions.length > 0 ? Math.max(...versions.map((v) => v.version_num)) : null),
      [versions]
    );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionNums, setSelectedVersionNums] = useState<number[]>([]);

  const fieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      name: 'Nome',
      description: 'Descrizione',
      quantity: 'Quantita',
      inventory_id: 'Inventario',
      owner_id: 'Proprietario',
      type: 'Tipo',
    };
    return labels[field] || field;
  };

  const formatValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 'vuoto';
    if (typeof value === 'boolean') return value ? 'si' : 'no';
    return String(value);
  };

  const formatChecklistState = (value: unknown) => {
    const numeric = Number(value);
    return !Number.isNaN(numeric) && numeric > 0;
  };

  const renderChecklistStatus = (value: unknown) => (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-400 bg-gray-100 text-gray-700 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-200"
      style={{
        fontSize: "16px",
        lineHeight: "1",
        fontWeight: "600",
      }}
      aria-hidden="true"
      title={formatChecklistState(value) ? 'check' : 'uncheck'}
    >
      {formatChecklistState(value) ? '✓' : ''}
    </span>
  );

  const describeVersion = (version: ItemVersion | InventoryVersion): { label: string; content: ReactNode }[] => {
    if (version.operation === 'CREATE') {
      return [{ label: 'Azione', content: 'Record creato' }];
    }
    if (version.operation === 'DELETE') {
      return [{ label: 'Azione', content: 'Record eliminato' }];
    }

    if (!version.diff) {
      return [{ label: 'Modifiche', content: 'Nessuna modifica dettagliata disponibile' }];
    }

    try {
      const parsed = JSON.parse(version.diff) as Record<string, { from: unknown; to: unknown }>;
      const entries = Object.entries(parsed);
      if (entries.length === 0) {
        return [{ label: 'Modifiche', content: 'Nessuna modifica rilevata' }];
      }

      const isChecklistQuantity =
        version.operation === 'UPDATE' &&
        entityType === 'item' &&
        itemContainerType === 'CHECKLIST';

      return entries.map(([field, values]) => ({
        label: field === 'quantity' && isChecklistQuantity ? 'Status' : fieldLabel(field),
        content:
          field === 'quantity' && isChecklistQuantity
            ? (
              <>
                {renderChecklistStatus(values?.from)}
                <span>{' -> '}</span>
                {renderChecklistStatus(values?.to)}
              </>
            )
            : `${formatValue(values?.from)} -> ${formatValue(values?.to)}`,
      }));
    } catch {
      return [{ label: 'Modifiche', content: 'Formato modifiche non leggibile' }];
    }
  };

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (entityType === 'item') {
        data = await getItemHistory(entityId);
      } else if (entityType === 'inventory') {
        data = await getInventoryHistory(entityId);
      } else {
        data = await getChecklistHistory(entityId);
      }
      setVersions(data);
      setSelectedVersionNums([]);
    } catch (err) {
      setError('Errore nel caricamento della cronologia');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    if (!isOpen) return;
    fetchHistory();
  }, [isOpen, fetchHistory]);

  const handleRollback = async (versionNum: number) => {
    if (!window.confirm(`Vuoi ripristinare la versione ${versionNum}?`)) return;
    
    try {
      if (entityType === 'item') {
        await rollbackItem(entityId, versionNum);
      } else if (entityType === 'inventory') {
        await rollbackInventory(entityId, versionNum);
      } else {
        await rollbackChecklist(entityId, versionNum);
      }
      
      if (onRollback) onRollback();
      onClose();
    } catch (err) {
      setError('Errore nel ripristino della versione');
      console.error(err);
    }
  };

  const toggleVersionSelection = (versionNum: number) => {
    setSelectedVersionNums((prev) =>
      prev.includes(versionNum)
        ? prev.filter((v) => v !== versionNum)
        : [...prev, versionNum]
    );
  };

  const handleDeleteSingle = async (versionNum: number) => {
    if (!window.confirm(`Vuoi eliminare la versione v${versionNum}?`)) return;
    try {
      if (entityType === 'item') {
        await deleteItemHistoryVersion(entityId, versionNum);
      } else if (entityType === 'inventory') {
        await deleteInventoryHistoryVersion(entityId, versionNum);
      } else {
        await deleteChecklistHistoryVersion(entityId, versionNum);
      }
      await fetchHistory();
      if (onRollback) onRollback();
    } catch (err) {
      setError('Errore durante la cancellazione della versione');
      console.error(err);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedVersionNums.length === 0) return;
    if (!window.confirm(`Vuoi eliminare ${selectedVersionNums.length} versioni selezionate?`)) return;

    try {
      if (entityType === 'item') {
        await deleteItemHistoryVersions(entityId, selectedVersionNums);
      } else if (entityType === 'inventory') {
        await deleteInventoryHistoryVersions(entityId, selectedVersionNums);
      } else {
        await deleteChecklistHistoryVersions(entityId, selectedVersionNums);
      }
      await fetchHistory();
      if (onRollback) onRollback();
    } catch (err) {
      setError('Errore durante la cancellazione massiva');
      console.error(err);
    }
  };

  const operationBadge = (op: string) => {
    const colors: { [key: string]: string } = {
      'CREATE': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'UPDATE': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'DELETE': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[op] || '';
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
          <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <Dialog.Title className="text-xl font-bold dark:text-white">
              Cronologia: {entityName}
            </Dialog.Title>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading && <div className="text-center text-gray-500">Caricamento...</div>}
            {error && <div className="text-center text-red-500 mb-4">{error}</div>}

            {!loading && versions.length > 0 && (
              <div className="space-y-3">
                {isAdmin && (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedVersionNums(displayedVersions.map((v) => v.version_num))}
                      className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Seleziona tutte
                    </button>
                    <button
                      onClick={() => setSelectedVersionNums([])}
                      className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Deseleziona
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={selectedVersionNums.length === 0}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Elimina selezionate ({selectedVersionNums.length})
                    </button>
                  </div>
                )}

                {displayedVersions.map((version) => (
                  <div
                    key={version.version_num}
                    className="border rounded-lg p-4 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {isAdmin && (
                            <input
                              type="checkbox"
                              checked={selectedVersionNums.includes(version.version_num)}
                              onChange={() => toggleVersionSelection(version.version_num)}
                              className="w-4 h-4"
                              title={`Seleziona versione v${version.version_num}`}
                            />
                          )}
                          <span className={`px-2 py-1 rounded text-sm font-semibold ${operationBadge(version.operation)}`}>
                            {version.operation}
                          </span>
                          <span className="text-sm font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                            v{version.version_num}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <p>
                            da <strong>{version.changed_by_username || 'Sconosciuto'}</strong> il{' '}
                            <time>{new Date(version.changed_at).toLocaleString()}</time>
                          </p>
                        </div>

                        <div className="text-xs bg-gray-50 dark:bg-gray-700/40 rounded p-3 space-y-1">
                          {describeVersion(version).map((entry, entryIdx) => (
                            <p key={entryIdx} className="text-gray-700 dark:text-gray-200">
                              <span className="font-semibold">{entry.label}:</span> {entry.content}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canRollback && version.operation !== 'DELETE' && version.version_num !== latestVersionNum && (
                          <button
                            onClick={() => handleRollback(version.version_num)}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 whitespace-nowrap"
                          >
                            Ripristina
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSingle(version.version_num)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 whitespace-nowrap"
                          >
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && versions.length === 0 && (
              <div className="text-center text-gray-500">Nessuna cronologia disponibile</div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-black dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-600"
            >
              Chiudi
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
