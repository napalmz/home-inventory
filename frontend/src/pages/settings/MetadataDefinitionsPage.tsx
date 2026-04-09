import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createMetadataAssignment,
  createMetadataDefinition,
  deleteMetadataAssignment,
  deleteMetadataDefinition,
  getChecklists,
  getInventories,
  listAllMetadataDefinitions,
  updateMetadataDefinition,
} from "../../api";
import {
  InventoryContainerType,
  MetadataAssignmentCreate,
  MetadataDefinition,
  MetadataDefinitionScope,
  MetadataFieldType,
} from "../../types";

type ContainerOption = {
  id: number;
  name: string;
  kind: InventoryContainerType;
};

type DefinitionFormState = {
  key: string;
  label: string;
  description: string;
  fieldType: MetadataFieldType;
  listOptionsText: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
};

type AssignmentFormState = {
  scope: MetadataDefinitionScope;
  inventoryType: InventoryContainerType;
  inventoryId: number | "";
};

const initialDefinitionFormState: DefinitionFormState = {
  key: "",
  label: "",
  description: "",
  fieldType: "TEXT",
  listOptionsText: "",
  sortOrder: 0,
  isRequired: false,
  isActive: true,
};

const initialAssignmentFormState: AssignmentFormState = {
  scope: "GLOBAL",
  inventoryType: "INVENTORY",
  inventoryId: "",
};

function formatListOptionsText(options: MetadataDefinition["list_options"] | undefined): string {
  return (options ?? [])
    .map((option) => (option.label && option.label !== option.value ? `${option.value}|${option.label}` : option.value))
    .join("\n");
}

function parseListOptionsText(text: string): Array<{ value: string; label: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawValue, ...labelParts] = line.split("|");
      const value = rawValue.trim();
      const label = labelParts.join("|").trim() || value;
      return { value, label };
    });
}

