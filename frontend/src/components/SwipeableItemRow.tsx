// src/components/SwipeableItemRow.tsx
import { useSwipeable } from 'react-swipeable';
import { useRef, useEffect, useState } from 'react';
import { Item, User } from '../types';

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
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
}

export default function SwipeableItemRow({
  item, isMobile, isChecklist, isInventory, user,
  isEditMode, selectedItems, setSelectedItems, setItemBeingEdited,
  updateItem, deleteItem, setItems,
}: Props) {
  const [action, setAction] = useState<'left' | 'right' | null>(null);

  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        rowRef.current &&
        !rowRef.current.contains(target) &&
        !target.closest('.swipe-button')
      ) {
        setAction(null);
      }
    };
    if (action) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [action]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setAction('left'),
    onSwipedRight: () => setAction('right'),
    onTap: () => setAction(null),
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
  };

  // Combine refs for swipeHandlers and rowRef to avoid duplicate ref assignment
  const combinedRef = (el: HTMLDivElement | null) => {
    rowRef.current = el;
    if (isMobile && swipeHandlers.ref) {
      swipeHandlers.ref(el);
    }
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
            className="swipe-button absolute transition-transform duration-300 ease-in-out transform translate-x-0 right-1/4 top-0 h-full w-1/4 bg-yellow-500 text-white font-bold z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAction(null);
              cloneItem();
            }}
          >
            📄
          </button>
          <button
            className="swipe-button absolute transition-transform duration-300 ease-in-out transform translate-x-0 right-0 top-0 h-full w-1/4 bg-blue-600 text-white font-bold z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAction(null);
              setItemBeingEdited(item);
            }}
          >
            ✏️
          </button>
        </>
      )}
      {(action === 'right') && !isViewer && (
        <button
          className="swipe-button absolute transition-transform duration-300 ease-in-out transform translate-x-0 left-0 top-0 h-full w-1/4 bg-red-600 text-white font-bold z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAction(null);
            if (confirm("Vuoi eliminare questo elemento?")) {
              deleteItem(item.id).then(() => {
                setItems(prev => prev.filter(i => i.id !== item.id));
              });
            }
          }}
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
              <button
                className="px-2 py-1 bg-gray-300 rounded text-sm"
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
                className="px-2 py-1 bg-gray-300 rounded text-sm"
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