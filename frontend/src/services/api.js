const rawApiUrl = import.meta.env.VITE_API_URL;
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const defaultBase = isLocal ? 'http://localhost:5000/api' : '/api';
const API_BASE = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`) : defaultBase;

export async function fetchApi(endpoint, options = {}) {
  const token = localStorage.getItem('mrx_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    throw new Error(`Network connection error: ${netErr.message || 'Unable to connect to server'}`);
  }

  // Safely parse JSON or text to prevent "Unexpected end of JSON input"
  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
  } else if (contentType.includes('text/html')) {
    throw new Error('API endpoint returned HTML instead of JSON. Ensure backend proxy or VITE_API_URL is correctly configured.');
  }

  if (!response.ok) {
    let errorMsg = data?.message || `HTTP ${response.status}: ${response.statusText}`;
    if (!data) {
      try {
        const text = await response.text();
        if (text && text.length < 200) errorMsg = text;
      } catch (_) {}
    }
    throw new Error(errorMsg);
  }

  return data || {};
}


// Device Service
export const deviceService = {
  getDevices: async (params = {}) => {
    let remoteDevices = [];
    try {
      const query = new URLSearchParams(params).toString();
      const res = await fetchApi(`/devices?${query}`);
      remoteDevices = Array.isArray(res) ? res : (res?.data || []);
    } catch (err) {
      console.warn("Backend API unavailable for getDevices, using local fallback:", err.message);
    }
    const localDevices = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
    
    // Deduplicate: remote devices (server DB) take precedence, matching by device_code or physical specs
    const seenKeys = new Set();
    const combined = [];

    for (const d of [...remoteDevices, ...localDevices]) {
      if (!d) continue;
      const brand = (d.brand || '').trim().toLowerCase();
      const model = (d.model || '').trim().toLowerCase();
      const amount = Number(d.purchase_amount || d.amount || 0);
      const paidBy = (d.paid_by || d.purchasedBy || '').trim().toLowerCase();
      const date = d.intake_date || d.created_at || d.date || '';

      const key = d.device_code
        ? `code_${d.device_code}`
        : `${brand}|${model}|${d.storage || ''}|${d.ram || ''}|${amount}|${paidBy}|${date}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push(d);
      }
    }

    let result = combined;

    if (params.status) {
      result = result.filter(d => d.status === params.status);
    }
    if (params.brand && params.brand !== 'All Brands') {
      result = result.filter(d => d.brand === params.brand);
    }
    return result;
  },
  getDeviceById: (id) => fetchApi(`/devices/${id}`),
  cleanDatabase: async () => {
    try {
      await fetchApi('/admin/clean-database', { method: 'POST' });
    } catch (e) {
      try {
        await fetchApi('/devices/clean-database', { method: 'POST' });
      } catch (err) {}
    }
    localStorage.setItem('mrx_devices', JSON.stringify([]));
    localStorage.setItem('mrx_old_inventory', JSON.stringify([]));
    localStorage.removeItem('mrx_inventory_cleared');
    return { success: true };
  },
  cleanRejectedStock: async () => {
    try {
      await fetchApi('/devices/clean-rejected', { method: 'POST' });
    } catch (e) {
      console.warn('Backend rejected stock clean warning:', e);
    }
    localStorage.setItem('mrx_rejected_stock', JSON.stringify([]));
    const localDevices = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
    const updatedDevices = localDevices.filter(d => d.status !== 'REJECTED');
    localStorage.setItem('mrx_devices', JSON.stringify(updatedDevices));
    return { success: true };
  },
  createDevice: async (formData) => {
    localStorage.removeItem('mrx_inventory_cleared');
    let createdObj = {};
    try {
      const res = await fetchApi('/devices', {
        method: 'POST',
        body: formData instanceof FormData ? formData : JSON.stringify(formData),
      });
      createdObj = res?.data || res || {};
    } catch (err) {
      console.warn("Backend API device creation offline fallback:", err.message);
    }

    const existing = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
    const newDevice = {
      ...formData,
      ...createdObj,
      id: createdObj.id || createdObj.deviceId || formData.id || `dev_${Date.now()}`,
      device_code: createdObj.device_code || createdObj.deviceCode || formData.device_code || `MRX-${String(existing.length + 10).padStart(5, '0')}`,
      status: createdObj.status || formData.status || 'OLD_INVENTORY',
      intake_date: createdObj.intake_date || formData.date || formData.intake_date || new Date().toISOString().split('T')[0],
      created_at: createdObj.created_at || new Date().toISOString()
    };

    // Filter out previous drafts of the same device before adding
    const filteredExisting = existing.filter(d => 
      String(d.id) !== String(newDevice.id) &&
      (!newDevice.device_code || d.device_code !== newDevice.device_code) &&
      !(d.brand === newDevice.brand && d.model === newDevice.model && Number(d.purchase_amount) === Number(newDevice.purchase_amount))
    );

    localStorage.setItem('mrx_devices', JSON.stringify([newDevice, ...filteredExisting]));
    return newDevice;
  },
  deleteDevice: async (id) => {
    try {
      await fetchApi(`/devices/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn("Backend API delete device offline/failed:", err.message);
    }
    const localInv = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]');
    const updatedInv = localInv.filter(d => String(d.id) !== String(id) && String(d.device_code) !== String(id));
    localStorage.setItem('mrx_old_inventory', JSON.stringify(updatedInv));

    const localDevices = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
    const updatedDevices = localDevices.filter(d => String(d.id) !== String(id) && String(d.device_code) !== String(id));
    localStorage.setItem('mrx_devices', JSON.stringify(updatedDevices));
    
    return { success: true };
  },
  updateStatus: async (id, payload, deviceObj = null) => {
    const statusVal = typeof payload === 'object' ? payload.status : payload;
    const existing = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
    let found = false;

    let updated = existing.map(d => {
      if (String(d.id) === String(id) || (d.device_code && String(d.device_code) === String(id))) {
        found = true;
        return { ...d, status: statusVal, ...(typeof payload === 'object' ? payload : {}) };
      }
      return d;
    });

    if (!found && deviceObj) {
      updated.unshift({
        ...deviceObj,
        status: statusVal,
        ...(typeof payload === 'object' ? payload : {})
      });
    } else if (!found && !deviceObj) {
      updated.unshift({
        id: String(id),
        status: statusVal,
        ...(typeof payload === 'object' ? payload : {})
      });
    }

    localStorage.setItem('mrx_devices', JSON.stringify(updated));

    try {
      return await fetchApi(`/devices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(typeof payload === 'object' ? payload : { status: statusVal }),
      });
    } catch (err) {
      console.warn("Backend API status update offline/405, updated locally:", err.message);
      return { success: true };
    }
  },
};