export default function MetadataDefinitionsPage() {
  const [containers, setContainers] = useState<ContainerOption[]>([]);
  const [definitions, setDefinitions] = useState<MetadataDefinition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<number | null>(null);

  const [loadingContainers, setLoadingContainers] = useState(true);
  const [loadingDefinitions, setLoadingDefinitions] = useState(false);
  const [savingDefinition, setSavingDefinition] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const [definitionFormState, setDefinitionFormState] = useState<DefinitionFormState>(initialDefinitionFormState);
  const [assignmentFormState, setAssignmentFormState] = useState<AssignmentFormState>(initialAssignmentFormState);

  const selectedDefinition = useMemo(
    () => definitions.find((entry) => entry.id === selectedDefinitionId) ?? null,
    [definitions, selectedDefinitionId],
  );

  const filteredContainers = useMemo(() => {
    if (assignmentFormState.scope !== "INVENTORY") {
      return [];
    }
    return containers.filter((entry) => entry.kind === assignmentFormState.inventoryType);
  }, [assignmentFormState.inventoryType, assignmentFormState.scope, containers]);

  const showMessage = useCallback((text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
    window.setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, type === "success" ? 3500 : 6000);
  }, []);

  useEffect(() => {
    const loadContainers = async () => {
      setLoadingContainers(true);
      try {
        const [inventories, checklists] = await Promise.all([getInventories(), getChecklists()]);
        const nextContainers: ContainerOption[] = [
          ...inventories.map((entry) => ({
            id: entry.id,
            name: entry.name,
            kind: "INVENTORY" as const,
          })),
          ...checklists.map((entry) => ({
            id: entry.id,
            name: entry.name,
            kind: "CHECKLIST" as const,
          })),
        ].sort((left, right) => left.name.localeCompare(right.name));
        setContainers(nextContainers);
      } catch {
        showMessage("Errore durante il caricamento di inventari e liste.", "error");
      } finally {
        setLoadingContainers(false);
      }
    };

    void loadContainers();
  }, [showMessage]);

  useEffect(() => {
    if (assignmentFormState.scope !== "INVENTORY") {
      return;
    }
    const available = containers.filter((entry) => entry.kind === assignmentFormState.inventoryType);
    if (available.length === 0) {
      setAssignmentFormState((current) => ({ ...current, inventoryId: "" }));
      return;
    }
    if (!available.some((entry) => entry.id === assignmentFormState.inventoryId)) {
      setAssignmentFormState((current) => ({ ...current, inventoryId: available[0].id }));
    }
  }, [assignmentFormState.inventoryId, assignmentFormState.inventoryType, assignmentFormState.scope, containers]);

  const refreshDefinitions = useCallback(async () => {
    setLoadingDefinitions(true);
    try {
      const data = await listAllMetadataDefinitions(true);
      setDefinitions(data);

      setSelectedDefinitionId((current) => {
        if (current && data.some((entry) => entry.id === current)) {
          return current;
        }
        return data[0]?.id ?? null;
      });
    } catch {
      showMessage("Errore durante il caricamento delle definizioni metadato.", "error");
    } finally {
      setLoadingDefinitions(false);
    }
  }, [showMessage]);

  useEffect(() => {
    void refreshDefinitions();
  }, [refreshDefinitions]);

  function resetDefinitionForm() {
    setEditingId(null);
    setDefinitionFormState(initialDefinitionFormState);
  }

  function resetAssignmentForm() {
    setAssignmentFormState(initialAssignmentFormState);
  }

  function startEditDefinition(definition: MetadataDefinition) {
    setEditingId(definition.id);
    setDefinitionFormState({
      key: definition.key,
      label: definition.label,
      description: definition.description ?? "",
      fieldType: definition.field_type,
      listOptionsText: formatListOptionsText(definition.list_options),
      sortOrder: definition.sort_order,
      isRequired: definition.is_required,
      isActive: definition.is_active,
    });
  }

  async function handleSaveDefinition() {
    if (!definitionFormState.key.trim() || !definitionFormState.label.trim()) {
      showMessage("Chiave e label sono obbligatorie.", "error");
      return;
    }

    const listOptions = parseListOptionsText(definitionFormState.listOptionsText);
    if (definitionFormState.fieldType === "LIST" && listOptions.length === 0) {
      showMessage("Per il tipo LIST inserisci almeno un'opzione (una per riga).", "error");
      return;
    }

    setSavingDefinition(true);
    try {
      if (editingId) {
        await updateMetadataDefinition(editingId, {
          key: definitionFormState.key.trim(),
          label: definitionFormState.label.trim(),
          description: definitionFormState.description.trim() || null,
          list_options: definitionFormState.fieldType === "LIST" ? listOptions : [],
          sort_order: definitionFormState.sortOrder,
          is_required: definitionFormState.isRequired,
          is_active: definitionFormState.isActive,
        });
        showMessage("Definizione metadato aggiornata.", "success");
      } else {
        await createMetadataDefinition({
          key: definitionFormState.key.trim(),
          label: definitionFormState.label.trim(),
          description: definitionFormState.description.trim() || null,
          field_type: definitionFormState.fieldType,
          list_options: definitionFormState.fieldType === "LIST" ? listOptions : [],
          sort_order: definitionFormState.sortOrder,
          is_required: definitionFormState.isRequired,
          is_active: definitionFormState.isActive,
        });
        showMessage("Definizione metadato creata.", "success");
      }

      await refreshDefinitions();
      resetDefinitionForm();
    } catch {
      showMessage("Operazione non riuscita. Controlla i dati inseriti.", "error");
    } finally {
      setSavingDefinition(false);
    }
  }

  async function handleDeleteDefinition(definition: MetadataDefinition) {
    if (!window.confirm(`Eliminare il metadato "${definition.label}"?`)) {
      return;
    }

    try {
      await deleteMetadataDefinition(definition.id);
      showMessage("Definizione metadato eliminata.", "success");
      if (editingId === definition.id) {
        resetDefinitionForm();
      }
      await refreshDefinitions();
    } catch {
      showMessage("Errore durante l'eliminazione del metadato.", "error");
    }
  }

  async function handleCreateAssignment() {
    if (!selectedDefinition) {
      showMessage("Seleziona prima una definizione.", "error");
      return;
    }

    const payload: MetadataAssignmentCreate = {
      scope: assignmentFormState.scope,
    };

    if (assignmentFormState.scope === "INVENTORY_TYPE") {
      payload.inventory_type = assignmentFormState.inventoryType;
    }

    if (assignmentFormState.scope === "INVENTORY") {
      if (!assignmentFormState.inventoryId) {
        showMessage("Seleziona un contenitore.", "error");
        return;
      }
      payload.inventory_id = assignmentFormState.inventoryId;
    }

    setSavingAssignment(true);
    try {
      await createMetadataAssignment(selectedDefinition.id, payload);
      showMessage("Assegnazione creata.", "success");
      await refreshDefinitions();
      resetAssignmentForm();
    } catch {
      showMessage("Errore durante la creazione dell'assegnazione.", "error");
    } finally {
      setSavingAssignment(false);
    }
  }

  async function handleDeleteAssignment(assignmentId: number) {
    if (!window.confirm("Eliminare questa assegnazione?")) {
      return;
    }

    try {
      await deleteMetadataAssignment(assignmentId);
      showMessage("Assegnazione eliminata.", "success");
      await refreshDefinitions();
    } catch {
      showMessage("Errore durante l'eliminazione dell'assegnazione.", "error");
    }
  }

  function getAssignmentLabel(scope: MetadataDefinitionScope, inventoryType?: InventoryContainerType | null, inventoryId?: number | null) {
    if (scope === "GLOBAL") {
      return "Globale";
    }
    if (scope === "INVENTORY_TYPE") {
      return inventoryType === "CHECKLIST" ? "Tutte le checklist" : "Tutti gli inventari";
    }
    const match = containers.find((entry) => entry.id === inventoryId);
    if (match) {
      return `${match.name} [${match.kind === "INVENTORY" ? "Inventario" : "Checklist"}]`;
    }
    return `Contenitore #${inventoryId ?? "?"}`;
  }

  return (
    <div className="space-y-4 px-2 sm:px-4">
      <div>
        <h2 className="text-lg font-semibold">Definizioni metadati</h2>
        <p className="text-sm text-gray-500 dark:text-gray-300">
          Crea metadati agnostici e poi abilitali su globale, tipologia o contenitori specifici.
        </p>
      </div>

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 xl:overflow-auto">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-semibold">{editingId ? "Modifica definizione" : "Nuova definizione"}</h3>
            {editingId && (
              <button
                className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={resetDefinitionForm}
                type="button"
              >
                Annulla modifica
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Chiave</label>
              <input
                className="w-full rounded border px-3 py-2 dark:bg-gray-900"
                value={definitionFormState.key}
                onChange={(event) => setDefinitionFormState((current) => ({ ...current, key: event.target.value }))}
                placeholder="es. expiration_date"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Label</label>
              <input
                className="w-full rounded border px-3 py-2 dark:bg-gray-900"
                value={definitionFormState.label}
                onChange={(event) => setDefinitionFormState((current) => ({ ...current, label: event.target.value }))}
                placeholder="es. Data scadenza"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Descrizione</label>
              <textarea
                className="min-h-24 w-full rounded border px-3 py-2 dark:bg-gray-900"
                value={definitionFormState.description}
                onChange={(event) => setDefinitionFormState((current) => ({ ...current, description: event.target.value }))}
                placeholder="Descrizione opzionale del metadato"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Tipo</label>
                <select
                  className="w-full rounded border px-3 py-2 dark:bg-gray-900"
                  disabled={Boolean(editingId)}
                  value={definitionFormState.fieldType}
                  onChange={(event) => setDefinitionFormState((current) => ({
                    ...current,
                    fieldType: event.target.value as MetadataFieldType,
                  }))}
                >
                  <option value="TEXT">TEXT</option>
                  <option value="NUMBER">NUMBER</option>
                  <option value="BOOLEAN">BOOLEAN</option>
                  <option value="DATE">DATE</option>
                  <option value="LIST">LIST</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Ordine</label>
                <input
                  className="w-full rounded border px-3 py-2 dark:bg-gray-900"
                  min={0}
                  type="number"
                  value={definitionFormState.sortOrder}
                  onChange={(event) => setDefinitionFormState((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))}
                />
              </div>
            </div>

            {definitionFormState.fieldType === "LIST" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Opzioni lista</label>
                <textarea
                  className="min-h-28 w-full rounded border px-3 py-2 dark:bg-gray-900"
                  value={definitionFormState.listOptionsText}
                  onChange={(event) => setDefinitionFormState((current) => ({ ...current, listOptionsText: event.target.value }))}
                  placeholder={"Una per riga.\nEsempio semplice: Nuovo\nEsempio con valore stabile: used|Usato"}
                />
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                  Ogni riga crea una voce del dropdown. Se usi <code>valore|Etichetta</code>, nel DB viene salvato il valore a sinistra.
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                checked={definitionFormState.isRequired}
                onChange={(event) => setDefinitionFormState((current) => ({ ...current, isRequired: event.target.checked }))}
                type="checkbox"
              />
              Obbligatorio
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                checked={definitionFormState.isActive}
                onChange={(event) => setDefinitionFormState((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
              Attivo
            </label>

            <button
              className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={savingDefinition}
              onClick={() => void handleSaveDefinition()}
              type="button"
            >
              {savingDefinition ? "Salvataggio..." : editingId ? "Aggiorna definizione" : "Crea definizione"}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Definizioni esistenti</h3>
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  Seleziona una definizione per gestire le sue assegnazioni.
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700">
                {definitions.length} record
              </span>
            </div>

            {loadingDefinitions ? (
              <div>Caricamento definizioni...</div>
            ) : definitions.length === 0 ? (
              <div className="rounded border border-dashed p-6 text-sm text-gray-500 dark:text-gray-300">
                Nessuna definizione presente.
              </div>
            ) : (
              <div className="space-y-2">
                {definitions.map((definition) => (
                  <div
                    key={definition.id}
                    className={`rounded border p-3 ${
                      selectedDefinitionId === definition.id
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{definition.key}</div>
                        <div className="font-medium">{definition.label}</div>
                        {definition.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">{definition.description}</div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                          {definition.field_type} · {definition.is_active ? "Attivo" : "Inattivo"} · {definition.is_required ? "Obbligatorio" : "Opzionale"}
                        </div>
                        <div className="text-xs mt-1">
                          <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-700">Assegnazioni: {definition.assignments.length}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:ml-2 w-full sm:w-auto">
                        <button
                          className="rounded bg-slate-600 px-3 py-1 text-sm text-white hover:bg-slate-700 flex-1 sm:flex-none"
                          onClick={() => setSelectedDefinitionId(definition.id)}
                          type="button"
                        >
                          Seleziona
                        </button>
                        <button
                          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 flex-1 sm:flex-none"
                          onClick={() => startEditDefinition(definition)}
                          type="button"
                        >
                          Modifica
                        </button>
                        <button
                          className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 flex-1 sm:flex-none"
                          onClick={() => void handleDeleteDefinition(definition)}
                          type="button"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Assegnazioni</h3>
              <span className="text-sm text-gray-500 dark:text-gray-300">
                {selectedDefinition ? selectedDefinition.label : "Nessuna definizione selezionata"}
              </span>
            </div>

            {!selectedDefinition ? (
              <div className="rounded border border-dashed p-4 text-sm text-gray-500 dark:text-gray-300">
                Seleziona una definizione dalla tabella per configurare le assegnazioni.
              </div>
            ) : (
              <>
                <div className="mb-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Scope</label>
                    <select
                      className="w-full rounded border px-3 py-2 dark:bg-gray-900"
                      value={assignmentFormState.scope}
                      onChange={(event) => {
                        const nextScope = event.target.value as MetadataDefinitionScope;
                        setAssignmentFormState((current) => ({
                          ...current,
                          scope: nextScope,
                          inventoryId: nextScope === "INVENTORY" ? current.inventoryId : "",
                        }));
                      }}
                    >
                      <option value="GLOBAL">Globale</option>
                      <option value="INVENTORY_TYPE">Per tipologia</option>
                      <option value="INVENTORY">Per contenitore</option>
                    </select>
                  </div>

                  {(assignmentFormState.scope === "INVENTORY_TYPE" || assignmentFormState.scope === "INVENTORY") && (
                    <div>
                      <label className="mb-1 block text-sm font-medium">Tipologia</label>
                      <select
                        className="w-full rounded border px-3 py-2 dark:bg-gray-900"
                        value={assignmentFormState.inventoryType}
                        onChange={(event) => {
                          const nextType = event.target.value as InventoryContainerType;
                          setAssignmentFormState((current) => ({
                            ...current,
                            inventoryType: nextType,
                          }));
                        }}
                      >
                        <option value="INVENTORY">Inventari</option>
                        <option value="CHECKLIST">Checklist</option>
                      </select>
                    </div>
                  )}

                  {assignmentFormState.scope === "INVENTORY" && (
                    <div className="sm:col-span-2 lg:col-span-2">
                      <label className="mb-1 block text-sm font-medium">Contenitore</label>
                      <select
                        className="w-full rounded border px-3 py-2 dark:bg-gray-900"
                        disabled={loadingContainers || filteredContainers.length === 0}
                        value={assignmentFormState.inventoryId}
                        onChange={(event) => setAssignmentFormState((current) => ({
                          ...current,
                          inventoryId: Number(event.target.value),
                        }))}
                      >
                        {filteredContainers.length === 0 && <option value="">Nessun contenitore disponibile</option>}
                        {filteredContainers.map((entry) => (
                          <option key={`${entry.kind}-${entry.id}`} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <button
                  className="mb-4 rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  disabled={savingAssignment}
                  onClick={() => void handleCreateAssignment()}
                  type="button"
                >
                  {savingAssignment ? "Salvataggio..." : "Aggiungi assegnazione"}
                </button>

                {selectedDefinition.assignments.length === 0 ? (
                  <div className="rounded border border-dashed p-4 text-sm text-gray-500 dark:text-gray-300">
                    Nessuna assegnazione presente per questa definizione.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDefinition.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <div>
                          <div className="font-medium">{getAssignmentLabel(assignment.scope, assignment.inventory_type, assignment.inventory_id)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-300">Scope: {assignment.scope}</div>
                        </div>
                        <button
                          className="w-full sm:w-auto rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 text-sm"
                          onClick={() => void handleDeleteAssignment(assignment.id)}
                          type="button"
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {message && (
        <div
          className={`fixed right-4 top-4 z-50 rounded px-4 py-3 text-white shadow-lg ${
            messageType === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
