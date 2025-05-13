import axios from 'axios';
import {
  User,
  Role,
  Inventory,
  InventoryItem,
  InventoryWithMatches,
  Checklist,
  ChecklistItem,
  ChecklistWithMatches
} from "./types";

let api: ReturnType<typeof axios.create>;

function getApiBaseUrl() {
  //console.error("VITE_BACKEND_BASE_URL:", window.APP_CONFIG?.VITE_BACKEND_BASE_URL);
  //return window.APP_CONFIG?.VITE_BACKEND_BASE_URL ?? 'http://localhost:8001';
  return '/api';
}

export function createApiInstance() {
  api = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: false,
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

export { api };

/* LOGIN UTENTI */
export async function loginUser(username: string, password: string): Promise<{ access_token: string }> {
  const response = await api.post(
    "/auth/login",
    new URLSearchParams({ username, password }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )
  return response.data as { access_token: string }
}

/* REGISTRAZIONE UTENTI */
export async function registerUser(username: string, password: string, email: string): Promise<void> {
  await api.post("/auth/register", {
    username,
    password,
    email
  });
}

/* RECUPERO DATI UTENTE */
export async function getUserInfo() {
  const response = await api.get("/auth/me");
  return response.data;
}

/* RECUPERO LISTA UTENTI */
export async function getUsers(): Promise<User[]> {
  const response = await api.get<User[]>("/user/users/");
  return response.data;
}

/* RECUPERO VERSIONE API */
export async function getApiVersion(): Promise<{ version: string }> {
  const response = await api.get<{ version: string }>("/system/version");
  return response.data;
}

/* EFFETTUA LOGOUT */
export async function logoutApi() {
  await api.post("/auth/logout")
}

/* AGGIORNAMENTO DATI UTENTE */
export async function updateMe(email: string, password: string): Promise<void> {
  await api.put("/auth/me", {
    email,
    password
  });
}

/* LISTING RUOLI */
export async function getRoles(): Promise<Role[]> {
  const response = await api.get("/user/roles/");
  if (Array.isArray(response.data)) {
    return response.data;
  } else {
    console.error("Formato ruoli non valido:", response.data);
    return [];
  }
}

/* CREAZIONE, AGGIORNAMENTO E CANCELLAZIONE UTENTI */
export const createUser = async (data: {
  username: string;
  email: string;
  password: string;
  roleId: number;
}) => {
  const payload = {
    username: data.username,
    email: data.email,
    password: data.password,
    role_id: data.roleId,
  };
  const response = await api.post("/user/users/", payload);
  return response.data;
};

export const updateUser = async (
  id: number,
  data: {
    username: string;
    email: string;
    password?: string;
    is_blocked: boolean;
    role_id: number;
}) => {
  const response = await api.put(`/user/users/${id}`, data);
  return response.data;
};

export const deleteUser = async (id: number) => {
  const response = await api.delete(`/user/users/${id}`);
  return response.data;
};

/* PAGINA DI WELCOME */
export async function getApiWelcomeInfo(): Promise<{
  title: string;
  message: string;
  stats: {
    total_inventories: number;
    total_items: number;
    total_users: number;
  };
}> {
  const response = await api.get('/');
  return response.data as {
    title: string;
    message: string;
    stats: {
      total_inventories: number;
      total_items: number;
      total_users: number;
    };
  };
}

/* REPERIMENTO LISTA IMPOSTAZIONI */
export async function getAllSettings(): Promise<{ key: string; value: string; protected: boolean }[]> {
  const response = await api.get('/settings/settings');
  return response.data as { key: string; value: string; protected: boolean }[];
}

/* CREAZIONE, AGGIORNAMENTO E CANCELLAZIONE IMPOSTAZIONI */
export async function getSetting(key: string): Promise<{ key: string; value: string; protected: boolean }> {
  const response = await api.get(`/settings/settings/${key}`);
  return response.data as { key: string; value: string; protected: boolean };
}

/* AGGIORNAMENTO IMPOSTAZIONI */
export async function setSetting(key: string, value: string): Promise<{ key: string; value: string; protected: boolean }> {
  const response = await api.post(`/settings/settings`, {
    key,
    value,
  });
  return response.data as { key: string; value: string; protected: boolean };
}

/* CANCELLAZIONE IMPOSTAZIONI */
export async function deleteSetting(key: string): Promise<void> {
  await api.delete(`/settings/settings/${key}`);
}

/* CREAZIONE INVENTARIO */
export async function createInventory(name: string): Promise<Inventory> {
  const response = await api.post('/inventory/', { name });
  return response.data as Inventory;
}

/* CANCELLAZIONE INVENTARIO */
export async function deleteInventory(id: number) {
  await api.delete(`/inventory/${id}`);
}

/* LISTA INVENTARI con filtro opzionale */
export async function getInventories(filtro?: string): Promise<(InventoryWithMatches)[]> {
  const response = await api.get('/inventory/', {
    params: filtro ? { filtro } : {},
  });
  return response.data as (InventoryWithMatches)[];
}

/* RECUPERO INVENTARIO PER ID */
export async function getInventoryById(id: number): Promise<Inventory> {
  const response = await api.get(`/inventory/${id}`);
  return response.data as Inventory;
}

/* RECUPERO ELENCO ITEM PER ID INVENTARIO */
export async function getInventoryItems(id: number): Promise<InventoryItem[]> {
  const response = await api.get(`/inventory/item/${id}/`);
  return response.data as InventoryItem[];
}

/* CREAZIONE CHECKLIST */
export async function createChecklist(name: string): Promise<Checklist> {
  const response = await api.post('/checklist/', { name });
  return response.data as Checklist;
}

/* CANCELLAZIONE CHECKLIST */
export async function deleteChecklist(id: number) {
  await api.delete(`/checklist/${id}`);
}

/* LISTA CHECKLISTS con filtro opzionale */
export async function getChecklists(filtro?: string): Promise<(ChecklistWithMatches)[]> {
  const response = await api.get('/checklist/', {
    params: filtro ? { filtro } : {},
  });
  return response.data as (ChecklistWithMatches)[];
}

/* RECUPERO CHECKLIST PER ID */
export async function getChecklistById(id: number): Promise<Checklist> {
  const response = await api.get(`/checklist/${id}`);
  return response.data as Checklist;
}

/* RECUPERO ELENCO ITEM PER ID CHECKLIST */
export async function getChecklistItems(id: number): Promise<ChecklistItem[]> {
  const response = await api.get(`/checklist/item/${id}/`);
  return response.data as ChecklistItem[];
}

/* CREAZIONE ITEM */
export async function createItem(data: {
  name: string;
  description?: string;
  quantity: number;
  inventory_id: number;
}): Promise<InventoryItem> {
  const response = await api.post('/item/', data);
  return response.data as InventoryItem;
}

/* MODIFICA ITEM */
export async function updateItem(itemId: number, data: {
  name: string;
  description?: string;
  quantity: number;
  inventory_id: number;
}): Promise<InventoryItem> {
  const response = await api.patch(`/item/${itemId}`, data);
  return response.data as InventoryItem;
}

/* CANCELLAZIONE ITEM */
export async function deleteItem(itemId: number): Promise<void> {
  await api.request({
    url: `/item/${itemId}`,
    method: 'DELETE',
    data: { confirm: true }
  });
}

// === UTENTI ===
export async function getSharableUsers(inventoryId: number) {
  const res = await api.get(`/user/users/shareable/${inventoryId}`);
  return res.data;
}

export async function shareInventoryWithUser(inventoryId: number, username: string) {
  return api.post(`/inventory/share/${inventoryId}/${username}`);
}

export async function unshareInventoryWithUser(inventoryId: number, username: string) {
  return api.delete(`/inventory/share/${inventoryId}/${username}`);
}

export async function shareChecklistWithUser(inventoryId: number, username: string) {
  return api.post(`/checklist/share/${inventoryId}/${username}`);
}

export async function unshareChecklistWithUser(inventoryId: number, username: string) {
  return api.delete(`/checklist/share/${inventoryId}/${username}`);
}

// === GRUPPI ===
export async function getAllGroups() {
  const res = await api.get('/user/groups/');
  return res.data;
}

export async function shareInventoryWithGroup(inventoryId: number, groupId: number) {
  return api.post(`/inventory/share_group/${inventoryId}/${groupId}`);
}

export async function unshareInventoryFromGroup(inventoryId: number, groupId: number) {
  return api.delete(`/inventory/share_group/${inventoryId}/${groupId}`);
}

export async function shareChecklistWithGroup(inventoryId: number, groupId: number) {
  return api.post(`/checklist/share_group/${inventoryId}/${groupId}`);
}

export async function unshareChecklistFromGroup(inventoryId: number, groupId: number) {
  return api.delete(`/checklist/share_group/${inventoryId}/${groupId}`);
}

export async function createGroup(data: { name: string; role_id: number }) {
  const res = await api.post('/user/groups/', data);
  return res.data;
}

export async function updateGroup(groupId: number, data: { name: string; role_id: number; users?: number[] }) {
  const res = await api.put(`/user/groups/${groupId}`, data);
  return res.data;
}

export async function deleteGroup(groupId: number) {
  const res = await api.delete(`/user/groups/${groupId}`);
  return res.data;
}

// === DETTAGLI ACCESSO ===
export async function getInventoryAccessDetails(inventoryId: number) {
  const res = await api.get(`/inventory/access_details/${inventoryId}`);
  return res.data;
}

export async function getInventoryUserShares(inventoryId: number) {
  const response = await api.get(`/inventory/share/${inventoryId}`);
  return response.data;
}

export async function getInventoryGroupShares(inventoryId: number) {
  const response = await api.get(`/inventory/share_group/${inventoryId}`);
  return response.data;
}
export async function getChecklistAccessDetails(inventoryId: number) {
  const res = await api.get(`/checklist/access_details/${inventoryId}`);
  return res.data;
}

export async function getChecklistUserShares(inventoryId: number) {
  const response = await api.get(`/checklist/share/${inventoryId}`);
  return response.data;
}

export async function getChecklistGroupShares(inventoryId: number) {
  const response = await api.get(`/checklist/share_group/${inventoryId}`);
  return response.data;
}

export async function updateInventoryName(inventoryId: number, name: string): Promise<void> {
  await api.patch(`/inventory/${inventoryId}`, { name });
}
export async function updateChecklistName(inventoryId: number, name: string): Promise<void> {
  await api.patch(`/checklist/${inventoryId}`, { name });
}

export async function getAllRoles() {
  const res = await api.get('/user/roles/');
  return res.data;
}

// === GESTIONE UTENTI NEI GRUPPI ===
export async function addUserToGroup(groupId: number, userId: number) {
  const res = await api.post(`/user/groups/${groupId}/add_user/${userId}`);
  return res.data;
}

export async function removeUserFromGroup(groupId: number, userId: number) {
  const res = await api.delete(`/user/groups/${groupId}/remove_user/${userId}`);
  return res.data;
}

// Elenco dei backup disponibili
export async function listBackups() {
  const res = await api.get('/backup/');
  return res.data;
}

// Creazione di un nuovo backup
export async function createBackup() {
  const res = await api.post(`/backup/create`);
  return res.data;
}

// Download di un backup esistente
export async function downloadBackup(filename: string): Promise<void> {
  const response = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
    responseType: 'blob'
  });
  
  const blob = new Blob([response.data as Blob]);
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  
  window.URL.revokeObjectURL(url);
}

