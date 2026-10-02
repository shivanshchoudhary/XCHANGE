# Project Changelog & Bug Fix History (Change.md)

This document tracks all code changes, bug fixes, and feature updates made to the MR.X.Change project. Each entry strictly details **what was changed**, **why it was changed**, and **verification that it worked**.

---

## [Entry 1] — Backend Offline & Frontend API Routing Configuration

* **Date:** 2026-10-02
* **Target Files:**
  * `frontend/src/services/api.js`
  * `frontend/vite.config.js`
  * `frontend/vercel.json`

### 1. What We Changed
* Replaced the hardcoded, dead Render backend URL (`https://mrchange-qjrl.onrender.com/api`) in `frontend/src/services/api.js`.
* Added intelligent host detection:
  * When running on `localhost` or `127.0.0.1`, requests route directly through the Vite dev proxy to `http://localhost:5000/api`.
  * In production (Vercel), requests route cleanly via `/api` (or a custom `VITE_API_URL` environment variable if configured).
* Updated `frontend/vercel.json` and production build configuration.

### 2. Why We Changed It
* The previous Render server instance (`mrchange-qjrl.onrender.com`) had been deleted or suspended, returning `HTTP 404 (x-render-routing: no-server)`.
* Every API call from the frontend was failing, preventing real login, device creation, and database sync, causing silent fallbacks to local browser storage.

### 3. Did It Work?
* **Yes.**
  * Local Vite dev server on `http://localhost:3000` now connects to the backend server on `http://localhost:5000`.
  * Verified via health check: `{"status":"healthy","database":"connected"}`.
  * Verified production build with 0 Vite errors.

---

## [Entry 2] — User Authentication & Mock Database Password Verification

* **Date:** 2026-10-02
* **Target Files:**
  * `backend/src/config/mockDb.js`
  * `frontend/src/context/AuthContext.jsx`

### 1. What We Changed
* Updated `backend/src/config/mockDb.js` to store and manage `mockUsers` with real bcrypt hashes for:
  * **Super Admin:** `admin@mrx.com` / `Admin23` (password: `admin123`)
  * **Staff User:** `staff@mrx.com` / `Staff23` (password: `staff123`)
  * **Super Admin:** `jeet@mrx.com` / `Jeet` (password: `admin123`)
  * **Super Admin:** `sonal@mrx.com` / `Sonal` (password: `admin123`)
* Added handlers for `INSERT INTO users`, `UPDATE users`, and `SELECT ... FROM users` in `mockDb.js` with case-insensitive identifier matching.
* Added matching offline fallback credentials in `frontend/src/context/AuthContext.jsx` for Admin and Staff so users can authenticate even if offline.

### 2. Why We Changed It
* `mockDb.js` had hardcoded a dummy bcrypt hash (`$2a$10$wE8wJqQ9...`) that did not match any plaintext password.
* Entering `admin123` or `staff123` resulted in `{"success":false,"message":"Invalid credentials"}`.
* In `AuthContext.jsx`, the offline fallback only recognized names containing `jeet` or `sonal`, causing standard admin and staff logins to fail.

### 3. Did It Work?
* **Yes.**
  * Tested login via curl with `Admin23` / `admin123`: Returned `HTTP 200` with valid JWT token and `SUPERADMIN` role.
  * Tested login via curl with `staff@mrx.com` / `staff123`: Returned `HTTP 200` with valid JWT token and `STAFF` role.

---

## [Entry 3] — Duplicate Device Intake & Doubled Inventory Amount (2 iPhones / ₹60,000)

* **Date:** 2026-10-02
* **Target Files:**
  * `frontend/src/pages/OldInventory.jsx`
  * `frontend/src/components/modals/AddMobileModal.jsx`
  * `frontend/src/services/api.js`

### 1. What We Changed
* **In `OldInventory.jsx`:** Upgraded the deduplication algorithm in `rawCombined` merging. Instead of only checking `code_${item.device_code}`, the system generates a `specKey` from physical device properties:
  ```javascript
  const specKey = `${brand}|${model}|${item.storage || ''}|${item.ram || ''}|${amount}|${paidBy}|${date}`;
  ```
  If an item with identical physical specifications and intake date already exists, any redundant duplicate is merged and skipped.
* **In `AddMobileModal.jsx`:** Updated `filteredInv` to remove drafts matching the same brand, model, and purchase amount before saving to `mrx_old_inventory`.
* **In `api.js`:** Ensured the backend server's response (`createdObj`) takes precedence so the official sequential `device_code` (`MRX-00001`) and server UUID are applied rather than mismatched temporary codes.

### 2. Why We Changed It
* When adding a phone, `AddMobileModal.jsx` locally generated a temporary random device code (e.g., `MRX-9486b`) and saved it to `localStorage['mrx_old_inventory']`.
* Simultaneously, the server generated its official sequential code (`MRX-00001`).
* When `OldInventory.jsx` merged the two lists, it checked `code_${item.device_code}`. Because `MRX-9486b` != `MRX-00001`, the deduplication failed, displaying the same iPhone twice and doubling the total inventory from ₹30,000 to ₹60,000.

