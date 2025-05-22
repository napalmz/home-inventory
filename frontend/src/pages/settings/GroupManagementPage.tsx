import { useEffect, useState } from "react";
import { getAllGroups, createGroup, updateGroup, deleteGroup, getAllRoles, getUsers, addUserToGroup, removeUserFromGroup } from "../../api";

type Group = {
  id: number;
  name: string;
  users: (number | { id: number })[];
  role_id: number;
  role: { id: number; name: string };
};

type Role = {
  id: number;
  name: string;
};

export default function GroupManagementPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: number; username: string }[]>([]);

  useEffect(() => {
    fetchGroups();
    fetchRoles();
    getUsers().then(data => setAllUsers(data));
  }, []);

  const fetchGroups = async () => {
    const data = await getAllGroups() as Group[];
    //setGroups(data);
    setGroups(data.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const fetchRoles = async () => {
    const roles = await getAllRoles() as Role[];
    setAllRoles(roles);
  };

  const handleCreate = async () => {
    if (!newGroupName.trim() || selectedRoleId == null) return;
    await createGroup({ name: newGroupName.trim(), role_id: selectedRoleId });
    setNewGroupName("");
    setSelectedRoleId(null);
    fetchGroups();
  };

  const handleUpdate = async (id: number) => {
    if (!selectedGroup) return;
    console.log("Aggiorno gruppo:", selectedGroup);
    await updateGroup(id, {
      name: selectedGroup.name,
      role_id: Number(selectedGroup.role_id),
      users: selectedGroup.users.map((u: number | { id: number }) => typeof u === "object" ? u.id : u),
    });
    setSelectedGroup(null);
    fetchGroups();
  };

  const handleDelete = async (id: number) => {
    await deleteGroup(id);
    fetchGroups();
  };

  const closeAllModals = () => {
    setIsUserModalOpen(false);
    setIsCreateModalOpen(false);
    setSelectedGroup(null);
  };

  return (
    <div className="space-y-4 overflow-x-auto px-2 sm:px-4">
      <h2 className="text-lg font-semibold">Gestione Gruppi</h2>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <div className="flex flex-wrap gap-2">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={selectedRoleId ?? ""}
          onChange={(e) => setSelectedRoleId(Number(e.target.value))}
        >
          <option value="">-- Filtra per Ruolo --</option>
          {allRoles.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Nuovo gruppo
        </button>
      </div>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border px-4 py-2">Nome gruppo</th>
            <th className="border px-4 py-2">Ruolo</th>
            <th className="border px-6 py-2 w-full">Utenti associati</th>
            <th className="border px-2 py-2">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td className="border px-4 py-2">{group.name}</td>
              <td className="border px-4 py-2">{group.role.name}</td>
              <td className="border px-6 py-2 break-words w-full">
              {group.users
                  .map((u: number | { id: number }) => {
                    const userId = typeof u === "object" ? u.id : u;
                    const user = allUsers.find(usr => usr.id === userId);
                    return user?.username || `ID ${userId}`;
                  })
                  .join(", ")}
              </td>
              <td className="border px-2 py-2 whitespace-nowrap text-right">
                <button
                  className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={() => {
                    setSelectedGroup({
                      ...group,
                      role_id: group.role.id,
                      users: group.users.map((u: number | { id: number }) => typeof u === "object" ? u.id : u),
                    });
                    setIsUserModalOpen(true);
                }}>
                  Gestisci Utenti
                </button>
                <button
                  className="ml-2 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => {
                    setSelectedGroup({
                      ...group,
                      role_id: group.role.id,
                      users: group.users.map((u: number | { id: number }) => typeof u === "object" ? u.id : u),
                    });
                  }}
                >
                  Modifica
                </button>
                <button
                  className="ml-2 px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  onClick={() => {
                    if (window.confirm(`Sei sicuro di voler eliminare il gruppo "${group.name}"?`)) {
                      handleDelete(group.id);
                    }
                  }}
                >
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Nuovo gruppo
        </button>
      </div>
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-gray-900 p-6 rounded shadow-md w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Crea nuovo gruppo</h3>
            <input
              type="text"
              placeholder="Nome gruppo"
              className="w-full border rounded px-2 py-1 text-sm"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={selectedRoleId ?? ""}
              onChange={(e) => setSelectedRoleId(Number(e.target.value))}
            >
              <option value="">-- Seleziona ruolo --</option>
              {allRoles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeAllModals}
                className="px-3 py-1 text-sm bg-gray-300 rounded hover:bg-gray-400"
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  if (!newGroupName.trim() || selectedRoleId == null) {
                    alert("Tutti i campi sono obbligatori.");
                    return;
                  }
                  await handleCreate();
                  setIsCreateModalOpen(false);
                }}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Crea
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedGroup && !isUserModalOpen && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white dark:bg-gray-900 p-6 rounded shadow-md w-full max-w-md space-y-4">
              <h3 className="text-lg font-semibold">Modifica gruppo</h3>
              <input
                type="text"
                value={selectedGroup.name}
                onChange={(e) =>
                  setSelectedGroup({ ...selectedGroup, name: e.target.value })
                }
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={selectedGroup.role_id}
                onChange={(e) =>
                  setSelectedGroup({
                    ...selectedGroup,
                    role_id: Number(e.target.value),
                  })
                }
              >
                {allRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end mt-4">
                <div className="flex gap-2">
                  <button
                    onClick={closeAllModals}
                    className="px-3 py-1 text-sm bg-gray-300 rounded hover:bg-gray-400"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => handleUpdate(selectedGroup.id)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Salva
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {isUserModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-gray-900 p-6 rounded shadow-md w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Utenti associati a {selectedGroup.name}</h3>
            <ul className="space-y-1 max-h-40 overflow-y-auto border rounded p-2 text-sm">
              {selectedGroup.users.map(uid => {
                const user = allUsers.find(u => u.id === (typeof uid === "object" ? uid.id : uid));
                return (
                  <li key={typeof uid === "object" ? uid.id : uid} className="flex justify-between items-center">
                    <span>{user?.username ?? `ID ${uid}`}</span>
                    <button
                      className="text-red-600 text-xs hover:underline"
                      onClick={async () => {
                        await removeUserFromGroup((selectedGroup as Group).id, typeof uid === "object" ? uid.id : uid);
                        setSelectedGroup(prev =>
                          prev ? { ...prev, users: prev.users.filter(id => id !== uid) } : null
                        );
                        fetchGroups();
                      }}
                    >
                      Rimuovi
                    </button>
                  </li>
                );
              })}
            </ul>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              onChange={async (e) => {
                const newId = Number(e.target.value);
                if (newId && !selectedGroup.users.map(u => typeof u === "object" ? u.id : u).includes(newId)) {
                  await addUserToGroup((selectedGroup as Group).id, newId);
                  setSelectedGroup(prev =>
                    prev ? { ...prev, users: [...prev.users, newId] } : null
                  );
                  fetchGroups();
                }
              }}
            >
              <option value="">-- Aggiungi utente --</option>
              {allUsers
                .filter(u => !selectedGroup.users.map(u => typeof u === "object" ? u.id : u).includes(u.id))
                .map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => {
                  handleUpdate(selectedGroup.id);
                  setIsUserModalOpen(false);
                  setSelectedGroup(null);
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}