// Ripristino di un backup esistente
export async function restoreBackup(filename: string): Promise<void> {
  await api.request({
    url: `/backup/restore/${encodeURIComponent(filename)}`,
    method: 'POST',
    data: true
  });
}

// Cancellazione di un backup esistente
export async function deleteBackup(filename: string): Promise<void> {
  await api.request({
    url: `/backup/delete/${encodeURIComponent(filename)}`,
    method: 'DELETE',
    data: true
  });
}

// Upload di un backup esistente
export async function uploadBackup(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);

  await api.post('/backup/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

// === BACKUP SCHEDULAZIONI ===
export async function getBackupSchedule(): Promise<{
  frequency: string;
  interval_days?: number;
  interval_hours?: number;
  interval_minutes?: number;
  retention: number;
}> {
  const res = await api.get<Record<string, { value: string }>>('/backup/schedule');
  return {
    frequency: res.data.BACKUP_FREQUENCY.value,
    interval_days: parseInt(res.data.BACKUP_INTERVAL_DAYS.value),
    interval_hours: parseInt(res.data.BACKUP_INTERVAL_HOURS.value),
    interval_minutes: parseInt(res.data.BACKUP_INTERVAL_MINUTES.value),
    retention: parseInt(res.data.BACKUP_RETENTION.value),
  };
}

export async function updateBackupSchedule(data: {
  frequency: string;
  interval_days?: number;
  interval_hours?: number;
  interval_minutes?: number;
  retention: number;
}): Promise<void> {
  await api.post('/backup/schedule', {
    backup_frequency: data.frequency,
    backup_int_days: data.interval_days ?? 0,
    backup_int_hours: data.interval_hours ?? 0,
    backup_int_minutes: data.interval_minutes ?? 0,
    backup_retention: data.retention
  });
}

export async function triggerScheduledBackup(): Promise<void> {
  await api.post('/backup/schedule/trigger');
}