// Repair Service
export const repairService = {
  createRepair: (payload) => fetchApi('/repairs', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateRepair: (id, payload) => fetchApi(`/repairs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
};

// Rejection Service
export const rejectionService = {
  createRejection: (payload) => fetchApi('/rejections', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  resolveRejection: (id, payload) => fetchApi(`/rejections/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
};

// Sale Service
export const saleService = {
  createSale: async (payload) => {
    let res = {};
    try {
      res = await fetchApi('/sales', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Backend sale create offline fallback:", err.message);
    }
    const allLocalDevs = [
      ...JSON.parse(localStorage.getItem('mrx_devices') || '[]'),
      ...JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]'),
      ...JSON.parse(localStorage.getItem('mrx_old_in_hand_stock') || '[]')
    ];
    const devMatch = allLocalDevs.find(d => String(d.id) === String(payload.device_id) || String(d.device_code) === String(payload.device_id));
    const effectiveBrand = payload.brand || devMatch?.brand || devMatch?.newBrand || 'Device';
    const effectiveModel = payload.model || devMatch?.model || devMatch?.newModel || 'Model';
    const effectivePurchase = Number(payload.purchase_amount || payload.purchase || devMatch?.purchase_amount || devMatch?.amount || 0);
    const effectiveExchange = Number(payload.exchangeValue || payload.bev || devMatch?.exchangeValue || devMatch?.bev || 0);
    const effectiveRepair = Number(payload.repair_cost || payload.repairCost || devMatch?.repair_cost || devMatch?.repairCost || 0);
    const effectiveSelling = Number(payload.selling_price || payload.selling || 0);
    const effectiveProfit = effectiveSelling - (effectivePurchase + effectiveExchange + effectiveRepair);

    const localSales = JSON.parse(localStorage.getItem('mrx_sales') || '[]');
    const newSale = {
      id: res.saleId || `SALE-${Date.now()}`,
      date: payload.date || new Date().toISOString().split('T')[0],
      brand: effectiveBrand,
      model: effectiveModel,
      purchase_amount: effectivePurchase,
      purchase: effectivePurchase,
      pv: effectivePurchase,
      selling_price: effectiveSelling,
      selling: effectiveSelling,
      ppu: effectiveSelling,
      totalAmount: effectiveSelling,
      exchangeValue: effectiveExchange,
      bev: effectiveExchange,
      repair_cost: effectiveRepair,
      profit: effectiveProfit,
      unitProfit: effectiveProfit,
      admin: payload.admin || payload.sold_by || 'Jeet',
      customerName: payload.customer_name || 'Customer'
    };
    const updated = [newSale, ...localSales];
    localStorage.setItem('mrx_sales', JSON.stringify(updated));
    window.dispatchEvent(new Event('mrx_sales_updated'));
    window.dispatchEvent(new Event('storage'));
    return res;
  },
  getSales: async () => {
    let remoteSales = [];
    try {
      const res = await fetchApi('/sales');
      remoteSales = res?.data || [];
    } catch (err) {
      console.warn("Backend API sales fetch offline fallback:", err.message);
    }
    const localSales = JSON.parse(localStorage.getItem('mrx_sales') || '[]');
    const seen = new Set();
    const combined = [];
    for (const s of [...remoteSales, ...localSales]) {
      if (!s) continue;
      const key = s.id || `${s.brand}|${s.model}|${s.selling_price || s.selling}|${s.sold_at || s.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({
          ...s,
          date: s.sold_at ? s.sold_at.split('T')[0] : (s.date || new Date().toISOString().split('T')[0]),
          purchase: Number(s.purchase_amount || s.purchase || s.total_cost || 0),
          selling: Number(s.selling_price || s.selling || 0),
          profit: Number(s.realized_profit || s.profit || (Number(s.selling_price || 0) - Number(s.purchase_amount || 0))),
          admin: s.sold_by || s.admin || 'Jeet'
        });
      }
    }
    return { success: true, data: combined };
  },
  getSalesList: async () => {
    return saleService.getSales();
  }
};

// Central Ledger Service (Superadmin)
export const ledgerService = {
  getLedger: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/ledger?${query}`);
  },
  createEntry: (payload) => fetchApi('/ledger', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};

// Expenses Service (Superadmin)
export const expenseService = {
  getExpenses: async (params = {}) => {
    let remoteExpenses = [];
    try {
      const query = new URLSearchParams(params).toString();
      const res = await fetchApi(`/expenses?${query}`);
      remoteExpenses = res?.data || [];
    } catch (err) {
      console.warn("Backend API expense fetch offline fallback:", err.message);
    }
    const localExpenses = JSON.parse(localStorage.getItem('mrx_expenses') || '[]');
    const seen = new Set();
    const combined = [];
    for (const e of [...remoteExpenses, ...localExpenses]) {
      if (!e) continue;
      const key = e.id || e.expense_code || `${e.category || e.type}|${e.amount}|${e.expense_date || e.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({
          ...e,
          date: e.expense_date || e.date || new Date().toISOString().split('T')[0],
          admin: e.admin_name || e.admin || 'Jeet',
          type: e.category || e.type || 'Operational'
        });
      }
    }
    return { success: true, data: combined, total_expenses: combined.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) };
  },
  createExpense: async (payload) => {
    let createdRes = {};
    try {
      createdRes = await fetchApi('/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Backend API expense creation offline fallback:", err.message);
    }
    const localExpenses = JSON.parse(localStorage.getItem('mrx_expenses') || '[]');
    const newEntry = {
      id: createdRes.id || `EXP-${Date.now()}`,
      expense_code: createdRes.expense_code || `EXP-${Date.now().toString().slice(-6)}`,
      category: payload.category || payload.type || 'OTHER',
      type: payload.type || payload.category || 'OTHER',
      amount: Number(payload.amount) || 0,
      expense_date: payload.expense_date || payload.date || new Date().toISOString().split('T')[0],
      date: payload.expense_date || payload.date || new Date().toISOString().split('T')[0],
      admin_name: payload.admin_name || payload.admin || 'Jeet',
      admin: payload.admin_name || payload.admin || 'Jeet',
      recipient: payload.recipient || '',
      remarks: payload.remarks || ''
    };
    const updated = [newEntry, ...localExpenses];
    localStorage.setItem('mrx_expenses', JSON.stringify(updated));
    window.dispatchEvent(new Event('mrx_expenses_updated'));
    window.dispatchEvent(new Event('storage'));
    return { success: true, data: newEntry };
  }
};

// Investments Service (Superadmin)
export const investmentService = {
  getInvestments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/investments?${query}`);
  },
  createInvestment: (payload) => fetchApi('/investments', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};

// Stats & Analytics Service
export const statsService = {
  getDashboardStats: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/dashboard/stats?${query}`);
  },
  getInHandStats: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/dashboard/in-hand-stats?${query}`);
  },
  getSuperadminAnalytics: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/superadmin/analytics?${query}`);
  },
  getXlsExportUrl: (scope, filters = {}) => {
    const query = new URLSearchParams({ scope, ...filters }).toString();
    return `${API_BASE}/exports/csv?${query}`;
  },
  getCsvExportUrl: (scope, filters = {}) => {
    const query = new URLSearchParams({ scope, ...filters }).toString();
    return `${API_BASE}/exports/csv?${query}`;
  },
  getPdfExportUrl: (scope, filters = {}) => {
    const query = new URLSearchParams({ scope, ...filters }).toString();
    return `${API_BASE}/exports/pdf?${query}`;
  }
};
