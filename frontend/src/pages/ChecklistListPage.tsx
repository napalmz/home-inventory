import { useEffect, useState, useRef, useContext } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createChecklist,
  deleteChecklist,
  getChecklists,
  getSharableUsers,
  getAllGroups,
  shareChecklistWithUser,
  unshareChecklistWithUser,
  shareChecklistWithGroup,
  unshareChecklistFromGroup,
  getChecklistUserShares,
  getChecklistGroupShares,
  updateChecklistName
} from '../api';
import { AuthContext } from '../auth-context'
import { Dialog } from '@headlessui/react'
import { Checklist, ChecklistWithMatches } from "../types";

function NewChecklistModal({ isOpen, onClose, onCreate }: {
    isOpen: boolean
    onClose: () => void
    onCreate: (name: string) => void
  }) {
    const [name, setName] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
      if (isOpen) {
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }, [isOpen])

    const handleSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      if (name.trim()) {
        onCreate(name.trim())
        setName('')
        onClose()
      }
    }

    return (
      <Dialog open={isOpen} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 " aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-900 rounded p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-bold mb-4 dark:text-white">Nuova lista</Dialog.Title>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Nome lista"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                ref={inputRef}
                className="w-full border px-3 py-2 mb-4 dark:bg-gray-800 dark:text-white"
              />
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 border rounded dark:bg-gray-400">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Crea</button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    )
  }

