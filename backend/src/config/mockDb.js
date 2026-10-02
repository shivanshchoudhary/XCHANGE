// File-Persistent Central Database Engine for Server Deployments (Render / Local)
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'db_store.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const DEFAULT_USERS = [
  {
    id: 'admin-1',
    name: 'Super Administrator',
    email: 'admin23@mrx.com',
    auth_identifier: 'Admin23',
    role: 'SUPERADMIN',
    active: true,
    password_hash: '$2a$10$UfAp7Za6sffPkgd8YdCSFuIh5MVSlH80cX2ec0.L1YHJY9X8RHrVi' // admin123
  },
  {
    id: 'admin-2',
    name: 'System Admin',
    email: 'admin@mrx.com',
    auth_identifier: 'admin',
    role: 'SUPERADMIN',
    active: true,
    password_hash: '$2a$10$UfAp7Za6sffPkgd8YdCSFuIh5MVSlH80cX2ec0.L1YHJY9X8RHrVi' // admin123
  },
  {
    id: 'jeet-1',
    name: 'Jeet Khubchandani',
    email: 'jeet@mrx.com',
    auth_identifier: 'Jeet',
    role: 'SUPERADMIN',
    active: true,
    password_hash: '$2a$10$UfAp7Za6sffPkgd8YdCSFuIh5MVSlH80cX2ec0.L1YHJY9X8RHrVi' // admin123
  },
  {
    id: 'sonal-1',
    name: 'Sonal Wadwani',
    email: 'sonal@mrx.com',
    auth_identifier: 'Sonal',
    role: 'SUPERADMIN',
    active: true,
    password_hash: '$2a$10$UfAp7Za6sffPkgd8YdCSFuIh5MVSlH80cX2ec0.L1YHJY9X8RHrVi' // admin123
  },
  {
    id: 'staff-1',
    name: 'Staff User',
    email: 'staff23@mrx.com',
    auth_identifier: 'Staff23',
    role: 'STAFF',
    active: true,
    password_hash: '$2a$10$fUPZd.gYfA27obcCkN4WxOuO3IkK0chWeE7l.AQbCxj0DkclgIR/e' // staff123
  },
  {
    id: 'staff-2',
    name: 'Staff User',
    email: 'staff@mrx.com',
    auth_identifier: 'staff',
    role: 'STAFF',
    active: true,
    password_hash: '$2a$10$fUPZd.gYfA27obcCkN4WxOuO3IkK0chWeE7l.AQbCxj0DkclgIR/e' // staff123
  }
];

function loadStore() {
  ensureDataDir();
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        mockUsers: Array.isArray(parsed.mockUsers) && parsed.mockUsers.length > 0 ? parsed.mockUsers : [...DEFAULT_USERS],
        mockDevices: Array.isArray(parsed.mockDevices) ? parsed.mockDevices : [],
        mockRepairs: Array.isArray(parsed.mockRepairs) ? parsed.mockRepairs : [],
        mockRejections: Array.isArray(parsed.mockRejections) ? parsed.mockRejections : [],
        mockSales: Array.isArray(parsed.mockSales) ? parsed.mockSales : [],
        mockExpenses: Array.isArray(parsed.mockExpenses) ? parsed.mockExpenses : [],
        mockInvestments: Array.isArray(parsed.mockInvestments) ? parsed.mockInvestments : [],
        mockTransactions: Array.isArray(parsed.mockTransactions) ? parsed.mockTransactions : [],
        mockImages: Array.isArray(parsed.mockImages) ? parsed.mockImages : []
      };
    } catch (e) {
      console.warn('⚠️ Could not parse db_store.json, using clean store:', e.message);
    }
  }
  return {
    mockUsers: [...DEFAULT_USERS],
    mockDevices: [],
    mockRepairs: [],
    mockRejections: [],
    mockSales: [],
    mockExpenses: [],
    mockInvestments: [],
    mockTransactions: [],
    mockImages: []
  };
}

let store = loadStore();

function saveStore() {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ Failed to write db_store.json:', e.message);
  }
}

export function cleanMockStore() {
  store = {
    mockDevices: [],
    mockRepairs: [],
    mockRejections: [],
    mockSales: [],
    mockExpenses: [],
    mockInvestments: [],
    mockTransactions: [],
    mockImages: []
  };
  saveStore();
}

