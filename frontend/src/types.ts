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
}