import { useEffect, useState, useRef, useContext } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  // Inventory related imports
  createInventory,
  deleteInventory,
  getInventories,
  getSharableUsers as getInventorySharableUsers,
  getAllGroups as getAllInventoryGroups, 
  shareInventoryWithUser,
  unshareInventoryWithUser,
  shareInventoryWithGroup,
  unshareInventoryFromGroup,
  getInventoryUserShares,
  getInventoryGroupShares, 
  updateInventoryName,
  // Checklist related imports
  createChecklist,
  deleteChecklist,
  getChecklists,
  getSharableUsers as getChecklistSharableUsers,
  getAllGroups as getAllChecklistGroups,
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
import { InventoryWithMatches, ChecklistWithMatches } from "../types"

function NewItemModal({ isOpen, onClose, onCreate, isInventory }: {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => void
  isInventory: boolean
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
          <Dialog.Title className="text-lg font-bold mb-4 dark:text-white">
            {isInventory ? 'Nuovo Inventario' : 'Nuova lista'}
          </Dialog.Title>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder={isInventory ? 'Nome inventario' : 'Nome lista'}
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

// Modale modifica nome elemento (inventario o checklist)
function EditNameModal({ isOpen, onClose, onSave, initialName }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  useEffect(() => { setName(initialName); }, [initialName, isOpen]);
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-900 rounded p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-semibold mb-4 dark:text-white">Modifica nome</Dialog.Title>
          <form onSubmit={e => { e.preventDefault(); onSave(name); }}>
            <input
              type="text"
              className="w-full border px-3 py-2 mb-4 dark:bg-gray-800 dark:text-white"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600">Chiudi</button>
              <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Salva</button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

export default function GenericListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filtro') || '';
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const basePath = location.pathname.split("/")[1] as 'inventories' | 'checklists';
  const isInventory = basePath === 'inventories';
  //const isChecklist = basePath === 'checklists';
  const [items, setItems] = useState<(InventoryWithMatches | ChecklistWithMatches)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Stati per la modale di modifica
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemBeingEdited, setItemBeingEdited] = useState<InventoryWithMatches | ChecklistWithMatches | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'item_count' | 'created'>(
    () => {
      const stored = localStorage.getItem(isInventory ? 'inventory_sortBy' : 'checklist_sortBy');
      if (stored === 'name' || stored === 'date' || stored === 'item_count' || stored === 'created') return stored;
      return 'created';
    }
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    () => {
      const stored = localStorage.getItem(isInventory ? 'inventory_sortOrder' : 'checklist_sortOrder');
      if (stored === 'asc' || stored === 'desc') return stored;
      return 'asc';
    }
  );
  const [searchQuery, setSearchQuery] = useState(initialFilter);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  // Stati per la gestione accessi
  const [permissionsTarget, setPermissionsTarget] = useState<InventoryWithMatches | ChecklistWithMatches | null>(null);
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [allGroups, setAllGroups] = useState<{ id: number; name: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [accessUsers, setAccessUsers] = useState<{ username: string; role?: { name: string } }[]>([]);
  const [accessGroups, setAccessGroups] = useState<{ name: string; role?: { name: string } }[]>([]);

  useEffect(() => {
    //setLoading(true);
    const fetchData = async () => {
      try {
        const query = searchQuery.trim();
        const res = isInventory
          ? await getInventories(query.length > 0 ? query : undefined)
          : await getChecklists(query.length > 0 ? query : undefined);
        setItems(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchQuery, isInventory]);

  useEffect(() => {
    if (itemBeingEdited) {
        setEditedName(itemBeingEdited.name);
    }
  }, [itemBeingEdited]);

  const handleClick = (id: number) => {
    const query = searchQuery.trim();
    if (query) {
      navigate(`/${basePath}/${id}?filtro=${encodeURIComponent(query)}`);
    } else {
      navigate(`/${basePath}/${id}`);
    }
  }

  const getSortedItems = () => {
    const sorted = [...items];
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

  // Funzione per aprire il dialog di gestione accessi (utenti/gruppi)
  const openAccessModal = async (item: InventoryWithMatches | ChecklistWithMatches) => {
    if (isInventory) {
      const allUsersList = await getInventorySharableUsers(item.id);
      const allGroupsList = await getAllInventoryGroups();
      setAllUsers((allUsersList as { username: string; role?: { name: string } }[])
        .filter(u => u.role && u.role.name !== 'admin')
        .map(u => u.username));
      setAllGroups((allGroupsList as { id: number, name: string }[]).map(g => ({ id: g.id, name: g.name })));
      setPermissionsTarget(item);
      try {
        const [userList, groupList] = await Promise.all([
          getInventoryUserShares(item.id),
          getInventoryGroupShares(item.id)
        ]);
        setAccessUsers(userList as { username: string; role?: { name: string } }[]);
        setAccessGroups((groupList as string[]).map(name => ({ name })));
      } catch (err) {
        console.error("Errore caricamento accessi inventario:", err);
      }
    } else {
      const allUsersList = await getChecklistSharableUsers(item.id);
      const allGroupsList = await getAllChecklistGroups();
      setAllUsers((allUsersList as { username: string; role?: { name: string } }[])
        .filter(u => u.role && u.role.name !== 'admin')
        .map(u => u.username));
      setAllGroups((allGroupsList as { id: number, name: string }[]).map(g => ({ id: g.id, name: g.name })));
      setPermissionsTarget(item);
      try {
        const [userList, groupList] = await Promise.all([
          getChecklistUserShares(item.id),
          getChecklistGroupShares(item.id)
        ]);
        setAccessUsers(userList as { username: string; role?: { name: string } }[]);
        setAccessGroups((groupList as string[]).map(name => ({ name })));
      } catch (err) {
        console.error("Errore caricamento accessi lista:", err);
      }
    }
  };

  // Funzione per aprire la modale di modifica
  const openEditModal = (item: InventoryWithMatches | ChecklistWithMatches) => {
    setItemBeingEdited(item);
    setEditedName(item.name);
    setIsEditModalOpen(true);
  };

  // Funzione per salvare la modifica
  const handleEditSave = async (name: string) => {
    if (!itemBeingEdited) return;
    try {
      if (isInventory) {
        await updateInventoryName(itemBeingEdited.id, name);
      } else {
        await updateChecklistName(itemBeingEdited.id, name);
      }
      setItems(prev => prev.map(i => i.id === itemBeingEdited.id ? { ...i, name } : i));
      setIsEditModalOpen(false);
      setItemBeingEdited(null);
      showMessage('Nome aggiornato con successo!', 'success');
    } catch {
      showMessage('Errore durante l\'aggiornamento del nome', 'error');
    }
  };

  if (loading) return <p>Caricamento...</p>;
  if (error) return <p>Errore: {error}</p>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{isInventory ? 'Inventari' : 'Liste'}</h1>
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
              setSearchQuery('')
              setSelectedItems([])
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
              const value = e.target.value;
              if (value === 'name' || value === 'date' || value === 'item_count' || value === 'created') {
                localStorage.setItem(isInventory ? 'inventory_sortBy' : 'checklist_sortBy', value);
                setSortBy(value);
              }
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
              localStorage.setItem(isInventory ? 'inventory_sortOrder' : 'checklist_sortOrder', newOrder);
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
              onClick={() => setSelectedItems(items.map(item => item.id))}
              className="px-2 py-1 text-sm bg-blue-500 text-white rounded"
            >
              Seleziona tutti
            </button>
            <button
              onClick={() => setSelectedItems([])}
              className="px-2 py-1 text-sm bg-gray-500 text-white rounded"
            >
              Deseleziona tutti
            </button>
          </div>
        )}
      </div>
      {user && user.role.name !== 'viewer' && (
        <>
          <NewItemModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onCreate={async (name) => {
              try {
                const newItem = isInventory
                  ? await createInventory(name) as unknown as InventoryWithMatches
                  : await createChecklist(name) as unknown as ChecklistWithMatches;
                if (!newItem?.id) {
                  showMessage('Errore nella risposta del server.', 'error');
                  return;
                }
                setItems((prev) => [...prev, newItem]);
                showMessage(isInventory ? 'Inventario creato con successo!' : 'Lista creata con successo!', 'success');
              } catch (error) {
                showMessage(isInventory ? "Errore durante la creazione dell'inventario" : "Errore durante la creazione della lista", 'error');
                console.error('Errore durante la creazione:', error);
              }
            }}
            isInventory={isInventory}
          />
        </>
      )}
      {items.length === 0 ? (
        <p>{isInventory ? 'Nessun inventario disponibile.' : 'Nessuna lista disponibile.'}</p>
      ) : (
        <ul className="space-y-2">
          {getSortedItems().map((inv) => (
            <li
              key={inv.id}
              className={`p-4 border rounded shadow cursor-pointer flex justify-between items-center text-black dark:text-white ${
                selectedItems.includes(inv.id)
                  ? "bg-yellow-100"
                  : "hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
              onClick={() => {
                if (editMode) {
                  setSelectedItems((prev) =>
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
                    <h2 className={`text-lg font-semibold ${selectedItems.includes(inv.id) ? "dark:text-black" : "" }`}>{inv.name}</h2>
                    <p className="text-sm text-gray-500 sm:ml-4 text-right sm:text-right w-full sm:w-auto">
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
                      openEditModal(inv);
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
        {editMode && selectedItems.length > 0 && (
          <button
            onClick={async () => {
              const deletableIds = items
                .filter(inv => selectedItems.includes(inv.id) && inv.item_count === 0)
                .map(inv => inv.id);
              const nonDeletable = items
                .filter(inv => selectedItems.includes(inv.id) && inv.item_count > 0);
              if (deletableIds.length === 0 && nonDeletable.length > 0) {
                showMessage((isInventory ? 'Puoi eliminare solo inventari vuoti.' : 'Puoi eliminare solo liste vuote.'), 'error');
                return;
              }
              if (window.confirm('Sei sicuro di voler cancellare gli elementi selezionati senza oggetti?')) {
                for (const id of deletableIds) {
                  if (isInventory) await deleteInventory(id);
                  else await deleteChecklist(id);
                }
                setItems((prev) => prev.filter((i) => !deletableIds.includes(i.id)));
                setSelectedItems([]);
                setEditMode(false);
                showMessage('Eliminazione completata.', 'success');
              }
            }}
            className="py-2 px-4 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700"
          >
            <span className="inline md:hidden">🗑️ </span>
            <span className="hidden md:inline">Elimina </span>
          </button>
        )}
        {user?.role.name !== 'viewer' && (
          <>
            <button
              onClick={() => { setEditMode((prev) => !prev); setSelectedItems([]); }}
              className={`py-2 px-4 rounded-full shadow-lg text-white ${editMode ? 'bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-600'}`}
            >
              <span className="inline md:hidden">{editMode ? '✖️' : '✏️'}</span>
              <span className="hidden md:inline">{editMode ? 'Chiudi' : 'Modifica'}</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-2 px-4 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
            >
              <span className="inline md:hidden">➕</span>
              <span className="hidden md:inline">Nuovo</span>
            </button>
          </>
        )}
      </div>
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
      {/* Dialog per la gestione accessi */}
      {permissionsTarget && (
        <Dialog open={!!permissionsTarget} onClose={() => setPermissionsTarget(null)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-white dark:bg-gray-900 rounded p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
              <Dialog.Title className="text-lg font-bold mb-4 dark:text-white">
                Gestione Accessi – {permissionsTarget?.name}
              </Dialog.Title>
              <div className="mb-4">
                <label className="block font-medium mb-1">Utenti con accesso:</label>
                <ul className="mb-2">
                  {accessUsers.map(u => (
                    <li key={u.username} className="flex items-center gap-2">
                      <span>{u.username}</span>
                      <span className="text-xs text-gray-500">({u.role?.name})</span>
                      <button
                        className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-xs"
                        onClick={async () => {
                          if (isInventory) await unshareInventoryWithUser(permissionsTarget!.id, u.username);
                          else await unshareChecklistWithUser(permissionsTarget!.id, u.username);
                          setAccessUsers(prev => prev.filter(x => x.username !== u.username));
                        }}
                      >Rimuovi</button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 mb-2">
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    className="border rounded p-1"
                  >
                    <option value="">Seleziona utente</option>
                    {allUsers.filter(u => !accessUsers.some(a => a.username === u)).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <button
                    className="px-2 py-1 bg-green-600 text-white rounded"
                    onClick={async () => {
                      if (!selectedUser) return;
                      if (isInventory) await shareInventoryWithUser(permissionsTarget!.id, selectedUser);
                      else await shareChecklistWithUser(permissionsTarget!.id, selectedUser);
                      setAccessUsers(prev => [...prev, { username: selectedUser }]);
                      setSelectedUser('');
                    }}
                  >Aggiungi</button>
                </div>
              </div>
              <div className="mb-4">
                <label className="block font-medium mb-1">Gruppi con accesso:</label>
                <ul className="mb-2">
                  {accessGroups.map(g => (
                    <li key={g.name} className="flex items-center gap-2">
                      <span>{g.name}</span>
                      <button
                        className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-xs"
                        onClick={async () => {
                          const group = allGroups.find(gr => gr.name === g.name);
                          if (!group) return;
                          if (isInventory) await unshareInventoryFromGroup(permissionsTarget!.id, group.id);
                          else await unshareChecklistFromGroup(permissionsTarget!.id, group.id);
                          setAccessGroups(prev => prev.filter(x => x.name !== g.name));
                        }}
                      >Rimuovi</button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 mb-2">
                  <select
                    value={selectedGroupId ?? ''}
                    onChange={e => setSelectedGroupId(Number(e.target.value))}
                    className="border rounded p-1"
                  >
                    <option value="">Seleziona gruppo</option>
                    {allGroups.filter(g => !accessGroups.some(a => a.name === g.name)).map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <button
                    className="px-2 py-1 bg-green-600 text-white rounded"
                    onClick={async () => {
                      if (!selectedGroupId) return;
                      const group = allGroups.find(g => g.id === selectedGroupId);
                      if (!group) return;
                      if (isInventory) await shareInventoryWithGroup(permissionsTarget!.id, group.id);
                      else await shareChecklistWithGroup(permissionsTarget!.id, group.id);
                      setAccessGroups(prev => [...prev, { name: group.name }]);
                      setSelectedGroupId(null);
                    }}
                  >Aggiungi</button>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setPermissionsTarget(null)}
                  className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600"
                >Chiudi</button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
      {/* Modale modifica nome */}
      <EditNameModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setItemBeingEdited(null); }}
        onSave={handleEditSave}
        initialName={editedName}
      />
    </div>
  );
}