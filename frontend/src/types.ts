export interface Role {
    id: number;
    name: string;
}
  
export interface User {
    id: number;
    username: string;
    email_masked: string;
    email: string;
    role: Role;
    is_blocked: boolean;
    data_ins: string;
    data_mod: string;
}

export interface Inventory {
    id: number;
    name: string;
    owner: User;
    item_count: number;
    data_ins: string;
    data_mod: string;
    user_ins: number | null;
    user_mod: number | null;
    version_num: number;
}

export interface InventoryItem {
    id: number;
    name: string;
    description: string;
    quantity: number;
    inventory_id: number;
    user_ins: number;
    user_mod: number | null;
    username_ins: string;
    username_mod: string | null;
    data_ins: string;
    data_mod: string;
    version_num: number;
}

export interface Checklist {
    id: number;
    name: string;
    owner: User;
    item_count: number;
    data_ins: string;
    data_mod: string;
    user_ins: number | null;
    user_mod: number | null;
    version_num: number;
}

export interface ChecklistItem {
    id: number;
    name: string;
    description: string;
    quantity: number;
    inventory_id: number;
    user_ins: number;
    user_mod: number | null;
    username_ins: string;
    username_mod: string | null;
    data_ins: string;
    data_mod: string;
    version_num: number;
}

export interface Item {
    id: number;
    name: string;
    description: string;
    quantity: number;
    inventory_id: number;
    user_ins: number;
    user_mod: number | null;
    username_mod: string | null;
    data_ins: string;
    data_mod: string;
    version_num: number;
}

export interface ItemVersion {
    id: number;
    item_id: number;
    inventory_id: number;
    name: string;
    description: string | null;
    quantity: number | null;
    version_num: number;
    operation: "CREATE" | "UPDATE" | "DELETE";
    changed_at: string;
    changed_by_id: number | null;
    changed_by_username: string | null;
    diff: string | null;
}

export interface InventoryVersion {
    id: number;
    inventory_id: number;
    name: string;
    type: string;
    owner_id: number | null;
    owner_username: string | null;
    version_num: number;
    operation: "CREATE" | "UPDATE" | "DELETE";
    changed_at: string;
    changed_by_id: number | null;
    changed_by_username: string | null;
    diff: string | null;
}

export interface InventoryWithMatches extends Inventory {
    matching_items?: (Item & {
      highlighted?: {
        name: string;
        description?: string | null;
      };
    })[];
}

export interface ChecklistWithMatches extends Checklist {
    matching_items?: (Item & {
      highlighted?: {
        name: string;
        description?: string | null;
      };
    })[];
}