export function createMockPool() {
  console.log('⚡ File-Persistent Database initialized at:', STORE_FILE);

  const mockPool = {
    isMockPool: true,
    cleanMockStore() {
      cleanMockStore();
    },
    async getConnection() {
      return {
        async query(sql, params) {
          return mockPool.query(sql, params);
        },
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {}
      };
    },
    async query(sql, params = []) {
      const s = sql.toLowerCase().trim();

      // TRUNCATE or DELETE ALL
      if ((s.includes('delete from') || s.includes('truncate')) && !s.includes('where')) {
        cleanMockStore();
        return [{ affectedRows: 1 }, []];
      }

      // DELETE single device or status filtered devices
      if (s.includes('delete from devices') && s.includes('where')) {
        if (s.includes("status = 'rejected'")) {
          store.mockDevices = store.mockDevices.filter(d => d.status !== 'REJECTED');
        } else {
          const targetId = params[0];
          store.mockDevices = store.mockDevices.filter(d => 
            String(d.id) !== String(targetId) && String(d.device_code) !== String(targetId)
          );
        }
        saveStore();
        return [{ affectedRows: 1 }, []];
      }

      // UPDATE device status or fields
      if (s.includes('update devices set')) {
        let statusVal = null;
        if (s.includes('status = ?')) {
          statusVal = params[0];
        }

        const targetId = params[params.length - 1]; // usually WHERE id = ? at the end
        store.mockDevices = store.mockDevices.map(d => {
          if (String(d.id) === String(targetId) || String(d.device_code) === String(targetId)) {
            return {
              ...d,
              ...(statusVal ? { status: statusVal } : {})
            };
          }
          return d;
        });
        saveStore();
        return [{ affectedRows: 1 }, []];
      }

      // COUNT queries
      if (s.includes('select count(*)')) {
        let count = store.mockDevices.length;
        if (s.includes('devices')) count = store.mockDevices.length;
        if (s.includes('transactions')) count = store.mockTransactions.length;
        if (s.includes('expenses')) count = store.mockExpenses.length;
        if (s.includes('investments')) count = store.mockInvestments.length;
        return [[{ count, total: count }], []];
      }

      // SELECT users
      if (s.includes('from users')) {
        let users = [...store.mockUsers];
        if (params && params.length > 0) {
          const searchParam = String(params[0]).toLowerCase();
          users = users.filter(u => 
            (u.email && u.email.toLowerCase() === searchParam) ||
            (u.auth_identifier && u.auth_identifier.toLowerCase() === searchParam)
          );
        }
        return [users, []];
      }

      // INSERT INTO users
      if (s.includes('insert into users')) {
        const newUser = {
          id: params[0] || uuidv4(),
          name: params[1] || 'User',
          email: params[2] || '',
          password_hash: params[3] || '',
          auth_identifier: params[4] || '',
          role: params[5] || 'STAFF',
          active: true
        };
        store.mockUsers = store.mockUsers.filter(u => 
          u.email.toLowerCase() !== newUser.email.toLowerCase() && 
          u.auth_identifier.toLowerCase() !== newUser.auth_identifier.toLowerCase()
        );
        store.mockUsers.push(newUser);
        saveStore();
        return [{ affectedRows: 1, insertId: store.mockUsers.length }, []];
      }

      // UPDATE users
      if (s.includes('update users')) {
        if (s.includes('role = ?')) {
          const role = params[0];
          const searchParam = String(params[1] || params[2] || '').toLowerCase();
          store.mockUsers = store.mockUsers.map(u => {
            if ((u.email && u.email.toLowerCase() === searchParam) || (u.auth_identifier && u.auth_identifier.toLowerCase() === searchParam)) {
              return { ...u, role };
            }
            return u;
          });
          saveStore();
        }
        return [{ affectedRows: 1 }, []];
      }

      // SELECT devices
      if (s.includes('from devices')) {
        let filtered = [...store.mockDevices];

        // Specific ID check
        if (s.includes('where id = ?') || s.includes('where id = ? or device_code = ?')) {
          const checkId = params[0];
          filtered = filtered.filter(d => String(d.id) === String(checkId) || String(d.device_code) === String(checkId));
          return [filtered, []];
        }

        if (s.includes('d.status = ?') || s.includes('status = ?')) {
          const statusParam = params.find(p => typeof p === 'string' && ['OLD_IN_HAND', 'NEW_IN_HAND', 'IN_REPAIR', 'REJECTED', 'OLD_INVENTORY', 'SOLD', 'BOOKED'].includes(p));
          if (statusParam) {
            filtered = filtered.filter(d => d.status === statusParam);
          }
        }

        return [filtered, []];
      }

      // SELECT sales
      if (s.includes('from sales')) {
        const enrichedSales = (store.mockSales || []).map(sale => {
          const device = (store.mockDevices || []).find(d => String(d.id) === String(sale.device_id)) || {};
          return {
            ...sale,
            brand: device.brand || 'Device',
            model: device.model || 'Model',
            imei: device.imei || null,
            purchase_amount: device.purchase_amount || 0,
            repair_cost: 0
          };
        });
        return [enrichedSales, []];
      }

      // SELECT transactions
      if (s.includes('from transactions')) {
        let rows = [...store.mockTransactions];
        return [rows, []];
      }

      // SELECT expenses
      if (s.includes('from expenses')) {
        return [store.mockExpenses, []];
      }

      // SELECT investments
      if (s.includes('from investments')) {
        return [store.mockInvestments, []];
      }

      // INSERT INTO sales
      if (s.includes('insert into sales')) {
        const saleId = params[0] || uuidv4();
        const deviceId = params[1];
        const sellingPrice = parseFloat(params[2] || 0);
        const discountAmount = parseFloat(params[3] || 0);
        const customerName = params[4] || null;
        const customerPhone = params[5] || null;
        const paymentMethod = params[6] || 'Cash';
        const paymentStatus = params[7] || 'PAID';
        const remarks = params[8] || null;
        const soldBy = params[9] || 'Staff';

        const device = (store.mockDevices || []).find(d => String(d.id) === String(deviceId));
        if (device) {
          device.status = 'SOLD';
        }

        const newSale = {
          id: saleId,
          device_id: deviceId,
          selling_price: sellingPrice,
          discount_amount: discountAmount,
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          remarks: remarks,
          sold_by: soldBy,
          sold_at: new Date().toISOString()
        };
        store.mockSales.unshift(newSale);
        saveStore();
        return [{ affectedRows: 1, insertId: store.mockSales.length }, []];
      }

      // INSERT INTO device_status_history
      if (s.includes('insert into device_status_history')) {
        return [{ affectedRows: 1 }, []];
      }

      // INSERT INTO devices
      if (s.includes('insert into devices')) {
        const deviceId = params[0] || uuidv4();
        const deviceCode = params[1] || `MRX-${String(store.mockDevices.length + 10).padStart(5, '0')}`;
        const newDevice = {
          id: deviceId,
          device_code: deviceCode,
          imei: params[2] || null,
          brand: params[3] || 'Apple',
          model: params[4] || 'iPhone',
          ram: params[5] || 6,
          storage: params[6] || 128,
          colour: params[7] || 'Black',
          condition: params[8] || 'Good',
          purchase_amount: parseFloat(params[9] || 0),
          paid_by: params[10] || 'Staff',
          payment_method: params[11] || 'UPI',
          supplier_name: params[12] || null,
          intake_date: params[13] || new Date().toISOString().split('T')[0],
          remarks: params[14] || null,
          status: params[15] || 'OLD_INVENTORY',
          image_url: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=200'
        };
        store.mockDevices.unshift(newDevice);
        saveStore();
        return [{ insertId: store.mockDevices.length, id: deviceId, device_code: deviceCode }, []];
      }

      // INSERT INTO transactions
      if (s.includes('insert into transactions')) {
        const newTx = {
          id: params[0] || uuidv4(),
          transaction_code: params[1] || `TX-00${store.mockTransactions.length + 1}`,
          transaction_type: params[2] || 'ACQUISITION',
          flow_type: params[3] || 'DEBIT',
          amount: parseFloat(params[4] || 0),
          device_id: params[5] || null,
          admin_name: params[6] || 'Staff',
          payment_method: params[7] || 'UPI',
          transaction_date: params[8] || new Date().toISOString().split('T')[0],
          description: params[9] || 'Transaction entry'
        };
        store.mockTransactions.unshift(newTx);
        saveStore();
        return [{ insertId: store.mockTransactions.length }, []];
      }

      // INSERT INTO device_images
      if (s.includes('insert into device_images')) {
        const imgObj = {
          id: params[0] || uuidv4(),
          device_id: params[1],
          url: params[2],
          sort_order: params[3] || 0
        };
        store.mockImages.push(imgObj);
        // attach image_url to matching device
        store.mockDevices = store.mockDevices.map(d => 
          String(d.id) === String(params[1]) ? { ...d, image_url: params[2], images: [...(d.images || []), params[2]] } : d
        );
        saveStore();
        return [{ insertId: store.mockImages.length }, []];
      }

      // Default safe empty return
      return [[], []];
    }
  };

  return mockPool;
}
