# Backend Architecture & API Specification
## Project: QeinTech Platform (Headless API)

**Base URL:** `https://api.qeintech.in/v1` <br>
**Framework:** Next.js 14 (Route Handlers) <br>
**Auth:** Supabase JWT (Bearer Token) <br>
**Architecture:** Headless (Frontend is separate) <br>

---

### 1. 🗄️ Database Structure (Supabase)

We use **PostgreSQL Schemas** to strictly separate "Hosting Logic" from "Money Logic". This prevents accidental data leaks and keeps the system organized.

#### 📂 Schema: `hosting` (Core Infrastructure)
* **`softwares`**: Categories (Minecraft, Bot, Database).
* **`software_engines`**: Specific versions (Paper 1.20, Python 3.11).
* **`plans`**: Products with resource limits (RAM, CPU) and Pterodactyl Egg IDs.
* **`blueprints`**: Pre-configured setup recipes (Bedwars Bundle).
* **`servers`**: The active user instances. Links `user_id` -> `plan_id` -> `ptero_id`.
* **`locations`**: Nodes and regions (India, USA).
* **`api_keys`**: Hashed keys for external Bots/Agents.
* **`config`**: Global settings (Maintenance Mode, Allowed IPs).

#### 📂 Schema: `hosting_billing` (The Economy)
* **`wallets`**: Stores `coins` (Free) and `credits` (Paid) for each user.
* **`transactions`**: Immutable ledger of every movement.
* **`invoices`**: PDF links and payment metadata for real-money transactions.
* **`coupons`**: Promo codes for marketing.

---

### 2. 🛡️ Roles & Permissions

We use a **`resource.action`** syntax.
* **Implicit Access:** Users **always** have full access to their *own* resources (`self`).
* **Admin/Support:** Require specific scopes to access *others'* data.

| Scope | Description |
| :--- | :--- |
| **`server.read`** | View basic server info (IP, Port, Status). |
| **`server.details`** | View sensitive info (Startup command, Variables). |
| **`control.power`** | Send Start/Stop/Restart signals. |
| **`control.console`** | Access Websocket stream. |
| **`file.write`** | Create, Upload, Edit, or Rename files. |
| **`billing.read`** | View invoices and credit history. |
| **`billing.write`** | Manage payment methods and balances. |
| **`admin.access`** | Global admin access (Bypass all checks). |

---

### 3. 🟢 Category: Authentication & Security

*Routes for login, session management, and access control.*

| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/auth/sync` | Public | **Sync User.** Checks Central Auth token. Creates DB row if new. |
| **GET** | `/auth/me` | Public | **Session.** Returns Profile, Role, and **Dual Wallet Balance**. |
| **POST** | `/auth/logout` | Public | Invalidates session cookie. |
| **GET** | `/security/access-rules` | `admin.access` | **Whitelist/Blocklist.** List all blocked IPs/Countries. |
| **POST** | `/security/access-rules` | `admin.access` | **Add Rule.** Body: `{ type: "country", value: "RU", action: "block" }`. |
| **DELETE**| `/security/access-rules/:id`| `admin.access` | Remove a block rule. |

---

### 4. 🔵 Category: Economy & Billing

*Managing Coins (Free) and Credits (Paid).*

| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/economy/wallet` | Owner | Fetch balances `{ coins: 500, credits: 20.00 }`. |
| **GET** | `/economy/transactions` | Owner | Fetch history log (Coin earnings & Credit spends). |
| **POST** | `/economy/earn/daily` | Owner | Claims the 24h daily reward (Coins). |
| **POST** | `/economy/earn/referral` | Owner | Claim referral rewards. |
| **POST** | `/billing/top-up` | Owner | **Add Credits.** Body: `{ amount: 10, gateway: "stripe" }`. |
| **POST** | `/billing/webhook/:gateway`| Public | **Callback.** Verifies payment & adds Credits. |
| **GET** | `/billing/invoices` | Owner | List PDF invoices for purchases. |
| **POST** | `/billing/convert` | Owner | (Optional) Convert Credits -> Coins. |

---

### 5. 🟠 Category: Server Management (Pterodactyl Bridge)

#### 🛒 Provisioning (The "Buy" Action)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/catalog/plans` | Public | List Plans. Includes `currency_type` ('coins' or 'credits'). |
| **GET** | `/catalog/blueprints` | Public | List pre-made setups. |
| **POST** | `/servers/deploy` | Owner | **Create Server.** <br>1. Check Plan Currency.<br>2. Check Balance.<br>3. Deduct.<br>4. Provision on Pterodactyl. |
| **POST** | `/servers/:id/renew` | Owner | **Extend Life.** Charges the appropriate currency based on the plan. |
| **POST** | `/servers/:id/upgrade` | Owner | Switch Plan (e.g., Free -> Premium). Calculates pro-rated Credit cost. |

