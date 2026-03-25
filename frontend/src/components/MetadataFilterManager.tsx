import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';

import {
  createFilterTemplate,
  deleteFilterTemplate,
  filterItemsByBooleanMetadata,
  filterItemsByDateMetadata,
  filterItemsByNumericMetadata,
  getFilterTemplate,
  getFilterTemplates,
} from '../api';
import {
  BooleanMetadataFilterCriterion,
  DateMetadataFilterCriterion,
  FilterTemplate,
  FilterTemplateListItem,
  MetadataDefinition,
  MetadataFilterOperator,
  NumericMetadataFilterCriterion,
} from '../types';

type FilterMode = 'numeric' | 'date' | 'boolean';
type MatchMode = 'all' | 'any';

type NumericCriterionForm = {
  id: string;
  definitionId: number | null;
  operator: MetadataFilterOperator;
  value: string;
  rangeFrom: string;
  rangeTo: string;
};

type DateCriterionForm = {
  id: string;
  definitionId: number | null;
  operator: MetadataFilterOperator;
  value: string;
  rangeFrom: string;
  rangeTo: string;
};

type BooleanCriterionForm = {
  id: string;
  definitionId: number | null;
  operator: MetadataFilterOperator;
  value: boolean | '';
};

function makeCriterionId() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyNumericCriterion(): NumericCriterionForm {
  return {
    id: makeCriterionId(),
    definitionId: null,
    operator: 'equals',
    value: '',
    rangeFrom: '',
    rangeTo: '',
  };
}

function createEmptyDateCriterion(): DateCriterionForm {
  return {
    id: makeCriterionId(),
    definitionId: null,
    operator: 'equals',
    value: '',
    rangeFrom: '',
    rangeTo: '',
  };
}

function createEmptyBooleanCriterion(): BooleanCriterionForm {
  return {
    id: makeCriterionId(),
    definitionId: null,
    operator: 'equals',
    value: '',
  };
}

