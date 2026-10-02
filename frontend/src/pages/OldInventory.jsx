import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  FileText,
  Database,
  Smartphone,
  Filter,
  Edit,
  Trash2,
  X,
  Camera
} from 'lucide-react';
import { deviceService } from '../services/api';
import { CurrencyAmount } from '../components/common/UIComponents';
import AddMobileModal from '../components/modals/AddMobileModal';
import MobileHistoryModal from '../components/modals/MobileHistoryModal';
import BookMobileModal from '../components/modals/BookMobileModal';
import PdfExportModal from '../components/common/PdfExportModal';
import CameraCaptureModal from '../components/common/CameraCaptureModal';
import { useOutletContext, useNavigate } from 'react-router-dom';

const BRANDS = ['All Brands', 'Google Pixel', 'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Vivo', 'Oppo', 'Realme', 'Nothing', 'Motorola'];
const MODELS_BY_BRAND = {
  'Google Pixel': ['Pixel 8 Pro', 'Pixel 8', 'Pixel 7a', 'Pixel 6 Pro'],
  'Apple': ['iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 14', 'iPhone 13', 'iPhone 12', 'iPhone 11'],
  'Samsung': ['Galaxy S24 Ultra', 'Galaxy S23 Ultra', 'Galaxy S22', 'Galaxy A54', 'Galaxy A52'],
  'OnePlus': ['OnePlus 12', 'OnePlus 11', 'OnePlus 10R', 'OnePlus Nord 3'],
  'Xiaomi': ['14 Ultra', 'Redmi Note 12', 'Redmi Note 10', 'Mi 11X'],
  'Vivo': ['Vivo X100 Pro', 'Vivo V27', 'Vivo V21', 'Vivo Y200'],
  'Oppo': ['Find N3 Flip', 'Reno 10 Pro+', 'Oppo F19', 'Oppo A78'],
  'Realme': ['GT 5 Pro', 'Realme 11 Pro', 'Realme 8'],
  'Nothing': ['Phone (2a)', 'Phone (2)', 'Phone (1)'],
  'Motorola': ['Edge 50 Ultra', 'Edge 40']
};

const getSampleDevices = () => [];