### 3. Did It Work?
* **Yes.**
  * The merged inventory list now detects matching physical specs and merges the records into 1 single device.
  * Inventory amount calculates correctly as ₹30,000 instead of ₹60,000.

---

## [Entry 4] — Total Profit Evaluates to ₹0 (Variable Collision in Profit Calculation)

* **Date:** 2026-10-02
* **Target Files:**
  * `frontend/src/pages/ProfitExpenseAndStatistic.jsx`

### 1. What We Changed
* **In `ProfitExpenseAndStatistic.jsx` (lines 122–154):** Disentangled the variable collision where selling price was overwriting purchase cost:
  * `actualAmount` strictly reads selling price from `s.selling || s.selling_price || s.actualAmount || s.totalAmount || s.soldPrice || s.ppu`.
  * `purchaseCost` strictly reads purchase cost from `s.purchase || s.purchase_amount || s.oldAmount || s.pv || s.boughtCost`.
  * Normalized object assigns `purchase: purchaseCost`, `pv: purchaseCost`, `selling: actualAmount`, `ppu: actualAmount`, `profit: perMobileProfit`, and `unitProfit: perMobileProfit`.
* **In line 440 (KPI Reducer):** Ensured the total profit accumulator directly reads `p.unitProfit` or `p.profit` if present, falling back to `ppu - (pv + bev + repair)`.
* **In line 1086 (Table UI):** Corrected the **Intake Cost** column to display `item.purchase` instead of `item.sellingPrice`.

### 2. Why We Changed It
* The original code had:
  ```javascript
  const sellingPrice = Number(s.sellingPrice || s.selling_price || s.purchase || ...);
  purchase: sellingPrice;
  ```
  Since `s.selling_price` was present on every sale (e.g. 40,000), `sellingPrice` evaluated to 40,000. The code then assigned `purchase: 40,000`!
* Because both selling price and purchase cost became 40,000, the formula:
  $$\text{Unit Profit} = \text{Selling Price} - \text{Purchase Cost} = 40,000 - 40,000 = 0$$
  forced the Total Profit to always display ₹0.

### 3. Did It Work?
* **Yes.**
  * Purchase Cost remains ₹30,000.
  * Selling Price remains ₹40,000.
  * Profit correctly calculates as:
    $$40,000 - (30,000 + 3,000) = \mathbf{\text{₹}7,000}$$

---

## [Entry 5] — Exchange Value (BEV) Dropped During Device Sale

* **Date:** 2026-10-02
* **Target Files:**
  * `frontend/src/pages/OldInHandStock.jsx`
  * `frontend/src/services/api.js`

### 1. What We Changed
* **In `OldInHandStock.jsx` (lines 338–365):** In `handleSellSubmit`, updated the `newSale` record to carry over `exchangeValue: exchValue`, `bev: exchValue`, `repair_cost: repCost`, `profit: calcProfit`, and `unitProfit: calcProfit`.
* **In `frontend/src/services/api.js` (lines 252–285):** In `saleService.createSale()`, when a sale is initiated by `device_id`, the service queries the local inventory store to find the original device and automatically injects `purchase_amount`, `exchangeValue`, and `repair_cost` if omitted from the modal payload.

### 2. Why We Changed It
* When selling a device, the sale form only tracked `totalAmount` and `purchase_amount`, discarding the ₹3,000 exchange credit given during trade-in.
* Without carrying this field over, the profit calculator treated `bev` as 0 instead of deducting the ₹3,000 trade-in allowance.

### 3. Did It Work?
* **Yes.**
  * The ₹3,000 exchange credit is now stored with the sale record and deducted in the unit profit formula.

---

## [Entry 6] — Backend Mock Database Sales Persistence

* **Date:** 2026-10-02
* **Target Files:**
  * `backend/src/config/mockDb.js`

### 1. What We Changed
* Added SQL query handlers in `mockDb.js` for:
  * `INSERT INTO sales`: Saves the sale record into `store.mockSales` in `backend/data/db_store.json` and updates the device status to `'SOLD'`.
  * `SELECT ... FROM sales`: Joins devices with sales to return `brand`, `model`, `purchase_amount`, and `repair_cost`.
  * `INSERT INTO device_status_history`: Returns successful query acknowledgment.

### 2. Why We Changed It
* `mockDb.js` had no handlers for any `sales` table queries.
* Whenever a sale was posted to the backend API (`/api/sales`), the query was silently dropped and `mockSales: []` remained permanently empty in `db_store.json`.

### 3. Did It Work?
* **Yes.**
  * Sales created through the backend API now persist to `backend/data/db_store.json`.
  * The sold device's status is automatically updated to `'SOLD'`.
