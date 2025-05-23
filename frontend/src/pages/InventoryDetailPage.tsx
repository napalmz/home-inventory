import { useParams, useLocation, Link } from "react-router-dom";
import { useRef, useEffect, useState } from 'react';
import {
  getInventoryById, getInventoryItems,
  getChecklistById, getChecklistItems,
  createItem, updateItem, deleteItem } from "../api";
import { Inventory, Item, User } from "../types";
import { Dialog } from "@headlessui/react";
import { useContext } from "react";
import { AuthContext } from "../auth-context";
import { useSwipeable } from 'react-swipeable';

interface Props {
  item: Item;
  isMobile: boolean;
  isChecklist: boolean;
  isInventory: boolean;
  user: User | null;
  isEditMode: boolean;
  selectedItems: number[];
  setSelectedItems: React.Dispatch<React.SetStateAction<number[]>>;
  setItemBeingEdited: (item: Item) => void;
  updateItem: (id: number, item: Partial<Item>) => Promise<Item | null>;
  deleteItem: (id: number) => Promise<void>;
  setIsCloning: React.Dispatch<React.SetStateAction<boolean>>;
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
}

export function SwipeableItemRow({
  item, isMobile, isChecklist, isInventory, user,
  isEditMode, selectedItems, setSelectedItems, setItemBeingEdited,
  updateItem, deleteItem, setItems, setIsCloning, 
}: Props) {
  const [action, setAction] = useState<'left' | 'right' | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Gestione click fuori per chiudere i pulsanti swipe
  useEffect(() => {
    if (!action) return;

    function handleClickOutside(e: MouseEvent) {
      // Se il target ha la classe "swipe-button", ignora
      if ((e.target as HTMLElement).classList.contains("swipe-button")) {
        return;
      }
      setAction(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [action]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setAction('left'),
    onSwipedRight: () => setAction('right'),
    //onTap: () => setAction(null),
    trackMouse: false,
    delta: 40,
  });

  const isViewer = user?.role.name === 'viewer';

  const cloneItem = () => {
    const cloned = {
      ...item,
      id: 0, // id fittizio, sarà gestito dal backend al salvataggio
      name: `${item.name} (copia)`
    };
    setItemBeingEdited(cloned);
    setIsCloning(true);
  };

  // Combine refs for swipeHandlers and rowRef to avoid duplicate ref assignment
  const combinedRef = (el: HTMLDivElement | null) => {
    rowRef.current = el;
    if (isMobile && swipeHandlers.ref) {
      swipeHandlers.ref(el);
    }
  };

  const handleClone = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    //console.log("Clona premuto", item);
    cloneItem();
    setAction(null);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    //console.log("Modifica premuto", item);
    setItemBeingEdited(item);
    setIsCloning(false);
    setAction(null);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    //console.log("Elimina premuto", item);
    if (confirm("Vuoi eliminare questo elemento?")) {
      deleteItem(item.id).then(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      });
    }
    setAction(null);
  };

  return (
    <div
      ref={combinedRef}
      className="relative mb-2"
    >
      {/* Action buttons */}
      {(action === 'left') && !isViewer && (
        <>
          <button
            className="swipe-button absolute transition-transform duration-300 ease-in-out transform translate-x-0 right-1/4 top-0 h-full w-1/4 bg-yellow-500 text-white font-bold z-20"
            onClick={handleClone}
          >
            📄
          </button>
          <button
            className="swipe-button absolute transition-transform duration-300 ease-in-out transform translate-x-0 right-0 top-0 h-full w-1/4 bg-blue-600 text-white font-bold z-20"
            onClick={handleEdit}
          >
            ✏️
          </button>
        </>
      )}
      {(action === 'right') && !isViewer && (
        <button
          className="swipe-button absolute transition-transform duration-300 ease-in-out transform translate-x-0 left-0 top-0 h-full w-1/4 bg-red-600 text-white font-bold z-20"
          onClick={handleDelete}
        >
          🗑️
        </button>
      )}

      {/* Actual list item */}
      <li
        className={`relative border p-2 rounded shadow-sm flex flex-col md:flex-row md:justify-between md:items-center
    ${isEditMode && selectedItems.includes(item.id) ? "bg-blue-100 dark:bg-blue-900" : "bg-white dark:bg-gray-800"}
    md:hover:bg-gray-100 dark:md:hover:bg-gray-700
    ${(isChecklist && item.quantity > 0) || (isInventory && item.quantity === 0) ? "text-gray-400" : ""}`}
        onClick={() => {
          if (isEditMode) {
            setSelectedItems(prev =>
              prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
            );
          } else {
            setAction(null);
          }
        }}
      >
        <div className="flex flex-col w-full md:w-auto md:flex-row md:items-center">
          {isEditMode && (
            <div className="mr-2 flex items-center">
              <span className="text-xl">
                {selectedItems.includes(item.id) ? '☑️' : '⬜️'}
              </span>
            </div>
          )}
          <div className="flex flex-col">
            <div className="font-semibold">{item.name}</div>
            {item.description && (
              <div className="text-sm text-gray-500">{item.description}</div>
            )}
            <div className="text-xs text-gray-400">
              Ultima modifica: {item.username_mod} - {new Date(item.data_mod).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 md:mt-0 w-full md:w-auto justify-end">
          {isEditMode && !isViewer && (
            <>
              <button
                className="px-2 py-1 bg-yellow-500 text-white rounded text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  cloneItem();
                }}
              >
                <span className="inline md:hidden">📄</span>
                <span className="hidden md:inline">📄 Clona</span>
              </button>
              <button
                className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setItemBeingEdited(item);
                }}
              >
                <span className="inline md:hidden">✏️</span>
                <span className="hidden md:inline">✏️ Modifica</span>
              </button>
            </>
          )}
          {isChecklist ? (
            <input
              type="checkbox"
              checked={item.quantity > 0}
              disabled={isViewer}
              onChange={(e) => {
                if (isViewer) return;
                const updated = { ...item, quantity: e.target.checked ? 1 : 0 };
                updateItem(item.id, updated).then((upd) => {
                  if (upd) {
                    setItems(prev => prev.map(i => i.id === upd.id ? upd : i));
                  }
                });
              }}
            />
          ) : isInventory && !isViewer ? (
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 bg-gray-400 rounded hover:bg-gray-600 text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = { ...item, quantity: item.quantity - 1 };
                  updateItem(item.id, updated).then((upd) => {
                    if (upd) {
                      setItems(prev => prev.map(i => i.id === upd.id ? upd : i));
                    }
                  });
                }}
              >
                -
              </button>
              <span className="min-w-[24px] text-center">{item.quantity}</span>
              <button
                className="px-2 py-1 bg-gray-400 rounded hover:bg-gray-600 rounded text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = { ...item, quantity: item.quantity + 1 };
                  updateItem(item.id, updated).then((upd) => {
                    if (upd) {
                      setItems(prev => prev.map(i => i.id === upd.id ? upd : i));
                    }
                  });
                }}
              >
                +
              </button>
            </div>
          ) : (
            <span className="min-w-[24px] text-center">{item.quantity}</span>
          )}
        </div>
      </li>
    </div>
  );
}