function isBetweenOperator(operator: MetadataFilterOperator) {
  return operator === 'between';
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function toNumericCriterionPayload(criteria: NumericCriterionForm[]): NumericMetadataFilterCriterion[] {
  return criteria
    .filter((criterion) => criterion.definitionId !== null)
    .filter((criterion) => {
      if (criterion.operator === 'is_null' || criterion.operator === 'is_not_null') {
        return true;
      }
      return isBetweenOperator(criterion.operator)
        ? criterion.rangeFrom !== '' && criterion.rangeTo !== ''
        : criterion.value !== '';
    })
    .map((criterion) => {
      if (criterion.operator === 'is_null' || criterion.operator === 'is_not_null') {
        return {
          definition_id: criterion.definitionId as number,
          operator: criterion.operator,
        };
      }
      if (isBetweenOperator(criterion.operator)) {
        return {
          definition_id: criterion.definitionId as number,
          operator: criterion.operator,
          range_from: criterion.rangeFrom,
          range_to: criterion.rangeTo,
        };
      }

      return {
        definition_id: criterion.definitionId as number,
        operator: criterion.operator,
        value_number: criterion.value,
      };
    });
}

function toDateCriterionPayload(criteria: DateCriterionForm[]): DateMetadataFilterCriterion[] {
  return criteria
    .filter((criterion) => criterion.definitionId !== null)
    .filter((criterion) => {
      if (criterion.operator === 'is_null' || criterion.operator === 'is_not_null') {
        return true;
      }
      return isBetweenOperator(criterion.operator)
        ? criterion.rangeFrom !== '' && criterion.rangeTo !== ''
        : criterion.value !== '';
    })
    .map((criterion) => {
      if (criterion.operator === 'is_null' || criterion.operator === 'is_not_null') {
        return {
          definition_id: criterion.definitionId as number,
          operator: criterion.operator,
        };
      }
      if (isBetweenOperator(criterion.operator)) {
        return {
          definition_id: criterion.definitionId as number,
          operator: criterion.operator,
          range_from: criterion.rangeFrom === 'today' ? todayISO() : criterion.rangeFrom,
          range_to: criterion.rangeTo === 'today' ? todayISO() : criterion.rangeTo,
        };
      }

      return {
        definition_id: criterion.definitionId as number,
        operator: criterion.operator,
        value_date: criterion.value === 'today' ? todayISO() : criterion.value,
      };
    });
}

function parseNumericCriteria(rawCriteria: unknown[]): NumericCriterionForm[] {
  return rawCriteria.map((entry) => {
    const criterion = (entry ?? {}) as Record<string, unknown>;
    const rawDefinitionId = criterion.definition_id;
    return {
      id: makeCriterionId(),
      definitionId:
        typeof rawDefinitionId === 'number'
          ? rawDefinitionId
          : typeof rawDefinitionId === 'string' && rawDefinitionId.trim() !== ''
            ? Number(rawDefinitionId)
            : null,
      operator: (criterion.operator as MetadataFilterOperator) ?? 'equals',
      value: criterion.value_number != null ? String(criterion.value_number) : '',
      rangeFrom: criterion.range_from != null ? String(criterion.range_from) : '',
      rangeTo: criterion.range_to != null ? String(criterion.range_to) : '',
    };
  });
}

function parseDateCriteria(rawCriteria: unknown[]): DateCriterionForm[] {
  return rawCriteria.map((entry) => {
    const criterion = (entry ?? {}) as Record<string, unknown>;
    const rawDefinitionId = criterion.definition_id;
    return {
      id: makeCriterionId(),
      definitionId:
        typeof rawDefinitionId === 'number'
          ? rawDefinitionId
          : typeof rawDefinitionId === 'string' && rawDefinitionId.trim() !== ''
            ? Number(rawDefinitionId)
            : null,
      operator: (criterion.operator as MetadataFilterOperator) ?? 'equals',
      value: typeof criterion.value_date === 'string' ? criterion.value_date : '',
      rangeFrom: typeof criterion.range_from === 'string' ? criterion.range_from : '',
      rangeTo: typeof criterion.range_to === 'string' ? criterion.range_to : '',
    };
  });
}

function toBooleanCriterionPayload(criteria: BooleanCriterionForm[]): BooleanMetadataFilterCriterion[] {
  return criteria
    .filter((criterion) => criterion.definitionId !== null && (criterion.value !== '' || criterion.operator === 'is_null'))
    .map((criterion) => ({
      definition_id: criterion.definitionId as number,
      operator: criterion.operator,
      ...(criterion.operator !== 'is_null' && { value_boolean: criterion.value === true }),
    }));
}

function parseBooleanCriteria(rawCriteria: unknown[]): BooleanCriterionForm[] {
  return rawCriteria.map((entry) => {
    const criterion = (entry ?? {}) as Record<string, unknown>;
    const rawDefinitionId = criterion.definition_id;
    return {
      id: makeCriterionId(),
      definitionId:
        typeof rawDefinitionId === 'number'
          ? rawDefinitionId
          : typeof rawDefinitionId === 'string' && rawDefinitionId.trim() !== ''
            ? Number(rawDefinitionId)
            : null,
      operator: (criterion.operator as MetadataFilterOperator) ?? 'equals',
      value: typeof criterion.value_boolean === 'boolean' ? criterion.value_boolean : '',
    };
  });
}

function extractTemplatePayload(template: FilterTemplate): {
  filterType: FilterMode | null;
  matchMode: MatchMode;
  criteria: unknown[];
} {
  const rawRoot = template.criteria;
  if (Array.isArray(rawRoot)) {
    return {
      filterType: template.filter_type === 'numeric' || template.filter_type === 'date' ? template.filter_type : null,
      matchMode: 'all',
      criteria: rawRoot,
    };
  }

  const raw = (rawRoot ?? {}) as Record<string, unknown>;
  const criteria = Array.isArray(raw.criteria)
    ? raw.criteria
    : Array.isArray(raw.items)
      ? raw.items
      : [];
  const rawType = raw.filter_type;
  const filterType =
    rawType === 'numeric' || rawType === 'date'
      ? rawType
      : template.filter_type === 'numeric' || template.filter_type === 'date'
        ? template.filter_type
        : null;

  return {
    filterType,
    matchMode: raw.match_mode === 'any' ? 'any' : 'all',
    criteria,
  };
}

const numericOperators: Array<{ value: MetadataFilterOperator; label: string }> = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'between', label: 'between' },
  { value: 'is_null', label: 'Non impostato' },
  { value: 'is_not_null', label: 'Impostato' },
];