#### ⚡ Power & Console
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/servers` | Owner | List all owned servers. |
| **GET** | `/servers/:id` | Owner | Get basic details (IP, Port, Limits). |
| **GET** | `/servers/:id/resources` | Owner | Live stats (CPU%, RAM Usage). |
| **POST** | `/servers/:id/power` | Owner | Body: `{ signal: "start" \| "stop" \| "restart" \| "kill" }`. |
| **POST** | `/servers/:id/command` | Owner | Send command to console. |
| **GET** | `/servers/:id/websocket` | Owner | Returns websocket token & URL. |

#### 📂 File Manager (Full Client API)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/servers/:id/files/list` | Owner | List directory contents. |
| **GET** | `/servers/:id/files/content` | Owner | Read file content. |
| **GET** | `/servers/:id/files/download`| Owner | Get one-time download URL. |
| **POST** | `/servers/:id/files/rename` | Owner | Rename a file/folder. |
| **POST** | `/servers/:id/files/write` | Owner | Save content to file. |
| **POST** | `/servers/:id/files/delete` | Owner | Delete files. |
| **POST** | `/servers/:id/files/compress`| Owner | Zip files. |
| **POST** | `/servers/:id/files/decompress`| Owner | Unzip archive. |
| **POST** | `/servers/:id/files/copy` | Owner | Duplicate a file. |
| **POST** | `/servers/:id/files/create-dir`| Owner | Create a new folder. |
| **GET** | `/servers/:id/files/upload` | Owner | Get signed upload URL. |
| **POST** | `/servers/:id/files/pull` | Owner | **Remote Download.** Pull file from URL to server. |

#### 📦 Backups & Network
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/servers/:id/backups` | Owner | List all backups. |
| **POST** | `/servers/:id/backups` | Owner | **Create Backup.** |
| **POST** | `/servers/:id/backups/:uuid/restore`| Owner | Restore a backup. |
| **DELETE**| `/servers/:id/backups/:uuid` | Owner | Delete a backup. |
| **GET** | `/servers/:id/network` | Owner | List allocated ports. |
| **POST** | `/servers/:id/network/allocations`| Owner | **Auto-Assign Port.** (May cost Credits). |
| **POST** | `/servers/:id/network/primary` | Owner | Set primary connection port. |
| **DELETE**| `/servers/:id/network/:id` | Owner | Release/Delete an allocation. |

#### ⚙️ Startup & Settings
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/servers/:id/startup` | Owner | View variables. |
| **POST** | `/servers/:id/startup` | Owner | Update variables (e.g. `SERVER_JAR`). |
| **POST** | `/servers/:id/settings/rename` | Owner | Rename server on dashboard. |
| **POST** | `/servers/:id/settings/reinstall`| Owner | **Reinstall Server.** (Wipes data). |
| **POST** | `/servers/:id/settings/docker-image`| Owner | Change Docker Image. |

#### 👥 Users (Collaboration)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/servers/:id/users` | Owner | List sub-users. |
| **POST** | `/servers/:id/users` | Owner | **Invite User.** Body: `{ email: "...", permissions: ["control.start"] }`. |
| **PUT** | `/servers/:id/users/:uuid` | Owner | Update permissions. |
| **DELETE**| `/servers/:id/users/:uuid` | Owner | Remove sub-user. |

---

### 6. 🟣 Category: Admin & External Access

#### External API Keys (Admin Only)
*For generating keys for Bots/Agents.*

| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/admin/api-keys` | `admin.access` | List all active API keys. |
| **POST** | `/admin/api-keys` | `admin.access` | **Generate Key.** Body: `{ name: "Discord Bot", scopes: ["user.read"] }`. |
| **DELETE**| `/admin/api-keys/:id` | `admin.access` | Revoke a key immediately. |

#### User Operations
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/admin/users` | `admin.access` | Search users. |
| **POST** | `/admin/users/:id/balance` | `admin.access` | **Adjust Balance.** Body: `{ amount: 100, currency: "credits" | "coins" }`. |
| **POST** | `/admin/users/:id/ban` | `admin.access` | Ban user. |

#### Server Operations
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/admin/servers` | `admin.access` | List ALL servers. |
| **POST** | `/admin/servers/:id/suspend`| `admin.access` | Force suspend. |
| **DELETE**| `/admin/servers/:id` | `admin.access` | Force delete. |

#### Platform Config
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/admin/config` | `admin.access` | Fetch global settings. |
| **PATCH**| `/admin/config` | `admin.access` | **Hot Reload.** Update Prices or Maintenance Mode. |
| **POST** | `/admin/announcements` | `admin.access` | Create Global Alert (Toast) for all users. |
