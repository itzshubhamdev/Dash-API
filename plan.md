# Backend Architecture & API Specification
## Project: QeinTech Platform (Headless API)

**Base URL:** `https://api.qeintech.in/v1` <br>
**Framework:** Next.js 14 (Route Handlers) <br>
**Auth:** Supabase JWT (Bearer Token) <br>
**Architecture:** Headless (Frontend is separate)

---

### 1. 🛡️ The Permission System (Granular)

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

### 2. 🟢 Category: Authentication & Identity

| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/auth/sync` | Public | **Sync User.** Checks Central Auth token. Creates DB row if new. |
| **GET** | `/auth/me` | Public | **Session.** Returns Profile, Role, and **Dual Wallet Balance** (Coins & Credits). |
| **POST** | `/auth/logout` | Public | Invalidates session (Frontend logic). |

---

### 3. 🔵 Category: Economy & Billing (Dual Currency)

**Currencies:**
* 🪙 **Coins:** Earned via activity (Daily, Referrals). Used for *Free Tier* & *Cosmetics*.
* 💵 **$ Credits:** Purchased via UPI/Stripe. Used for *Premium Plans*, *VPS*, *Priority Support*.

#### Wallet & Earning (Coins)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/economy/wallet` | Owner | Fetch balances `{ coins: 500, credits: 20.00 }`. |
| **GET** | `/economy/transactions` | Owner | Fetch history log (Coin earnings & Credit spends). |
| **POST** | `/economy/earn/daily` | Owner | Claims the 24h daily reward (Coins). |
| **POST** | `/economy/earn/referral` | Owner | Generate/Claim referral rewards. |

#### Billing & Payments (Credits)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/billing/top-up` | Owner | **Initiate Payment.** Body: `{ amount: 500, gateway: "upi" }`. Returns payment link. |
| **POST** | `/billing/webhook/:gateway`| Public | **Payment Callback.** Verifies payment & adds **Credits** to wallet. |
| **GET** | `/billing/invoices` | Owner | List PDF invoices for Credit purchases. |
| **POST** | `/billing/convert` | Owner | (Optional) Convert Credits -> Coins. *Never Coins -> Credits.* |

---

### 4. 🟠 Category: Server Management (Pterodactyl Bridge)

#### 🛒 Provisioning (The "Buy" Action)
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/catalog/plans` | Public | List Plans. Includes `currency_type` ('coins' or 'credits'). |
| **POST** | `/servers/deploy` | Owner | **Create Server.** <br>1. Check Plan Currency (Coin vs Credit).<br>2. Check Balance.<br>3. Deduct.<br>4. Provision on Pterodactyl. |
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

#### 📂 File Manager (Client API)
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
| **GET** | `/servers/:id/files/upload` | Owner | Get signed upload URL. |

#### 📦 Backups & Network
| Method | Route | Permission | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/servers/:id/backups` | Owner | List all backups. |
| **POST** | `/servers/:id/backups` | Owner | **Create Backup.** |
| **POST** | `/servers/:id/backups/:uuid/restore`| Owner | Restore a backup. |
| **GET** | `/servers/:id/network` | Owner | List allocated ports. |
| **POST** | `/servers/:id/network/allocations`| Owner | **Auto-Assign Port.** (May cost Credits). |

---

### 5. 🟣 Category: Admin & External Access

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
| **PATCH**| `/admin/config` | `admin.access` | **Hot Reload.** Update Prices (Coins/Credits) or Maintenance Mode. |