const dateOperators: Array<{ value: MetadataFilterOperator; label: string }> = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'between', label: 'between' },
  { value: 'is_null', label: 'Non impostato' },
  { value: 'is_not_null', label: 'Impostato' },
];

export default function MetadataFilterManager({
  inventoryId,
  definitions,
  onApply,
  onClear,
}: {
  inventoryId: number;
  definitions: MetadataDefinition[];
  onApply: (itemIds: number[], summary: string) => void;
  onClear: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<FilterMode>('numeric');
  const [matchMode, setMatchMode] = useState<MatchMode>('all');
  const [numericCriteria, setNumericCriteria] = useState<NumericCriterionForm[]>([createEmptyNumericCriterion()]);
  const [dateCriteria, setDateCriteria] = useState<DateCriterionForm[]>([createEmptyDateCriterion()]);
  const [booleanCriteria, setBooleanCriteria] = useState<BooleanCriterionForm[]>([createEmptyBooleanCriterion()]);
  const [templates, setTemplates] = useState<FilterTemplateListItem[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const numericDefinitions = useMemo(
    () => definitions.filter((definition) => definition.is_active && definition.field_type === 'NUMBER'),
    [definitions],
  );
  const dateDefinitions = useMemo(
    () => definitions.filter((definition) => definition.is_active && definition.field_type === 'DATE'),
    [definitions],
  );
  const booleanDefinitions = useMemo(
    () => definitions.filter((definition) => definition.is_active && definition.field_type === 'BOOLEAN'),
    [definitions],
  );

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await getFilterTemplates(inventoryId, true);
        setTemplates(data);
      } catch {
        setTemplates([]);
      }
    };

    void loadTemplates();
  }, [inventoryId]);

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage(text);
    setMessageType(type);
    window.setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, type === 'success' ? 3000 : 5000);
  }

  async function applyCurrentFilter() {
    setBusy(true);
    try {
      if (mode === 'numeric') {
        const criteria = toNumericCriterionPayload(numericCriteria);
        if (criteria.length === 0) {
          showMessage('Configura almeno un criterio numerico.', 'error');
          return;
        }

        const response = await filterItemsByNumericMetadata({
          inventory_id: inventoryId,
          match_mode: matchMode,
          criteria,
        });
        onApply(response.item_ids, `Filtro numerico attivo (${response.count} risultati)`);
      } else if (mode === 'date') {
        const criteria = toDateCriterionPayload(dateCriteria);
        if (criteria.length === 0) {
          showMessage('Configura almeno un criterio data.', 'error');
          return;
        }

        const response = await filterItemsByDateMetadata({
          inventory_id: inventoryId,
          match_mode: matchMode,
          criteria,
        });
        onApply(response.item_ids, `Filtro data attivo (${response.count} risultati)`);
      } else {
        const criteria = toBooleanCriterionPayload(booleanCriteria);
        if (criteria.length === 0) {
          showMessage('Configura almeno un criterio booleano.', 'error');
          return;
        }

        const response = await filterItemsByBooleanMetadata({
          inventory_id: inventoryId,
          match_mode: matchMode,
          criteria,
        });
        onApply(response.item_ids, `Filtro booleano attivo (${response.count} risultati)`);
      }

      setIsOpen(false);
    } catch {
      showMessage('Impossibile applicare il filtro metadata.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrentTemplate() {
    if (!templateName.trim()) {
      showMessage('Inserisci un nome template.', 'error');
      return;
    }

    const criteria = mode === 'numeric'
      ? toNumericCriterionPayload(numericCriteria)
      : mode === 'date'
        ? toDateCriterionPayload(dateCriteria)
        : toBooleanCriterionPayload(booleanCriteria);

    if (criteria.length === 0) {
      showMessage('Non puoi salvare un template senza criteri.', 'error');
      return;
    }

    setBusy(true);
    try {
      await createFilterTemplate(inventoryId, {
        name: templateName.trim(),
        description: '',
        filter_type: mode,
        criteria: {
          filter_type: mode,
          match_mode: matchMode,
          criteria,
        },
        is_shared: false,
      });

      const data = await getFilterTemplates(inventoryId, true);
      setTemplates(data);
      setTemplateName('');
      showMessage('Template salvato.', 'success');
    } catch {
      showMessage('Salvataggio template non riuscito.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function applyTemplate(templateId: number) {
    setBusy(true);
    try {
      const template: FilterTemplate = await getFilterTemplate(templateId);
      const payload = extractTemplatePayload(template);

      if (payload.filterType === 'numeric') {
        setMode('numeric');
        setMatchMode(payload.matchMode);
        const parsed = parseNumericCriteria(payload.criteria).filter((criterion) => criterion.definitionId !== null);
        setNumericCriteria(parsed.length > 0 ? parsed : [createEmptyNumericCriterion()]);

        if (parsed.length === 0) {
          showMessage('Il template non contiene criteri numerici validi.', 'error');
          return;
        }

        const response = await filterItemsByNumericMetadata({
          inventory_id: inventoryId,
          match_mode: payload.matchMode,
          criteria: toNumericCriterionPayload(parsed),
        });
        onApply(response.item_ids, `Template "${template.name}" applicato (${response.count} risultati)`);
      } else if (payload.filterType === 'date') {
        setMode('date');
        setMatchMode(payload.matchMode);
        const parsed = parseDateCriteria(payload.criteria).filter((criterion) => criterion.definitionId !== null);
        setDateCriteria(parsed.length > 0 ? parsed : [createEmptyDateCriterion()]);

        if (parsed.length === 0) {
          showMessage('Il template non contiene criteri data validi.', 'error');
          return;
        }

        const response = await filterItemsByDateMetadata({
          inventory_id: inventoryId,
          match_mode: payload.matchMode,
          criteria: toDateCriterionPayload(parsed),
        });
        onApply(response.item_ids, `Template "${template.name}" applicato (${response.count} risultati)`);
      } else if (payload.filterType === 'boolean') {
        setMode('boolean');
        setMatchMode(payload.matchMode);
        const parsed = parseBooleanCriteria(payload.criteria).filter((criterion) => criterion.definitionId !== null);
        setBooleanCriteria(parsed.length > 0 ? parsed : [createEmptyBooleanCriterion()]);

        if (parsed.length === 0) {
          showMessage('Il template non contiene criteri booleani validi.', 'error');
          return;
        }

        const response = await filterItemsByBooleanMetadata({
          inventory_id: inventoryId,
          match_mode: payload.matchMode,
          criteria: toBooleanCriterionPayload(parsed),
        });
        onApply(response.item_ids, `Template "${template.name}" applicato (${response.count} risultati)`);
      } else {
        showMessage('Questo template non è compatibile con il builder attuale.', 'error');
        return;
      }

      setIsOpen(false);
    } catch {
      showMessage('Impossibile applicare il template selezionato.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate(templateId: number) {
    if (!window.confirm('Eliminare il template selezionato?')) {
      return;
    }

    setBusy(true);
    try {
      await deleteFilterTemplate(templateId);
      setTemplates((current) => current.filter((template) => template.id !== templateId));
      showMessage('Template eliminato.', 'success');
    } catch {
      showMessage('Errore durante l\'eliminazione del template.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const activeDefinitions = mode === 'numeric' ? numericDefinitions : dateDefinitions;
  const activeCriteria = mode === 'numeric' ? numericCriteria : dateCriteria;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="py-2 px-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700"
      >
        <span className="inline md:hidden">🧩</span>
        <span className="hidden md:inline">Filtri metadata</span>
      </button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-900 dark:text-white p-6 rounded w-full max-w-5xl space-y-4">
            <Dialog.Title className="text-lg font-semibold">Builder filtri metadati</Dialog.Title>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Tipo filtro</label>
                    <select
                      value={mode}
                      onChange={(event) => setMode(event.target.value as FilterMode)}
                      className="w-full rounded border px-3 py-2 dark:bg-gray-800"
                    >
                      <option value="numeric">Numerico</option>
                      <option value="date">Data</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Match mode</label>
                    <select
                      value={matchMode}
                      onChange={(event) => setMatchMode(event.target.value as MatchMode)}
                      className="w-full rounded border px-3 py-2 dark:bg-gray-800"
                    >
                      <option value="all">Tutti i criteri</option>
                      <option value="any">Almeno un criterio</option>
                    </select>
                  </div>
                </div>

                {activeDefinitions.length === 0 ? (
                  <div className="rounded border border-dashed p-4 text-sm text-gray-500 dark:text-gray-300">
                    Nessuna definizione {mode === 'numeric' ? 'NUMBER' : 'DATE'} disponibile per questo contenitore.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mode === 'numeric' && numericCriteria.map((criterion, index) => (
                      <div key={criterion.id} className="rounded border p-3 dark:border-gray-700">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">Criterio {index + 1}</span>
                          {numericCriteria.length > 1 && (
                            <button
                              className="text-sm text-red-600 hover:underline"
                              onClick={() => setNumericCriteria((current) => current.filter((entry) => entry.id !== criterion.id))}
                              type="button"
                            >
                              Rimuovi
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
                          <select
                            value={criterion.definitionId ?? ''}
                            onChange={(event) => setNumericCriteria((current) => current.map((entry) =>
                              entry.id === criterion.id
                                ? { ...entry, definitionId: event.target.value ? Number(event.target.value) : null }
                                : entry,
                            ))}
                            className="rounded border px-3 py-2 dark:bg-gray-800"
                          >
                            <option value="">Seleziona metadato</option>
                            {numericDefinitions.map((definition) => (
                              <option key={definition.id} value={definition.id}>{definition.label}</option>
                            ))}
                          </select>
                          <select
                            value={criterion.operator}
                            onChange={(event) => setNumericCriteria((current) => current.map((entry) =>
                              entry.id === criterion.id
                                ? { ...entry, operator: event.target.value as MetadataFilterOperator }
                                : entry,
                            ))}
                            className="rounded border px-3 py-2 dark:bg-gray-800"
                          >
                            {numericOperators.map((operator) => (
                              <option key={operator.value} value={operator.value}>{operator.label}</option>
                            ))}
                          </select>
                          {isBetweenOperator(criterion.operator) ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                type="number"
                                step="0.0001"
                                value={criterion.rangeFrom}
                                onChange={(event) => setNumericCriteria((current) => current.map((entry) =>
                                  entry.id === criterion.id ? { ...entry, rangeFrom: event.target.value } : entry,
                                ))}
                                className="rounded border px-3 py-2 dark:bg-gray-800"
                                placeholder="Da"
                              />
                              <input
                                type="number"
                                step="0.0001"
                                value={criterion.rangeTo}
                                onChange={(event) => setNumericCriteria((current) => current.map((entry) =>
                                  entry.id === criterion.id ? { ...entry, rangeTo: event.target.value } : entry,
                                ))}
                                className="rounded border px-3 py-2 dark:bg-gray-800"
                                placeholder="A"
                              />
                            </div>
                          ) : (
                            <input
                              type="number"
                              step="0.0001"
                              value={criterion.value}
                              onChange={(event) => setNumericCriteria((current) => current.map((entry) =>
                                entry.id === criterion.id ? { ...entry, value: event.target.value } : entry,
                              ))}
                              className="rounded border px-3 py-2 dark:bg-gray-800"
                              placeholder="Valore"
                            />
                          )}
                        </div>
                      </div>
                    ))}

                    {mode === 'date' && dateCriteria.map((criterion, index) => (
                      <div key={criterion.id} className="rounded border p-3 dark:border-gray-700">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">Criterio {index + 1}</span>
                          {dateCriteria.length > 1 && (
                            <button
                              className="text-sm text-red-600 hover:underline"
                              onClick={() => setDateCriteria((current) => current.filter((entry) => entry.id !== criterion.id))}
                              type="button"
                            >
                              Rimuovi
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
                          <select
                            value={criterion.definitionId ?? ''}
                            onChange={(event) => setDateCriteria((current) => current.map((entry) =>
                              entry.id === criterion.id
                                ? { ...entry, definitionId: event.target.value ? Number(event.target.value) : null }
                                : entry,
                            ))}
                            className="rounded border px-3 py-2 dark:bg-gray-800"
                          >
                            <option value="">Seleziona metadato</option>
                            {dateDefinitions.map((definition) => (
                              <option key={definition.id} value={definition.id}>{definition.label}</option>
                            ))}
                          </select>
                          <select
                            value={criterion.operator}
                            onChange={(event) => setDateCriteria((current) => current.map((entry) =>
                              entry.id === criterion.id
                                ? { ...entry, operator: event.target.value as MetadataFilterOperator }
                                : entry,
                            ))}
                            className="rounded border px-3 py-2 dark:bg-gray-800"
                          >
                            {dateOperators.map((operator) => (
                              <option key={operator.value} value={operator.value}>{operator.label}</option>
                            ))}
                          </select>
                          {isBetweenOperator(criterion.operator) ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <input
                                  type="date"
                                  value={criterion.rangeFrom === 'today' ? todayISO() : criterion.rangeFrom}
                                  onChange={(event) => setDateCriteria((current) => current.map((entry) =>
                                    entry.id === criterion.id ? { ...entry, rangeFrom: event.target.value } : entry,
                                  ))}
                                  className="w-full rounded border px-3 py-2 dark:bg-gray-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => setDateCriteria((current) => current.map((entry) =>
                                    entry.id === criterion.id ? { ...entry, rangeFrom: 'today' } : entry,
                                  ))}
                                  className={`w-full rounded px-2 py-1 text-xs ${
                                    criterion.rangeFrom === 'today'
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  🗓 Oggi{criterion.rangeFrom === 'today' ? ` (${todayISO()})` : ''}
                                </button>
                              </div>
                              <div className="space-y-1">
                                <input
                                  type="date"
                                  value={criterion.rangeTo === 'today' ? todayISO() : criterion.rangeTo}
                                  onChange={(event) => setDateCriteria((current) => current.map((entry) =>
                                    entry.id === criterion.id ? { ...entry, rangeTo: event.target.value } : entry,
                                  ))}
                                  className="w-full rounded border px-3 py-2 dark:bg-gray-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => setDateCriteria((current) => current.map((entry) =>
                                    entry.id === criterion.id ? { ...entry, rangeTo: 'today' } : entry,
                                  ))}
                                  className={`w-full rounded px-2 py-1 text-xs ${
                                    criterion.rangeTo === 'today'
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  🗓 Oggi{criterion.rangeTo === 'today' ? ` (${todayISO()})` : ''}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <input
                                type="date"
                                value={criterion.value === 'today' ? todayISO() : criterion.value}
                                onChange={(event) => setDateCriteria((current) => current.map((entry) =>
                                  entry.id === criterion.id ? { ...entry, value: event.target.value } : entry,
                                ))}
                                className="w-full rounded border px-3 py-2 dark:bg-gray-800"
                              />
                              <button
                                type="button"
                                onClick={() => setDateCriteria((current) => current.map((entry) =>
                                  entry.id === criterion.id ? { ...entry, value: 'today' } : entry,
                                ))}
                                className={`w-full rounded px-2 py-1 text-xs ${
                                  criterion.value === 'today'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                                }`}
                              >
                                🗓 Oggi{criterion.value === 'today' ? ` (${todayISO()})` : ''}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {mode === 'boolean' && booleanCriteria.map((criterion, index) => (
                      <div key={criterion.id} className="rounded border p-3 dark:border-gray-700">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">Criterio {index + 1}</span>
                          {booleanCriteria.length > 1 && (
                            <button
                              className="text-sm text-red-600 hover:underline"
                              onClick={() => setBooleanCriteria((current) => current.filter((entry) => entry.id !== criterion.id))}
                              type="button"
                            >
                              Rimuovi
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                          <select
                            value={criterion.definitionId ?? ''}
                            onChange={(event) => setBooleanCriteria((current) => current.map((entry) =>
                              entry.id === criterion.id
                                ? { ...entry, definitionId: event.target.value ? Number(event.target.value) : null }
                                : entry,
                            ))}
                            className="rounded border px-3 py-2 dark:bg-gray-800"
                          >
                            <option value="">Seleziona metadato</option>
                            {booleanDefinitions.map((definition) => (
                              <option key={definition.id} value={definition.id}>{definition.label}</option>
                            ))}
                          </select>
                          <select
                            value={criterion.value === '' ? '' : criterion.operator === 'is_null' ? 'null' : criterion.value ? 'true' : 'false'}
                            onChange={(event) => setBooleanCriteria((current) => current.map((entry) =>
                              entry.id === criterion.id
                                ? {
                                  ...entry,
                                  value: event.target.value === 'null' ? '' : event.target.value === 'true',
                                  operator: event.target.value === 'null' ? 'is_null' : 'equals',
                                }
                                : entry,
                            ))}
                            className="rounded border px-3 py-2 dark:bg-gray-800"
                          >
                            <option value="">Seleziona valore</option>
                            <option value="true">Sì</option>
                            <option value="false">No</option>
                            <option value="null">Non impostato</option>
                          </select>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        if (mode === 'numeric') {
                          setNumericCriteria((current) => [...current, createEmptyNumericCriterion()]);
                        } else if (mode === 'date') {
                          setDateCriteria((current) => [...current, createEmptyDateCriterion()]);
                        } else {
                          setBooleanCriteria((current) => [...current, createEmptyBooleanCriterion()]);
                        }
                      }}
                      className="rounded bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                      Aggiungi criterio
                    </button>
                  </div>
                )}

                <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
                  <label className="mb-2 block text-sm font-medium">Salva come template</label>
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded border px-3 py-2 dark:bg-gray-800"
                      placeholder="Nome template"
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                    />
                    <button
                      className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                      disabled={busy}
                      onClick={saveCurrentTemplate}
                      type="button"
                    >
                      Salva
                    </button>
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setIsOpen(false);
                    }}
                    className="rounded bg-gray-400 px-4 py-2 text-white hover:bg-gray-500"
                  >
                    Azzera filtro attivo
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="rounded bg-gray-300 px-4 py-2 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                      Chiudi
                    </button>
                    <button
                      type="button"
                      disabled={busy || activeDefinitions.length === 0 || activeCriteria.length === 0}
                      onClick={applyCurrentFilter}
                      className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                      Applica filtro
                    </button>
                  </div>
                </div>
              </div>

              <aside className="rounded border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-3 font-semibold">Template salvati</h3>
                <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                  {templates.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-300">Nessun template disponibile.</div>
                  ) : (
                    templates.map((template) => (
                      <div key={template.id} className="rounded border p-3 dark:border-gray-700">
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-300">{template.description}</div>
                        )}
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                          Tipo: {template.filter_type}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                            onClick={() => void applyTemplate(template.id)}
                            type="button"
                          >
                            Applica
                          </button>
                          <button
                            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                            onClick={() => void removeTemplate(template.id)}
                            type="button"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </div>

            {message && (
              <div className={`rounded px-3 py-2 text-white ${messageType === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {message}
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}