function ChecklistListPage() {
  const [checklists, setChecklists] = useState<ChecklistWithMatches[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [ChecklistBeingEdited, setChecklistBeingEdited] = useState<ChecklistWithMatches | null>(null);
  const [ChecklistPermissionsTarget, setChecklistPermissionsTarget] = useState<ChecklistWithMatches | null>(null);
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [allGroups, setAllGroups] = useState<{ id: number; name: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [accessUsers, setAccessUsers] = useState<{ username: string; role?: { name: string } }[]>([]);
  const [accessGroups, setAccessGroups] = useState<{ name: string; role?: { name: string } }[]>([]);
  const [editedName, setEditedName] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const navigate = useNavigate()
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filtro') || '';
  const authContext = useContext(AuthContext)
  const user = authContext?.user
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [editMode, setEditMode] = useState(false);
  const [selectedChecklists, setSelectedChecklists] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'item_count' | 'created'>(
    () => localStorage.getItem('checklist_sortBy') as 'name' | 'date' | 'item_count' | 'created' || 'created'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => localStorage.getItem('checklist_sortOrder') as 'asc' | 'desc' || 'asc');
  const [searchQuery, setSearchQuery] = useState(initialFilter);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const query = searchQuery.trim();
        const res = await getChecklists(query.length > 0 ? query : undefined);
        setChecklists(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchQuery]);

  useEffect(() => {
    if (ChecklistBeingEdited) {
      setEditedName(ChecklistBeingEdited.name);
    }
  }, [ChecklistBeingEdited]);

  const handleClick = (id: number) => {
    const query = searchQuery.trim();
    if (query) {
      navigate(`/checklists/${id}?filtro=${encodeURIComponent(query)}`);
    } else {
      navigate(`/checklists/${id}`);
    }
  }

  const getSortedChecklists = () => {
    const sorted = [...checklists];
    sorted.sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortBy === 'item_count') {
        return sortOrder === 'asc'
          ? a.item_count - b.item_count
          : b.item_count - a.item_count;
      } else if (sortBy === 'created') {
        return sortOrder === 'asc'
          ? new Date(a.data_ins).getTime() - new Date(b.data_ins).getTime()
          : new Date(b.data_ins).getTime() - new Date(a.data_ins).getTime();
      } else {
        return sortOrder === 'asc'
          ? new Date(a.data_mod).getTime() - new Date(b.data_mod).getTime()
          : new Date(b.data_mod).getTime() - new Date(a.data_mod).getTime();
      }
    });
    return sorted;
  };

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
    const timeout = setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, type === "success" ? 5000 : 10000);
    return () => clearTimeout(timeout);
  };

  const openAccessModal = async (inv: Checklist) => {
    const allUsersList = await getSharableUsers(inv.id);
    const allGroupsList = await getAllGroups();
    setAllUsers(
      (allUsersList as { username: string; role?: { name: string } }[])
        .filter(u => u.role && u.role.name !== 'admin')
        .map(u => u.username)
    );
    setAllGroups((allGroupsList as { id: number, name: string }[]).map(g => ({ id: g.id, name: g.name })));
    setChecklistPermissionsTarget(inv);
    try {
      const [userList, groupList] = await Promise.all([
        getChecklistUserShares(inv.id),
        getChecklistGroupShares(inv.id)
      ]);
      setAccessUsers(userList as { username: string; role?: { name: string } }[]);
      setAccessGroups(
        (groupList as string[]).map(name => ({ name }))
      );
    } catch (err) {
      console.error("Errore caricamento accessi lista:", err);
    }
  };

  if (loading) return <p>Caricamento...</p>
  if (error) return <p>Errore: {error}</p>

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Liste</h1>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filtra per oggetto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchQuery('');
            }}
            className="border px-3 py-2 rounded w-full sm:w-96"
          />
          <button
            onClick={() => {
              setSearchQuery('');
              setChecklists([]);
            }}
            className="px-4 py-2 bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded"
          >
            <span className="inline sm:hidden">❌</span>
            <span className="hidden sm:inline">Cancella filtro</span>
          </button>
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">Ordina per:</label>
          <select
            value={sortBy}
            onChange={(e) => {
              const value = e.target.value as 'name' | 'date' | 'item_count';
              localStorage.setItem('checklist_sortBy', value);
              setSortBy(value);
            }}
            className="border px-2 py-1 rounded"
          >
            <option value="date">Data modifica</option>
            <option value="created">Data creazione</option>
            <option value="name">Nome</option>
            <option value="item_count">Numero di oggetti</option>
          </select>
          <button
            onClick={() => {
              const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
              localStorage.setItem('checklist_sortOrder', newOrder);
              setSortOrder(newOrder);
            }}
            className="border rounded p-1 px-2"
            title={`Ordina in ordine ${sortOrder === 'asc' ? 'decrescente' : 'crescente'}`}
          >
            {sortOrder === 'asc' ? '⬆️' : '⬇️'}
          </button>
        </div>
        {editMode && (
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedChecklists(checklists.map(item => item.id))}
              className="px-2 py-1 text-sm bg-blue-500 text-white rounded"
            >
              Seleziona tutti
            </button>
            <button
              onClick={() => setSelectedChecklists([])}
              className="px-2 py-1 text-sm bg-gray-500 text-white rounded"
            >
              Deseleziona tutti
            </button>
          </div>
        )}
      </div>
      {user && user.role.name !== 'viewer' && (
        <>
          <NewChecklistModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onCreate={async (name) => {
              try {
                const newInv = await createChecklist(name) as unknown as Checklist;

                if (!newInv?.id) {
                  showMessage('Errore nella risposta del server.', 'error');
                  return;
                }

                setChecklists((prev) => [...prev, newInv]);
                showMessage('Lista creata con successo!', 'success');
              } catch (error) {
                showMessage("Errore durante la creazione della lista", 'error');
                console.error('Errore durante la creazione della lista:', error);
              }
            }}
          />
        </>
      )}
      {checklists.length === 0 ? (
        <p>Nessuna lista disponibile.</p>
      ) : (
        <ul className="space-y-2">
          {getSortedChecklists().map((inv: ChecklistWithMatches) => (
            <li
              key={inv.id}
              className={`p-4 border rounded shadow cursor-pointer flex justify-between items-center text-black dark:text-white ${
                selectedChecklists.includes(inv.id)
                  ? "bg-yellow-100"
                  : "hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
              onClick={() => {
                if (editMode) {
                  setSelectedChecklists((prev) =>
                    prev.includes(inv.id)
                      ? prev.filter((id) => id !== inv.id)
                      : [...prev, inv.id]
                  );
                } else {
                  handleClick(inv.id);
                }
              }}
            >
              {editMode ? (
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-grow">
                    <h2 className={`text-lg font-semibold ${selectedChecklists.includes(inv.id) ? "dark:text-black" : "" }`}>{inv.name}</h2>
                    <p className="text-sm text-gray-500 sm:ml-4">
                      Creatore: {inv.owner.username} | Oggetti: {inv.item_count} | Ultima modifica: {new Date(inv.data_mod).toLocaleString()}
                    </p>
                    {(user?.role.name === 'admin' || user?.role.name === 'moderator') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAccessModal(inv);
                      }}
                    className="ml-4 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-700 text-sm"
                    >
                      <span className="inline md:hidden">🔐</span>
                      <span className="hidden md:inline">Accessi</span>
                    </button>
                  )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChecklistBeingEdited(inv);
                      setIsEditModalOpen(true);
                    }}
                    className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    <span className="inline md:hidden">✏️</span>
                    <span className="hidden md:inline">Modifica</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-grow">
                  <h2 className="text-lg font-semibold">{inv.name}</h2>
                  <p className="text-sm text-gray-500 sm:ml-4">
                    Creatore: {inv.owner.username} | Oggetti: {inv.item_count} | Ultima modifica: {new Date(inv.data_mod).toLocaleString()}
                  </p>
                  {inv.matching_items && inv.matching_items.length > 0 && (
                    <div className="mt-2 p-2 border rounded bg-yellow-50">
                      <p className="text-xs font-medium text-gray-700">Corrispondenze trovate:</p>
                      <ul className="text-sm list-disc list-inside">
                        {inv.matching_items.map((item: {
                          id: number;
                          name: string;
                          description: string;
                          quantity: number;
                          username_ins?: string;
                          username_mod?: string | null;
                          highlighted?: {
                            name: string;
                            description?: string | null;
                          };
                        }) => (
                          <li key={item.id}>
                            <span
                              dangerouslySetInnerHTML={{
                                __html: `${item.quantity}x ${(item.highlighted?.name || item.name)}`.replace(
                                  /\*\*(.*?)\*\*/g,
                                  "<span style='background-color: #cce5ff; padding: 0 2px; border-radius: 2px;'>$1</span>"
                                )
                              }}
                            />
                            {item.highlighted?.description && item.highlighted.description.trim() && (
                              <>
                                {' – '}
                                <span
                                  className="text-gray-500"
                                  dangerouslySetInnerHTML={{
                                    __html: item.highlighted.description.replace(
                                      /\*\*(.*?)\*\*/g,
                                      "<span style='background-color: #cce5ff; padding: 0 2px; border-radius: 2px;'>$1</span>"
                                    )
                                  }}
                                />
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div
        className={`z-40 gap-2 flex ${
          window.innerWidth >= 768
            ? 'fixed top-4 right-4 flex-row'
            : 'fixed bottom-2 right-2 flex-col'
        }`}
      >
        {editMode && selectedChecklists.length > 0 && (
          <button
            onClick={async () => {
              const deletableIds = checklists
                .filter(inv => selectedChecklists.includes(inv.id) && inv.item_count === 0)
                .map(inv => inv.id);

              const nonDeletable = checklists
                .filter(inv => selectedChecklists.includes(inv.id) && inv.item_count > 0);

              if (deletableIds.length === 0 && nonDeletable.length > 0) {
                showMessage("Le liste selezionate contengono oggetti e non possono essere cancellate.", "error");
                return;
              }

              if (window.confirm("Sei sicuro di voler cancellare le liste selezionate senza oggetti?")) {
                try {
                  await Promise.all(deletableIds.map(id => deleteChecklist(id)))
                  setChecklists(prev => prev.filter(inv => !deletableIds.includes(inv.id)));
                  setSelectedChecklists([]);
                  setEditMode(false); // Disabilita la modalità di modifica dopo la cancellazione
                  showMessage("Liste senza oggetti cancellate con successo.", "success");
                } catch {
                  showMessage("Errore durante la cancellazione delle liste.", "error");
                }

                if (nonDeletable.length > 0) {
                  showMessage("Alcune liste non sono state cancellate perché contengono oggetti.", "error");
                }
              }
            }}
            className="py-2 px-4 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700"
          >
            <span className="inline md:hidden">🗑️ {( selectedChecklists.length )}</span>
            <span className="hidden md:inline">Elimina {( selectedChecklists.length )}</span>
          </button>
        )}
        {user?.role.name !== 'viewer' && (
          <>
            <button
              onClick={() => {
                setEditMode(!editMode);
                setSelectedChecklists([]);
              }}
              className={`py-2 px-4 rounded-full shadow-lg text-white ${
                editMode ? 'bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              <span className="inline md:hidden">{editMode ? "✖️" : "✏️"}</span>
              <span className="hidden md:inline">{editMode ? "Chiudi" : "Modifica"}</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-2 px-4 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
            >
              <span className="inline md:hidden">➕</span>
              <span className="hidden md:inline">Nuova</span>
            </button>
          </>
        )}
      </div>

      <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-900 rounded p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-semibold mb-4 dark:text-white">Modifica lista</Dialog.Title>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!ChecklistBeingEdited) return;
                await updateChecklistName(ChecklistBeingEdited.id, editedName);
                setChecklists((prev) =>
                  prev.map((inv) => (inv.id === ChecklistBeingEdited.id ? { ...inv, name: editedName } : inv))
                );
                setIsEditModalOpen(false);
                setChecklistBeingEdited(null);
                setEditedName('');
                showMessage("Lista modificata con successo.", "success");
              }}
            >
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full border px-3 py-2 mb-4 dark:bg-gray-800 dark:text-white"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded dark:bg-gray-400">Annulla</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
                  Salva
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      <Dialog open={!!ChecklistPermissionsTarget} onClose={() => setChecklistPermissionsTarget(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-900 rounded p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold mb-4 dark:text-white">Gestione Accessi – {ChecklistPermissionsTarget?.name}</Dialog.Title>

            <div className="mb-4">
              <h3 className="font-semibold text-md mb-2 dark:text-white">Utenti con accesso</h3>
              <ul className="mb-2 text-sm text-gray-700 dark:text-white space-y-1">
              <div className="flex items-center gap-2 mt-2">
                <select
                  className="border px-2 py-1 rounded text-sm"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">-- Seleziona utente --</option>
                  {allUsers
                    .filter(u => !accessUsers.some(au => au.username === u))
                    .map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                </select>
                <button
                  disabled={!selectedUser}
                  onClick={async () => {
                    if (!ChecklistPermissionsTarget || !selectedUser) return;
                    await shareChecklistWithUser(ChecklistPermissionsTarget.id, selectedUser);
                    setAccessUsers(prev => [...prev, { username: selectedUser }]);
                    setSelectedUser('');
                  }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                >
                  Aggiungi
                </button>
              </div>
                {accessUsers
                  .filter(user => user && user.username)
                  .map((user) => (
                  <li key={user.username} className="flex justify-between items-center border-b py-1 dark:text-white">
                    <span>{user.username} {user.role?.name ? `(${user.role.name})` : ""}</span>
                    <button
                      onClick={async () => {
                        if (!ChecklistPermissionsTarget) return;
                        await unshareChecklistWithUser(ChecklistPermissionsTarget.id, user.username);
                        setAccessUsers(prev => prev.filter(u => u.username !== user.username));
                      }}
                      className="text-red-500 hover:underline text-xs"
                    >
                      Rimuovi
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-md mb-2 dark:text-white">Gruppi con accesso</h3>
              <ul className="mb-2 text-sm text-gray-700 dark:text-white space-y-1">
              <div className="flex items-center gap-2 mt-2">
                <select
                  className="border px-2 py-1 rounded text-sm"
                  value={selectedGroupId ?? ''}
                  onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                >
                  <option value="">-- Seleziona gruppo --</option>
                  {allGroups
                    .filter(g => !(accessGroups || []).some(ag => ag.name === g.name))
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
                <button
                  disabled={!selectedGroupId}
                  onClick={async () => {
                    if (!ChecklistPermissionsTarget || selectedGroupId === null) return;
                    await shareChecklistWithGroup(ChecklistPermissionsTarget.id, selectedGroupId);
                    const groupName = allGroups.find(g => g.id === selectedGroupId)?.name;
                    if (groupName) {
                      setAccessGroups(prev => [...prev, { name: groupName }]);
                    }
                    setSelectedGroupId(null);
                  }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                >
                  Aggiungi
                </button>
              </div>
                {(accessGroups || [])
                  .filter(group => !!group)
                  .map((group) => (
                  <li key={group.name} className="flex justify-between items-center border-b py-1 dark:text-white">
                    <span>{group.name} {group.role?.name ? `(${group.role.name})` : ""}</span>
                    <button
                      onClick={async () => {
                        if (!ChecklistPermissionsTarget) return;
                      const groupObj = allGroups.find(g => g.name === group.name);
                      if (groupObj) {
                        await unshareChecklistFromGroup(ChecklistPermissionsTarget.id, groupObj.id);
                        setAccessGroups((prev) => prev.filter(g => g !== group));
                      }
                      }}
                      className="text-red-500 hover:underline text-xs"
                    >
                      Rimuovi
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setChecklistPermissionsTarget(null)} className="px-4 py-2 border rounded dark:bg-gray-400">Chiudi</button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {message && (
        <div
          className={`fixed z-50 p-3 rounded shadow-lg text-white transition-opacity duration-1000 ${
            messageType === "success" ? "bg-green-500" : "bg-red-500"
          } ${
            window.innerWidth < 768
              ? "bottom-4 left-1/2 transform -translate-x-1/2"
              : "top-4 left-1/2 transform -translate-x-1/2"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}

export default ChecklistListPage