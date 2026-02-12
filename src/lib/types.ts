export interface TokenPayload {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  email: string;
  phone: string;
  app_metadata: {
    provider: string;
    providers: string[];
  };
  user_metadata: {};
  role: string;
  aal: string;
  amr: {
    method: string;
    timestamp: number;
  };
  session_id: string;
  client_id: string;
}

// Database types
export interface User {
  id: number;
  auth_uuid: string;
  created_at: string;
  email: string;
  role: string;
}

export interface Wallet {
  user_id: number;
  balance: number;
  total_earned: number;
  updated_at: string;
}

export interface Server {
  id: number;
  user_id: number;
  plan_id: number;
  ptero_server_id: string;
  name: string;
  status: string;
  expires_at: string;
  deleted: boolean;
  created_at: string;
}

export interface Plan {
  id: number;
  software_id: number | null;
  name: string;
  ram: number;
  cpu: number;
  disk: number;
  price: number;
  active: boolean;
}

export interface Software {
  id: number;
  name: string;
  slug: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  type: string;
  reference_id: number | null;
  created_at: string;
}

// API Input/Output types
export interface DeployServerInput {
  planId: number;
  name: string;
  softwareId: number;
  locationId: number;
}

export interface PowerActionInput {
  action: "start" | "stop" | "restart" | "kill";
}

export interface DeleteServerInput {
  reason?: string;
}

// API Response types
export interface ServerListItem {
  id: number;
  name: string;
  status: string;
  expires_at: string;
}

export interface ServerDetails extends ServerListItem {
  plan: Plan;
  ip?: string;
  port?: number;
  resources?: {
    memory_bytes: number;
    cpu_absolute: number;
    disk_bytes: number;
    uptime: number;
    current_state: string;
  };
}

export interface PterodactylServerDetails {
  identifier: string;
  uuid: string;
  name: string;
  description: string;
  status: string | null;
  is_suspended: boolean;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
  };
  relationships: {
    allocations: {
      data: {
        attributes: {
          id: number;
          ip: string;
          port: number;
          is_default: boolean;
        };
      }[];
    };
  };
}

export interface PterodactylResourceUsage {
  current_state: string;
  is_suspended: boolean;
  resources: {
    memory_bytes: number;
    cpu_absolute: number;
    disk_bytes: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime: number;
  };
}

export interface CreateServerOptions {
  name: string;
  userId: number; // Pterodactyl user ID
  eggId: number;
  nestId: number;
  locationId: number;
  ram: number; // MB
  cpu: number; // %
  disk: number; // MB
  startup?: string;
  environment?: Record<string, string>;
  dockerImage?: string;
}

// Store types
export interface StoreItem {
  id: number;
  name: string;
  type: string;
  price: number;
  config: Record<string, any>;
  active: boolean;
}

export interface PurchaseInput {
  itemId: number;
  serverId?: number;
}