export default function InventoryDetailPage() {
  const isMobile = window.innerWidth < 768;
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [csvTextarea, setCsvTextarea] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const { id } = useParams();
  const location = useLocation();
  const filtroParam = new URLSearchParams(location.search).get('filtro') || "";
  const basePath = location.pathname.split("/")[1] as "inventories" | "checklists";
  const isInventory = basePath === "inventories";
  const isChecklist = basePath === "checklists";
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [isInsertMode, setisInsertMode] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(isChecklist ? 0 : 1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'quantity'>(() => {
    const stored = localStorage.getItem('item_sortBy');
    if (stored === 'name' || stored === 'date' || stored === 'quantity') return stored;
    return 'name';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    const stored = localStorage.getItem('item_sortOrder');
    if (stored === 'asc' || stored === 'desc') return stored;
    return 'asc';
  });
  const [itemBeingEdited, setItemBeingEdited] = useState<Item | null>(null);
  const [filterText, setFilterText] = useState(filtroParam);
  const [isCloning, setIsCloning] = useState(false);

useEffect(() => {
  const fetchData = async () => {
    if (!id) return;

    const getById  = isInventory ? getInventoryById  : getChecklistById;
    const getItems = isInventory ? getInventoryItems : getChecklistItems;

    const inventoryData = await getById(Number(id));
    if (inventoryData) setInventory(inventoryData as Inventory);

    const itemsData = await getItems(Number(id));
    if (Array.isArray(itemsData)) setItems(itemsData as Item[]);
  };
  fetchData();
}, [id, isInventory]);

  useEffect(() => {
    localStorage.setItem("item_sortBy", sortBy);
    localStorage.setItem("item_sortOrder", sortOrder);
  }, [sortBy, sortOrder]);

  const sortedItems = [...items]
    .filter(item =>
      item.name.toLowerCase().includes(filterText.toLowerCase()) ||
      item.description?.toLowerCase().includes(filterText.toLowerCase())
    )
    .sort((a, b) => {
      // First, sort by checklist/inventory logic for completed/zero items
      if (isChecklist) {
        if (a.quantity === 1 && b.quantity === 0) return 1;
        if (a.quantity === 0 && b.quantity === 1) return -1;
      } else {
        if (a.quantity === 0 && b.quantity > 0) return 1;
        if (a.quantity > 0 && b.quantity === 0) return -1;
      }
      // Then, sort by selected sortBy/sortOrder
      let result = 0;
      if (sortBy === "name") result = a.name.localeCompare(b.name);
      else if (sortBy === "quantity") result = a.quantity - b.quantity;
      else result = new Date(a.data_mod).getTime() - new Date(b.data_mod).getTime();
      return sortOrder === "asc" ? result : -result;
    });

    const handleCSVImport = async (csvText: string) => {
        if (!inventory) return;
      
        const rows = csvText.trim().split('\n');
        const [header, ...lines] = rows;
        const columns = header.split(',').map(c => c.trim().replace(/"/g, ''));
        const nameIndex = columns.indexOf('name');
        const descIndex = columns.indexOf('description');
        const qtyIndex = columns.indexOf('quantity');
      
        if (nameIndex === -1 || qtyIndex === -1) {
          alert('Il CSV deve contenere almeno le colonne "name" e "quantity".');
          return;
        }
      
        const parsedItems = lines.map(line => {
          const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').replace(/""/g, '"'));
          return {
            name: parts[nameIndex],
            description: parts[descIndex] || '',
            quantity: parseInt(parts[qtyIndex], 10) || 0,
            inventory_id: inventory.id
          };
        });
      
        // const merge = window.confirm("Vuoi unire (merge) con gli elementi esistenti per nome?\nPremi Annulla per eliminare tutto e reinserire da zero.");
        const merge = importMode === 'merge';
        if (!merge) {
          await Promise.all(items.map(item => deleteItem(item.id)));
          const inserted = await Promise.all(parsedItems.map(createItem));
          setItems(inserted.filter(Boolean));
        } else {
          const updated = [...items];
          for (const newItem of parsedItems) {
          const existing = updated.find(i => i.name.toLowerCase() === newItem.name.toLowerCase());
            if (existing) {
              const merged = { ...existing, ...newItem };
              const result = await updateItem(existing.id, merged);
              if (result) {
                const idx = updated.findIndex(i => i.id === existing.id);
                updated[idx] = result;
              }
            } else {
              const created = await createItem(newItem);
              if (created) updated.push(created);
            }
          }
          setItems(updated);
        }
      };

  return (
    <div className="relative p-4">
      <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 pb-2">
        <Link
          to={`/${basePath}${filtroParam ? `?filtro=${encodeURIComponent(filtroParam)}` : ""}`}
          className="text-blue-500 hover:underline mb-2 inline-block"
        >
          ← Torna all'elenco {isChecklist ? "delle liste" : "degli inventari"}
        </Link>
        {inventory && (
          <>
            <h2 className="text-xl font-bold">
              {isChecklist ? "Lista: " : "Inventario: "}
              {inventory.name}
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              Creato da: {inventory.owner.username ? `${inventory.owner.username}` : "Sconosciuto"} | Data modifica:{" "}
              {new Date(inventory.data_mod).toLocaleString()}
            </p>
            <hr className="mb-2" />
          </>
        )}
      </div>

      {inventory ? (
        <div>
          <div className="sticky top-16 z-10 bg-white dark:bg-gray-900 mb-4 flex flex-wrap gap-2 items-center px-1 py-2 border-b">
            <label className="text-sm font-medium">Ordina per:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                const value = e.target.value as 'name' | 'date' | 'quantity';
                localStorage.setItem('item_sortBy', value);
                setSortBy(value);
              }}
              className="border rounded p-1"
            >
              <option value="date">Data modifica</option>
              <option value="name">Nome</option>
              <option value="quantity">Quantità</option>
            </select>
            <button
              onClick={() => {
                const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                localStorage.setItem('item_sortOrder', newOrder);
                setSortOrder(newOrder);
              }}
              className="border rounded p-1 px-2"
              title={`Ordina in ordine ${sortOrder === 'asc' ? 'decrescente' : 'crescente'}`}
            >
              {sortOrder === 'asc' ? '⬆️' : '⬇️'}
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filtra la lista..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setFilterText('');
                    }
                  }}
                  className="border rounded p-1 w-full sm:w-auto"
                />
                <button
                  onClick={() => {
                    setFilterText('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded"
                >
                  <span className="inline sm:hidden">❌</span>
                  <span className="hidden sm:inline">Cancella filtro</span>
                </button>
              </div>
            </div>
            {isEditMode && (
                <div className="mb-2 ml-auto flex gap-2">
                <button
                    onClick={() => setSelectedItems(sortedItems.map(item => item.id))}
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
          <ul className="mb-20">
            {sortedItems.map((item) => (
              <SwipeableItemRow
                key={item.id}
                item={item}
                isMobile={isMobile}
                isChecklist={isChecklist}
                isInventory={isInventory}
                user={user}
                isEditMode={isEditMode}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                setItemBeingEdited={setItemBeingEdited}
                updateItem={async (id, itemArg) =>
                  await updateItem(id, {
                    name: itemArg.name ?? "",
                    description: itemArg.description,
                    quantity: itemArg.quantity ?? 0,
                    inventory_id: itemArg.inventory_id ?? inventory?.id ?? 0,
                  })
                }
                deleteItem={deleteItem}
                setItems={setItems}
                setIsCloning={setIsCloning}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p>Caricamento {isChecklist ? "checklist" : "inventaro"}...</p>
      )}

      <div
        className={`z-40 gap-2 flex ${
          isMobile
            ? 'fixed bottom-2 right-2 flex-col'
            : 'fixed top-4 right-4 flex-row'
        }`}
      >
        {isEditMode && selectedItems.length > 0 && (
          <button
            onClick={async () => {
              if (!window.confirm("Sei sicuro di voler eliminare gli oggetti selezionati?")) return;
              for (const id of selectedItems) {
                await deleteItem(id);
              }
              setSelectedItems([]);
              setIsEditMode(false);
              const getItems = isInventory ? getInventoryItems : getChecklistItems;
              const refreshed = inventory && await getItems(inventory.id);
              if (refreshed) setItems(refreshed);
            }}
            className="py-2 px-4 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700"
          >
            <span className="inline md:hidden">🗑️ {( selectedItems.length )}</span>
            <span className="hidden md:inline">Elimina {( selectedItems.length )}</span>
          </button>
        )}
        {(isInventory || isChecklist) && user?.role.name !== 'viewer' && (
          <button
            onClick={() => {
              const now = new Date();
              const header = `${inventory?.name} (${now.toLocaleString()})`;
              const withQty = items.filter(i => i.quantity > 0).sort((a, b) => a.name.localeCompare(b.name));
              const zeroQty = items.filter(i => i.quantity === 0).sort((a, b) => a.name.localeCompare(b.name));
              const lines = [...withQty, ...zeroQty].map(i =>
                `- ${i.quantity}x ${i.name}${i.description ? ` (${i.description})` : ''}`
              );
              const text = encodeURIComponent([header, ...lines].join('\n'));
              //window.location.href = `https://wa.me/?text=${text}`;
              window.open(`https://wa.me/?text=${text}`, '_blank');
            }}
            className="py-2 px-4 bg-green-700 text-white rounded-full shadow-lg hover:bg-green-800"
          >
            <span className="inline md:hidden">📲</span>
            <span className="hidden md:inline">📲 WhatsApp</span>
          </button>
        )}
        {(isInventory || isChecklist) && user?.role.name === 'admin' && (
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="py-2 px-4 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700"
          >
            <span className="inline md:hidden">📤</span>
            <span className="hidden md:inline">Import/Export</span>
          </button>
        )}
        {(isInventory || isChecklist) && user?.role.name !== 'viewer' && (
          <>
            <button
              onClick={() => {
                setIsEditMode((prev) => !prev);
                setSelectedItems([]);
              }}
              className={`py-2 px-4 rounded-full shadow-lg text-white ${
                isEditMode ? "bg-yellow-700" : "bg-yellow-500 hover:bg-yellow-600"
              }`}
            >
              <span className="inline md:hidden">{isEditMode ? "✖️" : "✏️"}</span>
              <span className="hidden md:inline">{isEditMode ? "Chiudi" : "Modifica"}</span>
            </button>
            <button
              onClick={() => setisInsertMode(true)}
              className="py-2 px-4 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
            >
              <span className="inline md:hidden">➕</span>
              <span className="hidden md:inline">Nuovo</span>
            </button>
          </>
        )}
      </div>

      <Dialog open={isInsertMode} onClose={() => setisInsertMode(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-900 dark:text-white p-6 rounded w-full max-w-md">
            <Dialog.Title className="text-lg font-semibold mb-4">Nuovo oggetto</Dialog.Title>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!inventory) return;
                const newItem = await createItem({
                  name: newItemName,
                  description: newItemDescription,
                  quantity: newItemQuantity,
                  inventory_id: inventory.id
                });
                if (newItem) {
                  const getItems = isInventory ? getInventoryItems : getChecklistItems;
                  const refreshed = inventory && await getItems(inventory.id);
                  if (refreshed) setItems(refreshed);
                  setNewItemName("");
                  setNewItemDescription("");
                  setNewItemQuantity(isChecklist ? 0 : 1);
                  setisInsertMode(false);
                }
              }}
            >
              <div className="mb-2">
                <label className="block text-sm font-medium">Nome</label>
                <input type="text" className="w-full border rounded p-1" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium">Descrizione</label>
                <input type="text" className="w-full border rounded p-1" value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} />
              </div>
              {isInventory && (
                <div className="mb-4">
                  <label className="block text-sm font-medium">Quantità</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewItemQuantity((prev) => Math.max(0, prev - 1))}
                      className="px-3 py-2 bg-gray-400 rounded hover:bg-gray-600 text-xl leading-none"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      className="w-16 border rounded p-2 text-center"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(Math.max(0, Number(e.target.value)))}
                    />
                    <button
                      type="button"
                      onClick={() => setNewItemQuantity((prev) => prev + 1)}
                      className="px-3 py-2 bg-gray-400 rounded hover:bg-gray-600 text-xl leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              {isChecklist && (
                <div className="mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newItemQuantity > 0}
                      onChange={(e) => setNewItemQuantity(e.target.checked ? 1 : 0)}
                    />
                    Elemento completato
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setisInsertMode(false)}
                  className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600"
                >
                  Chiudi
                </button>
                <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Aggiungi
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      <Dialog open={!!itemBeingEdited} onClose={() => setItemBeingEdited(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-900 dark:text-white p-6 rounded w-full max-w-md">
            <Dialog.Title className="text-lg font-semibold mb-4">Modifica oggetto</Dialog.Title>
            {itemBeingEdited && (
              <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isCloning) {
                  if (!inventory) return;
                  const newItem = await createItem({
                    name: itemBeingEdited.name,
                    description: itemBeingEdited.description ?? "",
                    quantity: itemBeingEdited.quantity,
                    inventory_id: inventory.id,
                  });
                  if (newItem) {
                    const getItems = isInventory ? getInventoryItems : getChecklistItems;
                    const refreshed = inventory && await getItems(inventory.id);
                    if (refreshed) setItems(refreshed);
                    setItemBeingEdited(null);
                    setIsCloning(false);
                  }
                } else {
                  const updated = await updateItem(itemBeingEdited.id, {
                    name: itemBeingEdited.name,
                    description: itemBeingEdited.description ?? "",
                    quantity: itemBeingEdited.quantity,
                    inventory_id: itemBeingEdited.inventory_id,
                  });
                  if (updated) {
                    setItems((prev) =>
                      prev.map((itm) => (itm.id === updated.id ? updated : itm))
                    );
                    setItemBeingEdited(null);
                  }
                }
              }}
              >
                <div className="mb-2">
                  <label className="block text-sm font-medium">Nome</label>
                  <input
                    type="text"
                    className="w-full border rounded p-1"
                    value={itemBeingEdited.name}
                    onChange={(e) =>
                      setItemBeingEdited({ ...itemBeingEdited, name: e.target.value })
                    }
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium">Descrizione</label>
                  <input
                    type="text"
                    className="w-full border rounded p-1"
                    value={itemBeingEdited.description || ""}
                    onChange={(e) =>
                      setItemBeingEdited({ ...itemBeingEdited, description: e.target.value })
                    }
                  />
                </div>
                {isInventory && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium">Quantità</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setItemBeingEdited((prev) =>
                            prev ? { ...prev, quantity: Math.max(0, prev.quantity - 1) } : prev
                          )
                        }
                        className="px-3 py-2 bg-gray-400 rounded hover:bg-gray-600 text-xl leading-none"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        className="w-16 border rounded p-2 text-center"
                        value={itemBeingEdited.quantity}
                        onChange={(e) =>
                          setItemBeingEdited({
                            ...itemBeingEdited,
                            quantity: Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setItemBeingEdited((prev) =>
                            prev ? { ...prev, quantity: prev.quantity + 1 } : prev
                          )
                        }
                        className="px-3 py-2 bg-gray-400 rounded hover:bg-gray-600 text-xl leading-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
                {isChecklist && (
                  <div className="mb-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={itemBeingEdited.quantity > 0}
                        onChange={(e) =>
                          setItemBeingEdited({
                            ...itemBeingEdited,
                            quantity: e.target.checked ? 1 : 0,
                          })
                        }
                      />
                      Elemento completato
                    </label>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setItemBeingEdited(null); setIsCloning(false); }}
                    className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600"
                  >
                    Chiudi
                  </button>
                  <button
                    type="submit"
                    className={`px-3 py-1 text-white rounded hover:opacity-90 ${isCloning ? "bg-yellow-500 hover:bg-yellow-600" : "bg-green-600 hover:bg-green-700"}`}
                  >
                    {isCloning ? "Clona" : "Salva modifiche"}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
      <Dialog open={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-900 dark:text-white p-6 rounded w-full max-w-lg space-y-4">
            <Dialog.Title className="text-lg font-semibold mb-2">Importa / Esporta CSV</Dialog.Title>
            <button
              onClick={() => {
                const csvContent = [
                  ['name', 'description', 'quantity'],
                  ...items.map(item => [item.name, item.description ?? '', item.quantity.toString()])
                ]
                  .map(e => e.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
                  .join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `${inventory?.name || 'inventory'}.csv`);
                link.click();
              }}
              className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Esporta in CSV
            </button>

            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Modalità importazione:</label>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                className="border rounded p-1"
              >
                <option value="merge">Unisci per nome</option>
                <option value="replace">Sostituisci completamente</option>
              </select>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                handleCSVImport(text);
                setIsShareModalOpen(false);
              }}
              className="w-full border rounded p-2"
            />

            <div>
              <textarea
                placeholder="Incolla qui il CSV"
                rows={4}
                className="w-full border rounded p-2"
                value={csvTextarea}
                onChange={(e) => setCsvTextarea(e.target.value)}
              />
              <button
                onClick={() => {
                  handleCSVImport(csvTextarea);
                  setCsvTextarea('');
                  setIsShareModalOpen(false);
                }}
                className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Importa da testo
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-3 py-1 bg-gray-400 rounded hover:bg-gray-600"
              >
                Chiudi
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