export default function OldInventory() {
  const { globalSearch, selectedDate } = useOutletContext() || {};
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [bookingDevice, setBookingDevice] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [popupDevice, setPopupDevice] = useState(null); // Image click popup device state

  const [exportModalConfig, setExportModalConfig] = useState({
    isOpen: false,
    title: '',
    headers: [],
    rows: [],
    filename: '',
    summaryInfo: []
  });

  // Brand filter
  const [selectedBrand, setSelectedBrand] = useState('All Brands');

  // Checkbox selection state
  const [selectedIds, setSelectedIds] = useState([]);

  // Edit Modal & Camera State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    brand: '',
    model: '',
    storage: '',
    ram: '',
    colour: '',
    condition: 'Good',
    purchase_amount: '',
    paid_by: '',
    status: 'OLD_INVENTORY',
    image_url: ''
  });

  const handleOpenEditModal = () => {
    if (selectedIds.length !== 1) {
      alert('Please select exactly 1 device to edit.');
      return;
    }
    const target = devices.find(d => String(d.id) === String(selectedIds[0]));
    if (target) {
      setEditForm({
        id: target.id,
        brand: target.brand || '',
        model: target.model || '',
        storage: target.storage || '',
        ram: target.ram || '',
        colour: target.colour || '',
        condition: target.condition || 'Good',
        purchase_amount: target.purchase_amount || '',
        paid_by: target.paid_by || '',
        status: target.status || 'OLD_INVENTORY',
        image_url: target.image_url || (target.images && target.images[0]) || 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=100'
      });
      setIsEditModalOpen(true);
    }
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, image_url: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setDevices(prev => prev.map(d => String(d.id) === String(editForm.id) ? {
      ...d,
      brand: editForm.brand,
      model: editForm.model,
      storage: Number(editForm.storage),
      ram: Number(editForm.ram),
      colour: editForm.colour,
      condition: editForm.condition,
      purchase_amount: Number(editForm.purchase_amount),
      paid_by: editForm.paid_by,
      status: editForm.status,
      image_url: editForm.image_url,
      images: [editForm.image_url]
    } : d));
    setIsEditModalOpen(false);
    setSelectedIds([]);
    alert('Device details and photo updated successfully!');
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least 1 device to delete.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected device(s) from inventory?`)) {
      const deletedIds = JSON.parse(localStorage.getItem('mrx_deleted_device_ids') || '[]');
      const updatedDeleted = Array.from(new Set([...deletedIds, ...selectedIds.map(String)]));
      localStorage.setItem('mrx_deleted_device_ids', JSON.stringify(updatedDeleted));

      for (const id of selectedIds) {
        try {
          await deviceService.deleteDevice(id);
        } catch (e) {}
      }

      ['mrx_old_inventory', 'mrx_old_in_hand_stock', 'mrx_devices', 'mrx_inventory'].forEach(key => {
        try {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          const updated = list.filter(item => !selectedIds.includes(String(item.id)) && !selectedIds.includes(String(item.device_code)));
          localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {}
      });

      setDevices(prev => prev.filter(d => !selectedIds.includes(String(d.id))));
      setSelectedIds([]);
      window.dispatchEvent(new Event('mrx_inventory_updated'));
      window.dispatchEvent(new Event('storage'));
      alert(`${selectedIds.length} device(s) deleted permanently!`);
    }
  };

  const handleSingleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this device from Add Inventory?')) {
      const idStr = String(id);
      const deletedIds = JSON.parse(localStorage.getItem('mrx_deleted_device_ids') || '[]');
      if (!deletedIds.includes(idStr)) {
        deletedIds.push(idStr);
        localStorage.setItem('mrx_deleted_device_ids', JSON.stringify(deletedIds));
      }

      try {
        await deviceService.deleteDevice(id);
      } catch (err) {}

      ['mrx_old_inventory', 'mrx_old_in_hand_stock', 'mrx_devices', 'mrx_inventory'].forEach(key => {
        try {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          const updated = list.filter(item => String(item.id) !== idStr && String(item.device_code) !== idStr);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch (err) {}
      });

      setDevices(prev => prev.filter(d => String(d.id) !== idStr && String(d.device_code) !== idStr));
      window.dispatchEvent(new Event('mrx_inventory_updated'));
      window.dispatchEvent(new Event('storage'));
      alert('Device deleted permanently!');
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      let dataList = [];
      try {
        const res = await deviceService.getDevices({
          q: globalSearch || '',
          brand: selectedBrand === 'All Brands' ? '' : selectedBrand,
          from: selectedDate || '',
          to: selectedDate || ''
        });
        dataList = Array.isArray(res) ? res : (res?.data || []);
      } catch (e) {
        console.error(e);
      }

      const localOldInv = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]');
      const localOldHand = JSON.parse(localStorage.getItem('mrx_old_in_hand_stock') || '[]');
      const localNewHand = JSON.parse(localStorage.getItem('mrx_new_in_hand_stock') || '[]');
      const localRepair = JSON.parse(localStorage.getItem('mrx_repair_stock') || '[]');
      const localRejected = JSON.parse(localStorage.getItem('mrx_rejected_stock') || '[]');
      const mrxDevices = JSON.parse(localStorage.getItem('mrx_devices') || '[]');

      const deletedIds = new Set(JSON.parse(localStorage.getItem('mrx_deleted_device_ids') || '[]').map(String));

      const rawCombined = [
        ...localOldInv,
        ...mrxDevices,
        ...dataList
      ].filter(item => {
        if (!item) return false;
        const idStr = String(item.id || '');
        const codeStr = String(item.device_code || '');
        if ((idStr && deletedIds.has(idStr)) || (codeStr && deletedIds.has(codeStr))) {
          return false;
        }
        const s = String(item.status || item.device_status || '').toUpperCase();
        if (s && s !== 'OLD_INVENTORY') return false;
        if (item.isExchanged || item.is_exchanged || s === 'EXCHANGED' || s === 'BOOKED' || s === 'SOLD' || s === 'OLD_IN_HAND' || s === 'IN_REPAIR' || s === 'REJECTED' || s === 'DELIVERED') {
          return false;
        }
        return true;
      });

      const seenFingerprints = new Set();
      const inventoryDevices = [];

      for (const item of rawCombined) {
        if (!item) continue;
        const brand = (item.brand || item.oldBrand || item.newBrand || item.mobileBrand || '').trim().toLowerCase();
        const model = (item.model || item.oldModel || item.newModel || item.mobileModel || '').trim().toLowerCase();
        const amount = Number(item.purchase_amount || item.amount || item.paidAmount || 0);
        const paidBy = (item.paid_by || item.purchasedBy || item.paidBy || '').trim().toLowerCase();
        const date = item.intake_date || item.created_at || item.date || '';

        const specKey = `${brand}|${model}|${item.storage || ''}|${item.ram || ''}|${amount}|${paidBy}|${date}`;
        const idKey = item.id ? `id_${item.id}` : null;
        const codeKey = item.device_code ? `code_${item.device_code}` : null;

        if (seenFingerprints.has(specKey) || (idKey && seenFingerprints.has(idKey)) || (codeKey && seenFingerprints.has(codeKey))) {
          continue;
        }

        seenFingerprints.add(specKey);
        if (idKey) seenFingerprints.add(idKey);
        if (codeKey) seenFingerprints.add(codeKey);
        inventoryDevices.push(item);
      }
      
      setDevices(inventoryDevices);
      setLoading(false);
    } catch (err) {
      console.error(err);
      const localInventory = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]');
      setDevices(localInventory);
      setLoading(false);
    }
  };

  const handleCleanInventory = async () => {
    if (window.confirm('Are you sure you want to clean/clear all central database inventory data? This will reset all server database rows to 0 across all devices.')) {
      try {
        await deviceService.cleanDatabase();
      } catch (err) {
        console.warn('Backend DB clean warning:', err);
      }

      localStorage.setItem('mrx_old_inventory', JSON.stringify([]));
      localStorage.setItem('mrx_old_in_hand_stock', JSON.stringify([]));
      localStorage.setItem('mrx_new_in_hand_stock', JSON.stringify([]));
      localStorage.setItem('mrx_repair_stock', JSON.stringify([]));
      localStorage.setItem('mrx_rejected_stock', JSON.stringify([]));
      localStorage.setItem('mrx_exchanges', JSON.stringify([]));
      localStorage.setItem('mrx_exchange_pool', JSON.stringify([]));
      localStorage.setItem('mrx_pending_payments', JSON.stringify([]));
      localStorage.setItem('mrx_sales', JSON.stringify([]));
      localStorage.setItem('mrx_devices', JSON.stringify([]));

      window.dispatchEvent(new Event('mrx_inventory_updated'));
      window.dispatchEvent(new Event('mrx_exchanges_updated'));
      window.dispatchEvent(new Event('mrx_pending_payments_updated'));
      window.dispatchEvent(new Event('storage'));

      setDevices([]);
      alert('Central database & local memory cleared to 0 successfully!');
    }
  };

  useEffect(() => {
    fetchInventory();

    const handleSync = () => fetchInventory();
    window.addEventListener('storage', handleSync);
    window.addEventListener('mrx_inventory_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('mrx_inventory_updated', handleSync);
    };
  }, [globalSearch, selectedDate, selectedBrand]);

  const handleStatusChange = async (device, newStatus) => {
    try {
      const deviceObj = typeof device === 'object' ? device : { id: device };
      const deviceId = deviceObj.id;
      const updatedDevice = {
        ...deviceObj,
        status: newStatus
      };

      try {
        await deviceService.updateStatus(deviceId, updatedDevice, updatedDevice);
      } catch (apiErr) {
        console.warn('API update status warning:', apiErr);
      }
      
      const oldInv = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]');

      if (newStatus === 'Booked' || newStatus === 'BOOKED') {
        setBookingDevice(deviceObj);
        setIsBookingModalOpen(true);
        return;
      }

      if (newStatus === 'OLD_IN_HAND') {

        const oldInHandStock = JSON.parse(localStorage.getItem('mrx_old_in_hand_stock') || '[]');
        const filtered = oldInHandStock.filter(d => String(d.id || d.device_code) !== String(deviceId || deviceObj.device_code));
        filtered.unshift(updatedDevice);
        localStorage.setItem('mrx_old_in_hand_stock', JSON.stringify(filtered));

        const mrxDevices = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
        const updatedMrx = mrxDevices.filter(d => String(d.id || d.device_code) !== String(deviceId || deviceObj.device_code));
        updatedMrx.unshift(updatedDevice);
        localStorage.setItem('mrx_devices', JSON.stringify(updatedMrx));

        const updatedInv = oldInv.filter(d => String(d.id || d.device_code) !== String(deviceId || deviceObj.device_code));
        localStorage.setItem('mrx_old_inventory', JSON.stringify(updatedInv));
      } else if (newStatus === 'IN_REPAIR') {
        const repairStock = JSON.parse(localStorage.getItem('mrx_repair_stock') || '[]');
        const filtered = repairStock.filter(d => String(d.id || d.device_code) !== String(deviceId || deviceObj.device_code));
        filtered.unshift(updatedDevice);
        localStorage.setItem('mrx_repair_stock', JSON.stringify(filtered));

        const updatedInv = oldInv.filter(d => String(d.id || d.device_code) !== String(deviceId || deviceObj.device_code));
        localStorage.setItem('mrx_old_inventory', JSON.stringify(updatedInv));
      } else if (newStatus === 'REJECTED') {
        const rejectedStock = JSON.parse(localStorage.getItem('mrx_rejected_stock') || '[]');
        const filtered = rejectedStock.filter(d => String(d.id || d.device_code) !== String(deviceId || deviceObj.device_code));
        filtered.unshift(updatedDevice);
        localStorage.setItem('mrx_rejected_stock', JSON.stringify(filtered));

        const updatedInv = oldInv.filter(d => String(d.id || d.device_code) !== String(deviceId || deviceObj.device_code));
        localStorage.setItem('mrx_old_inventory', JSON.stringify(updatedInv));
      } else if (newStatus === 'OLD_INVENTORY') {
        const filtered = oldInv.filter(d => String(d.id || d.device_code) !== String(deviceId || deviceObj.device_code));
        filtered.unshift(updatedDevice);
        localStorage.setItem('mrx_old_inventory', JSON.stringify(filtered));
      }

      window.dispatchEvent(new Event('mrx_inventory_updated'));
      window.dispatchEvent(new Event('storage'));
      
      // Immediately update device state in Add Inventory view
      if (newStatus !== 'OLD_INVENTORY') {
        setDevices(prev => prev.filter(d => String(d.id) !== String(deviceId)));
      } else {
        setDevices(prev => prev.map(d => String(d.id) === String(deviceId) ? updatedDevice : d));
      }
      
      // Automatic navigation based on new status option selected
      if (newStatus === 'IN_REPAIR') {
        navigate('/repair-stock');
      } else if (newStatus === 'REJECTED') {
        navigate('/rejected-stocks');
      } else if (newStatus === 'OLD_IN_HAND') {
        navigate('/old-in-hand');
      }
    } catch (err) {
      console.error(err);
      if (newStatus === 'OLD_IN_HAND') {
        navigate('/old-in-hand');
      }
    }
  };

  // Date helper
  const toYMD = (val) => {
    if (!val) return '';
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Filtered devices list based on selected Brand & selectedDate
  const filteredDevices = devices.filter(d => {
    const s = String(d.status || d.device_status || '').toUpperCase();
    if (s && s !== 'OLD_INVENTORY') return false;
    if (d.isExchanged || d.is_exchanged || s === 'EXCHANGED' || s === 'BOOKED' || s === 'SOLD' || s === 'OLD_IN_HAND' || s === 'IN_REPAIR' || s === 'REJECTED' || s === 'DELIVERED') return false;

    if (selectedBrand !== 'All Brands' && d.brand !== selectedBrand) return false;
    if (selectedDate) {
      const devYMD = toYMD(d.intake_date || d.created_at || d.date);
      const selYMD = toYMD(selectedDate);
      if (devYMD && selYMD && devYMD !== selYMD) return false;
    }
    return true;
  }).sort((a, b) => {
    // Recent added data appears on top (newest first), older at bottom
    const getTimestamp = (item) => {
      const val = item.intake_date || item.created_at || item.date || item.timestamp;
      if (val) {
        const parsed = new Date(val).getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      if (item.id) {
        const num = typeof item.id === 'number' ? item.id : parseInt(String(item.id).replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) return num;
      }
      return 0;
    };
    const timeA = getTimestamp(a);
    const timeB = getTimestamp(b);
    if (timeA !== timeB) return timeB - timeA;
    return String(b.id || b.device_code || '').localeCompare(String(a.id || a.device_code || ''));
  });

  const isAllSelected = filteredDevices.length > 0 && filteredDevices.every(d => selectedIds.includes(String(d.id)));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDevices.map(d => String(d.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const strId = String(id);
    setSelectedIds(prev =>
      prev.includes(strId) ? prev.filter(i => i !== strId) : [...prev, strId]
    );
  };

  const handleExportPdf = () => {
    const targetDevices = selectedIds.length > 0
      ? filteredDevices.filter(d => selectedIds.includes(String(d.id)))
      : filteredDevices;

    const headers = ['Brand', 'Model', 'Storage', 'RAM', 'Amount', 'Status'];
    const rows = targetDevices.map(d => [
      d.brand,
      d.model,
      `${d.storage} GB`,
      `${d.ram} GB`,
      `Rs. ${d.purchase_amount}`,
      d.status || 'OLD_INVENTORY'
    ]);
    const totalVal = targetDevices.reduce((sum, d) => sum + (Number(d.purchase_amount) || 0), 0);
    setExportModalConfig({
      isOpen: true,
      title: selectedIds.length > 0 
        ? `Master Inventory Report (${selectedIds.length} Selected)`
        : 'Master Inventory PDF Report',
      headers,
      rows,
      filename: `Master_Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      summaryInfo: [
        { label: 'Total Valuation', value: `Rs. ${totalVal.toLocaleString()}`, color: '#0284c7' }
      ]
    });
  };

  return (
    <div>
      {/* Header section with Listed Devices Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>Add Inventory</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            Master device intake register • {selectedDate ? `Filtered for ${selectedDate}` : 'All Intake History'}
          </p>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '8px' }}>
              <Plus size={18} /> Add Mobile
            </button>
            <button onClick={() => setIsHistoryModalOpen(true)} className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f8fafc', fontWeight: 700 }}>
              <FileText size={18} color="#0284c7" /> 📜 Mobile Intake History
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="kpi-card" style={{ minWidth: '180px', margin: 0 }}>
            <div className="kpi-icon-wrap" style={{ backgroundColor: '#e0f2fe' }}>
              <Smartphone size={24} color="#0284c7" />
            </div>
            <div className="kpi-info">
              <span className="kpi-title">Listed Devices</span>
              <span className="kpi-value" style={{ fontSize: '22px' }}>{filteredDevices.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Toolbar with Brand Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Brand Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={15} color="#64748b" />
            <select 
              className="form-control" 
              style={{ width: '180px', padding: '7px 12px', fontSize: '13px' }}
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              {BRANDS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={handleOpenEditModal} 
            disabled={selectedIds.length !== 1}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              opacity: selectedIds.length === 1 ? 1 : 0.45,
              cursor: selectedIds.length === 1 ? 'pointer' : 'not-allowed',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px'
            }} 
            title={selectedIds.length === 1 ? "Edit selected device" : "Select exactly 1 device to edit"}
          >
            <Edit size={15} /> Edit {selectedIds.length === 1 ? '(1)' : ''}
          </button>

          <button 
            onClick={handleDeleteSelected} 
            disabled={selectedIds.length === 0}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              opacity: selectedIds.length > 0 ? 1 : 0.45,
              cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px'
            }} 
            title={selectedIds.length > 0 ? `Delete ${selectedIds.length} selected device(s)` : "Select device(s) to delete"}
          >
            <Trash2 size={15} /> Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>

          <button onClick={handleExportPdf} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px' }} title="Generate PDF report">
            <FileText size={15} /> Export PDF {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>
      </div>

      {/* Master Inventory Table */}
      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={isAllSelected} 
                  onChange={toggleSelectAll} 
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }} 
                  title="Select / Deselect All"
                />
              </th>
              <th>Image</th>
              <th>Brand / Model</th>
              <th>Storage</th>
              <th>RAM</th>
              <th>Paid Amount</th>
              <th>Paid By</th>
              <th>Date Added</th>
              <th>Status Dropdown</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Loading inventory...
                </td>
              </tr>
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No devices found matching current filters.
                </td>
              </tr>
            ) : (
              filteredDevices.map((device, idx) => (
                <tr key={device.id || idx}>
                  <td data-label="Select">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(String(device.id))} 
                      onChange={() => toggleSelectOne(device.id)} 
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </td>
                  <td data-label="Image">
                    <div 
                      onClick={() => setPopupDevice(device)} 
                      style={{ cursor: 'pointer', display: 'inline-block' }}
                      title="Click to view details & status"
                    >
                      {device.images && device.images.length > 1 ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <img 
                            src={device.images[0]} 
                            alt="Front" 
                            className="device-thumb" 
                            title="Front View - Click for popup"
                          />
                          <img 
                            src={device.images[1]} 
                            alt="Back" 
                            className="device-thumb" 
                            title="Back View - Click for popup"
                          />
                        </div>
                      ) : (
                        <img 
                          src={device.image_url || 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=100'} 
                          alt={device.model} 
                          className="device-thumb" 
                        />
                      )}
                    </div>
                  </td>

                  <td data-label="Device">
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{device.brand} {device.model}</div>
                  </td>
                  <td data-label="Storage">{device.storage} GB</td>
                  <td data-label="RAM">{device.ram} GB</td>
                  <td data-label="Paid Amount">
                    <CurrencyAmount amount={device.purchase_amount} />
                  </td>
                  <td data-label="Paid By">{device.paid_by || 'Staff'}</td>
                  <td data-label="Date Added">{device.intake_date ? String(device.intake_date).slice(0, 10) : 'Today'}</td>
                  <td data-label="Status">
                    {/* Status Dropdown: old-inhand, repair, rejected stock, old-inventory */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setBookingDevice(device); setIsBookingModalOpen(true); }}
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #7dd3fc',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Book this mobile for customer"
                        >
                          📖 Book
                        </button>

                        <select
                          value={device.status || 'OLD_INVENTORY'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); handleStatusChange(device, e.target.value); }}
                          className="form-control"
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            backgroundColor: 
                              device.status === 'OLD_IN_HAND' || device.status === 'IN_HAND' ? '#e0f2fe' :
                              device.status === 'IN_REPAIR' ? '#fef3c7' :
                              device.status === 'REJECTED' ? '#fee2e2' : '#f1f5f9',
                            color: 
                              device.status === 'OLD_IN_HAND' || device.status === 'IN_HAND' ? '#0284c7' :
                              device.status === 'IN_REPAIR' ? '#d97706' :
                              device.status === 'REJECTED' ? '#dc2626' : '#475569',
                            border: '1px solid #cbd5e1'
                          }}
                        >
                          <option value="OLD_INVENTORY">Add Inventory</option>
                          <option value="Booked">📖 Book Mobile</option>
                          <option value="OLD_IN_HAND">Old In-Hand</option>
                          <option value="IN_REPAIR">Repair</option>
                          <option value="REJECTED">Rejected Stock</option>
                        </select>
                        <button
                          type="button"
                          onClick={(e) => handleSingleDelete(device.id, e)}
                          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                          title="Delete device permanently"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Image Click Popup Modal (Brand, Storage, RAM & Status Dropdown) */}
      {popupDevice && (
        <div className="modal-overlay" onClick={() => setPopupDevice(null)}>
          <div 
            className="modal-card" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '480px', borderRadius: '16px', padding: '24px', textAlign: 'center' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Device Details</h3>
              <button onClick={() => setPopupDevice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', fontWeight: 700, color: '#64748b' }}>✕</button>
            </div>

            {/* Device Image Preview (Show all attached photos side by side) */}
            {(() => {
              const allImgs = (popupDevice.images && popupDevice.images.length > 0)
                ? popupDevice.images.filter(Boolean)
                : [popupDevice.image_url || popupDevice.image_data].filter(Boolean);
              const previewList = allImgs.length > 0 ? allImgs : ['https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=200'];

              return (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '16px', display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                  {previewList.map((imgSrc, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <img 
                        src={imgSrc} 
                        alt={`${popupDevice.model} - Photo ${i+1}`} 
                        style={{ maxHeight: '150px', maxWidth: previewList.length > 1 ? '160px' : '260px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                      />
                      {previewList.length > 1 && (
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>
                          Photo {i+1} {i === 0 ? '(Front)' : i === 1 ? '(Back)' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Info Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', background: '#f1f5f9', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Brand:</span>
                <span style={{ color: '#0f172a', fontWeight: 800 }}>{popupDevice.brand}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Model:</span>
                <span style={{ color: '#0f172a', fontWeight: 800 }}>{popupDevice.model}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Storage:</span>
                <span style={{ color: '#0284c7', fontWeight: 800 }}>{popupDevice.storage} GB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>RAM:</span>
                <span style={{ color: '#0284c7', fontWeight: 800 }}>{popupDevice.ram} GB</span>
              </div>
            </div>

            {/* Status Dropdown */}
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: '6px' }}>Update Status</label>
              <select
                value={popupDevice.status || 'OLD_INVENTORY'}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  handleStatusChange(popupDevice, newStatus);
                  setPopupDevice(null);
                }}
                className="form-control"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '2px solid #0284c7',
                  color: '#0f172a'
                }}
              >
                <option value="OLD_INVENTORY">Add Inventory</option>
                <option value="OLD_IN_HAND">Old In-Hand</option>
                <option value="IN_REPAIR">Repair</option>
                <option value="REJECTED">Rejected Stock</option>
              </select>
            </div>

            <button 
              onClick={() => setPopupDevice(null)} 
              className="btn-secondary" 
              style={{ width: '100%', padding: '10px', borderRadius: '8px', fontWeight: 700 }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Mobile Modal */}
      <AddMobileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setSelectedBrand('All Brands');
          fetchInventory();
        }}
      />

      {/* Edit Device Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', margin: 0 }}>Edit Inventory Device</h2>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', margin: 0 }}>Update details for selected device.</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
            </div>

            <form onSubmit={handleSaveEdit}>
              {/* Device Photo / Image Edit Section */}
              <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontWeight: 700, color: '#0284c7', margin: 0 }}>
                    📸 Device Photo / Image
                  </label>
                  <button 
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Camera size={13} /> Take Photo via Camera
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  {editForm.image_url ? (
                    <img 
                      src={editForm.image_url} 
                      alt="Preview" 
                      style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }} 
                    />
                  ) : (
                    <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#64748b' }}>
                      No Image
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Upload New Photo</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageFileChange} 
                      style={{ fontSize: '12px', marginBottom: '6px', width: '100%' }}
                    />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Or paste Image URL (e.g. https://...)" 
                      value={editForm.image_url} 
                      onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })} 
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label">Brand Name *</label>
                  <input type="text" className="form-control" value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Model *</label>
                  <input type="text" className="form-control" value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Storage (GB) *</label>
                  <input type="number" className="form-control" value={editForm.storage} onChange={(e) => setEditForm({ ...editForm, storage: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">RAM (GB) *</label>
                  <input type="number" className="form-control" value={editForm.ram} onChange={(e) => setEditForm({ ...editForm, ram: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Color *</label>
                  <input type="text" className="form-control" value={editForm.colour} onChange={(e) => setEditForm({ ...editForm, colour: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Paid By (Super Admin) *</label>
                  <select 
                    className="form-control" 
                    value={editForm.paid_by || 'Jeet Khubchandani'} 
                    onChange={(e) => setEditForm({ ...editForm, paid_by: e.target.value })}
                    style={{ fontWeight: 700 }}
                  >
                    <option value="Jeet Khubchandani">Jeet Khubchandani</option>
                    <option value="Sonal Wadwani">Sonal Wadwani</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Paid Amount (₹) *</label>
                <input type="number" className="form-control" value={editForm.purchase_amount} onChange={(e) => setEditForm({ ...editForm, purchase_amount: e.target.value })} required />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Status *</label>
                <select className="form-control" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="OLD_INVENTORY">Add Inventory</option>
                  <option value="OLD_IN_HAND">Old In-Hand</option>
                  <option value="IN_REPAIR">Repair</option>
                  <option value="REJECTED">Rejected Stock</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 24px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Export Preview Dialogue Modal */}
      <PdfExportModal
        isOpen={exportModalConfig.isOpen}
        onClose={() => setExportModalConfig({ ...exportModalConfig, isOpen: false })}
        title={exportModalConfig.title}
        headers={exportModalConfig.headers}
        rows={exportModalConfig.rows}
        filename={exportModalConfig.filename}
        summaryInfo={exportModalConfig.summaryInfo}
      />

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => setEditForm(prev => ({ ...prev, image_url: dataUrl }))}
      />

      {/* Add Mobile Entry Modal */}
      <AddMobileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchInventory}
      />

      {/* Mobile Intake History Audit Log Modal */}
      <MobileHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Book Mobile Modal for Add Inventory */}
      <BookMobileModal
        isOpen={isBookingModalOpen}
        onClose={() => { setIsBookingModalOpen(false); setBookingDevice(null); }}
        device={bookingDevice}
        onBookingSuccess={fetchInventory}
      />
    </div>
  );
}
