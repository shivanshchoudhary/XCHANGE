import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Search, 
  Layers, 
  HardDrive, 
  Cpu, 
  Download,
  FileText,
  ShoppingCart,
  Tag,
  Edit,
  Trash2,
  X,
  Camera,
  CheckCircle,
  XCircle,
  ShoppingBag,
  AlertTriangle
} from 'lucide-react';
import { deviceService, statsService, saleService } from '../services/api';
import { KPICard, CurrencyAmount } from '../components/common/UIComponents';
import { useOutletContext } from 'react-router-dom';
import { exportToXls } from '../utils/pdfGenerator';
import PdfExportModal from '../components/common/PdfExportModal';
import CameraCaptureModal from '../components/common/CameraCaptureModal';

export default function OldInHandStock() {
  const { globalSearch, selectedDate } = useOutletContext() || {};
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [expandedImage, setExpandedImage] = useState(null);

  const [exportModalConfig, setExportModalConfig] = useState({
    isOpen: false,
    title: '',
    headers: [],
    rows: [],
    filename: '',
    summaryInfo: []
  });

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
    purchase_amount: '',
    paid_by: '',
    image_url: ''
  });

  // Book New Device Modal State (opened via Exchange button)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [selectedDeviceForExchange, setSelectedDeviceForExchange] = useState(null);
  const [bookForm, setBookForm] = useState({
    oldBrand: '',
    oldModel: '',
    oldStorage: '128',
    oldRam: '8',
    oldAmount: '0',
    oldPayBy: 'Staff',
    oldImage: '',
    exchangeValue: '',
    newBrand: 'Apple',
    customBrand: '',
    newModel: '',
    newStorage: '256',
    newRam: '8',
    newPayBy: '',
    platform: 'Offline / Store',
    platformRemarks: '',
    purchasedAmount: '',
    via: 'Cash',
    accountId: ''
  });

  // Sell Modal State
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedSellDevice, setSelectedSellDevice] = useState(null);
  const [sellError, setSellError] = useState('');
  const [sellForm, setSellForm] = useState({
    model: '',
    unit: 1,
    soldBy: 'Jeet Khubchandani',
    soldTo: '',
    paymentType: 'COMPLETE',
    soldPrice: '',
    totalAmount: '',
    paidAmount: '',
    date: new Date().toISOString().split('T')[0]
  });

  const openEditModal = (device) => {
    setEditForm({
      id: device.id,
      brand: device.brand || '',
      model: device.model || '',
      storage: device.storage || '',
      ram: device.ram || '',
      colour: device.colour || '',
      purchase_amount: device.purchase_amount || '',
      paid_by: device.paid_by || 'Staff',
      image_url: device.image_url || (device.images && device.images[0]) || 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=100'
    });
    setIsEditModalOpen(true);
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
      purchase_amount: Number(editForm.purchase_amount),
      paid_by: editForm.paid_by,
      image_url: editForm.image_url,
      images: [editForm.image_url]
    } : d));

    // Update localStorage if saved in mrx_old_in_hand_stock
    const stored = JSON.parse(localStorage.getItem('mrx_old_in_hand_stock') || '[]');
    const updated = stored.map(item => String(item.id) === String(editForm.id) ? {
      ...item,
      brand: editForm.brand,
      model: editForm.model,
      storage: Number(editForm.storage),
      ram: Number(editForm.ram),
      colour: editForm.colour,
      purchase_amount: Number(editForm.purchase_amount),
      paid_by: editForm.paid_by,
      image_url: editForm.image_url,
      images: [editForm.image_url]
    } : item);
    localStorage.setItem('mrx_old_in_hand_stock', JSON.stringify(updated));

    setIsEditModalOpen(false);
    alert('Device details and photo updated successfully!');
  };

  const handleDeleteDevice = async (id) => {
    if (window.confirm('Are you sure you want to delete this device from Old In-hand stock?')) {
      try {
        const idStr = String(id);
        
        // 1. Add to blacklisted deleted IDs list
        const deletedIds = JSON.parse(localStorage.getItem('mrx_deleted_device_ids') || '[]');
        if (!deletedIds.includes(idStr)) {
          deletedIds.push(idStr);
          localStorage.setItem('mrx_deleted_device_ids', JSON.stringify(deletedIds));
        }

        // 2. Clean all local storage keys
        ['mrx_old_in_hand_stock', 'mrx_devices', 'mrx_old_inventory', 'mrx_inventory'].forEach(key => {
          try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const updated = list.filter(item => String(item.id) !== idStr && String(item.device_code) !== idStr);
            localStorage.setItem(key, JSON.stringify(updated));
          } catch (e) {}
        });

        // 3. Update UI state
        setDevices(prev => prev.filter(d => String(d.id) !== idStr && String(d.device_code) !== idStr));

        // 4. Send delete call to backend API
        try {
          await deviceService.deleteDevice(id);
        } catch (apiErr) {
          console.warn('Backend API delete offline/fallback:', apiErr);
        }

        window.dispatchEvent(new Event('mrx_inventory_updated'));
        window.dispatchEvent(new Event('storage'));
        alert('Device deleted successfully!');
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete device');
      }
    }
  };

  const handleOpenBookModal = (device) => {
    setSelectedDeviceForExchange(device);
    const amt = String(device.purchase_amount || device.amount || 0);
    setBookForm({
      oldBrand: device.brand || 'Samsung',
      oldModel: device.model || '',
      oldStorage: String(device.storage || 128),
      oldRam: String(device.ram || 8),
      oldAmount: amt,
      oldPayBy: device.paid_by || 'Staff',
      oldImage: device.image_url || (device.images && device.images[0]) || '',
      exchangeValue: '',
      newBrand: 'Apple',
      customBrand: '',
      newModel: '',
      newStorage: '256',
      newRam: '8',
      newPayBy: '',
      platform: 'Offline / Store',
      platformRemarks: '',
      purchasedAmount: '',
      via: 'Cash',
      accountId: ''
    });
    setIsBookModalOpen(true);
  };

  const handleBookSubmit = (e) => {
    e.preventDefault();
    if (!selectedDeviceForExchange) return;

    const oldAmt = Number(bookForm.oldAmount) || 0;
    const newAmt = Number(bookForm.purchasedAmount) || 0;
    const exVal = Number(bookForm.exchangeValue) || 0;
    const finalBrand = bookForm.newBrand === 'Others' ? (bookForm.customBrand || 'Others') : bookForm.newBrand;
    const exchangeId = `EXCH-${Date.now()}`;

    // 1. Add entry into mrx_exchanges so it's in sync with Exchange page
    const newExchangeEntry = {
      id: exchangeId,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      newBrand: finalBrand,
      newModel: bookForm.newModel,
      newStorage: Number(bookForm.newStorage) || 256,
      newRam: Number(bookForm.newRam) || 12,
      newPurchasedBy: bookForm.newPayBy || 'Customer',
      newAmount: newAmt,
      oldBrand: bookForm.oldBrand,
      oldModel: bookForm.oldModel,
      oldStorage: Number(bookForm.oldStorage) || 128,
      oldRam: Number(bookForm.oldRam) || 8,
      oldPurchasedBy: bookForm.oldPayBy || 'Staff',
      oldAmount: oldAmt,
      oldImage: bookForm.oldImage || '',
      platform: bookForm.platform,
      platformRemarks: bookForm.platformRemarks || '',
      exchangeValue: exVal,
      status: 'Booked'
    };

    try {
      const existingExchanges = JSON.parse(localStorage.getItem('mrx_exchanges') || '[]');
      localStorage.setItem('mrx_exchanges', JSON.stringify([newExchangeEntry, ...existingExchanges]));
      window.dispatchEvent(new Event('mrx_exchanges_updated'));
    } catch (err) {
      console.error(err);
    }

    // 2. Update device in OldInHandStock with New Mobile data and status = 'Booked'
    const updatedDevices = devices.map(d => {
      if (String(d.id) === String(selectedDeviceForExchange.id)) {
        return {
          ...d,
          status: 'Booked',
          exchangeId: exchangeId,
          newBrand: finalBrand,
          newModel: bookForm.newModel,
          newStorage: Number(bookForm.newStorage) || 256,
          newRam: Number(bookForm.newRam) || 12,
          newPurchasedBy: bookForm.newPayBy || 'Customer',
          newAmount: newAmt,
          platform: bookForm.platform,
          platformRemarks: bookForm.platformRemarks || '',
          exchangeRemarks: bookForm.exchangeRemarks || ''
        };
      }
      return d;
    });

    setDevices(updatedDevices);
    try {
      localStorage.setItem('mrx_old_in_hand_stock', JSON.stringify(updatedDevices));
      window.dispatchEvent(new Event('mrx_inventory_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error(err);
    }

    setIsBookModalOpen(false);
    window.dispatchEvent(new Event('mrx_exchanges_updated'));
    window.dispatchEvent(new Event('mrx_inventory_updated'));
    window.dispatchEvent(new Event('storage'));

    alert(`Device exchange for "${bookForm.newBrand} ${bookForm.newModel}" booked! Shifted to Booked & Exchange tab. Pending & Receiving entry will be created upon Deliver.`);
  };

  const openSellModal = (device) => {
    setSelectedSellDevice(device);
    setSellError('');
    const fullModelName = `${device.newBrand || device.brand} ${device.newModel || device.model}`;
    const initialPrice = device.newAmount || device.purchase_amount || 0;

    setSellForm({
      model: fullModelName,
      unit: 1,
      soldBy: device.newPurchasedBy || device.paid_by || 'Jeet Khubchandani',
      soldTo: device.newPurchasedBy || 'Customer',
      paymentType: 'COMPLETE',
      soldPrice: initialPrice,
      totalAmount: initialPrice,
      paidAmount: initialPrice,
      date: new Date().toISOString().split('T')[0]
    });
    setIsSellModalOpen(true);
  };

  const handleSellSubmit = (e) => {
    e.preventDefault();
    setSellError('');

    if (!selectedSellDevice) return;

    const requestedUnits = Number(sellForm.unit) || 1;

    const intakeCost = Number(selectedSellDevice.purchase_amount || selectedSellDevice.amount || selectedSellDevice.paidAmount || 0);
    const exchValue = Number(selectedSellDevice.exchangeValue || selectedSellDevice.bev || selectedSellDevice.newAmount || 0);
    const repCost = Number(selectedSellDevice.repair_cost || selectedSellDevice.repairCost || 0);
    const saleTotal = Number(sellForm.totalAmount) || Number(sellForm.soldPrice) || 0;
    const calcProfit = saleTotal - (intakeCost + exchValue + repCost);

    // Record sale in mrx_sales
    const newSale = {
      id: `SALE-${Date.now()}`,
      date: sellForm.date,
      brand: selectedSellDevice.newBrand || selectedSellDevice.brand,
      model: selectedSellDevice.newModel || selectedSellDevice.model,
      customerName: sellForm.soldTo,
      soldBy: sellForm.soldBy,
      quantity: requestedUnits,
      unitPrice: Number(sellForm.soldPrice) || 0,
      totalAmount: saleTotal,
      selling: saleTotal,
      selling_price: saleTotal,
      ppu: saleTotal,
      paidAmount: Number(sellForm.paidAmount) || 0,
      purchase_amount: intakeCost,
      purchase: intakeCost,
      pv: intakeCost,
      exchangeValue: exchValue,
      bev: exchValue,
      repair_cost: repCost,
      profit: calcProfit,
      unitProfit: calcProfit,
      paymentMode: sellForm.paymentType || 'Cash',
      status: 'Sold'
    };

    const existingSales = JSON.parse(localStorage.getItem('mrx_sales') || '[]');
    localStorage.setItem('mrx_sales', JSON.stringify([newSale, ...existingSales]));

    // Record Payment entry (Received if fully paid, Pending if partial)
    const totAmt = Number(sellForm.totalAmount) || 0;
    const pdAmt = Math.min(totAmt, Number(sellForm.paidAmount) || 0);
    const pendAmt = Math.max(0, totAmt - pdAmt);
    const payStatus = pendAmt <= 0 ? 'Received' : 'Pending';

    const newPaymentObj = {
      id: `PAY-${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: sellForm.date || new Date().toISOString().split('T')[0],
      customerName: sellForm.soldTo || 'Customer',
      brand: selectedSellDevice.newBrand || selectedSellDevice.brand || 'Apple',
      model: selectedSellDevice.newModel || selectedSellDevice.model || 'Device',
      imei: selectedSellDevice.imei || selectedSellDevice.device_code || 'N/A',
      totalAmount: totAmt,
      paidAmount: pdAmt,
      pendingAmount: pendAmt,
      status: payStatus,
      type: 'CUSTOMER_RECEIVABLE',
      recordCategory: 'SELL_MOBILE',
      mode: sellForm.paymentType || 'Cash'
    };

    try {
      const existingPayments = JSON.parse(localStorage.getItem('mrx_pending_payments') || '[]');
      localStorage.setItem('mrx_pending_payments', JSON.stringify([newPaymentObj, ...existingPayments]));
      window.dispatchEvent(new Event('mrx_pending_payments_updated'));
    } catch (e) {}

    // Mark row as Sold in OldInHandStock
    const updatedDevices = devices.map(item => {
      if (String(item.id) === String(selectedSellDevice.id)) {
        return {
          ...item,
          status: 'Sold'
        };
      }
      return item;
    });

    setDevices(updatedDevices);
    try {
      localStorage.setItem('mrx_old_in_hand_stock', JSON.stringify(updatedDevices));
      window.dispatchEvent(new Event('mrx_inventory_updated'));
      window.dispatchEvent(new Event('mrx_sales_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    // Update mrx_exchanges if exchangeId exists
    if (selectedSellDevice.exchangeId) {
      try {
        const storedExchanges = JSON.parse(localStorage.getItem('mrx_exchanges') || '[]');
        const updatedExchanges = storedExchanges.map(ex => {
          if (String(ex.id) === String(selectedSellDevice.exchangeId)) {
            return {
              ...ex,
              status: 'Sold'
            };
          }
          return ex;
        });
        localStorage.setItem('mrx_exchanges', JSON.stringify(updatedExchanges));
        window.dispatchEvent(new Event('mrx_exchanges_updated'));
      } catch (e) {}
    }

    setIsSellModalOpen(false);
    alert(`Successfully sold "${selectedSellDevice.newBrand || selectedSellDevice.brand} ${selectedSellDevice.newModel || selectedSellDevice.model}"! Status updated to Sold ✔️.`);
  };

  const handleClearInventory = () => {
    if (window.confirm('Are you sure you want to clear all devices from Old In-hand Stock inventory table?')) {
      const allCurrentIds = devices.map(d => String(d.id || d.device_code)).filter(Boolean);
      const deletedIds = JSON.parse(localStorage.getItem('mrx_deleted_device_ids') || '[]');
      const combinedDeleted = Array.from(new Set([...deletedIds, ...allCurrentIds]));
      localStorage.setItem('mrx_deleted_device_ids', JSON.stringify(combinedDeleted));

      setDevices([]);
      localStorage.setItem('mrx_old_in_hand_stock', JSON.stringify([]));
      localStorage.setItem('mrx_devices', JSON.stringify([]));
      localStorage.setItem('mrx_old_inventory', JSON.stringify([]));
      window.dispatchEvent(new Event('mrx_inventory_updated'));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const fetchOldInHandStock = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('mrx_old_in_hand_cleared');
      const cancelledItems = JSON.parse(localStorage.getItem('mrx_old_in_hand_stock') || '[]');
      const mrxDevices = JSON.parse(localStorage.getItem('mrx_devices') || '[]').filter(d => d.status === 'OLD_IN_HAND');
      const mrxOldInv = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]').filter(d => d.status === 'OLD_IN_HAND');

      let dataList = [];
      try {
        const res = await deviceService.getDevices({
          status: 'OLD_IN_HAND',
          q: localSearch || globalSearch || '',
          brand: selectedBrand,
          from: selectedDate || '',
          to: selectedDate || ''
        });
        dataList = Array.isArray(res) ? res : (res?.data || []);
      } catch (e) {}

      const deletedIds = new Set(JSON.parse(localStorage.getItem('mrx_deleted_device_ids') || '[]').map(String));

      const rawCombined = [...cancelledItems, ...mrxDevices, ...mrxOldInv, ...dataList].filter(item => {
        if (!item) return false;
        const idStr = String(item.id || '');
        const codeStr = String(item.device_code || '');
        if ((idStr && deletedIds.has(idStr)) || (codeStr && deletedIds.has(codeStr))) {
          return false;
        }
        return true;
      });
      const seenFingerprints = new Set();
      const allInHand = [];

      for (const item of rawCombined) {
        if (!item) continue;
        const brand = (item.brand || '').trim().toLowerCase();
        const model = (item.model || '').trim().toLowerCase();
        const amount = Number(item.purchase_amount || item.amount || 0);
        const paidBy = (item.paid_by || item.purchasedBy || '').trim().toLowerCase();
        const date = item.intake_date || item.created_at || item.date || '';

        const fingerprint = item.device_code
          ? `code_${item.device_code}`
          : `${brand}|${model}|${item.storage || ''}|${item.ram || ''}|${amount}|${paidBy}|${date}`;

        if (!seenFingerprints.has(fingerprint)) {
          seenFingerprints.add(fingerprint);
          allInHand.push(item);
        }
      }

      setDevices(allInHand.filter(d => d.status === 'OLD_IN_HAND' || !d.status || d.status === 'Booked' || d.status === 'BOOKED' || d.status === 'Delivered' || d.status === 'Sold'));

      const statsRes = await statsService.getInHandStats({ type: 'OLD_IN_HAND' });
      setStats(statsRes.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      const cancelledItems = JSON.parse(localStorage.getItem('mrx_old_in_hand_stock') || '[]');
      setDevices(cancelledItems);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOldInHandStock();

    const handleSync = () => fetchOldInHandStock();
    window.addEventListener('storage', handleSync);
    window.addEventListener('mrx_inventory_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('mrx_inventory_updated', handleSync);
    };
  }, [localSearch, globalSearch, selectedBrand, selectedDate]);

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

  const filteredDevices = devices.filter(d => {
    if (d.status === 'Booked' || d.status === 'BOOKED' || d.status === 'Delivered' || d.status === 'Sold') return false;
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
  const uniqueModelsCount = new Set(
    filteredDevices
      .map(d => `${d.brand || ''} ${d.model || ''}`.trim().toLowerCase())
      .filter(Boolean)
  ).size;

  const totalStorageGB = filteredDevices.reduce(
    (sum, d) => sum + (Number(d.storage) || 0),
    0
  );

  const totalRamGB = filteredDevices.reduce(
    (sum, d) => sum + (Number(d.ram) || 0),
    0
  );

  const handleExportXls = () => {
    const headers = ['#', 'Device Code', 'Brand', 'Model', 'Storage', 'RAM', 'Color', 'Purchase Amount (Rs)', 'Intake Date', 'Status'];
    const rows = filteredDevices.map((d, idx) => [
      idx + 1,
      d.device_code || d.id,
      d.brand,
      d.model,
      `${d.storage} GB`,
      `${d.ram} GB`,
      d.colour || '-',
      d.purchase_amount,
      d.intake_date || '-',
      d.status || 'OLD_IN_HAND'
    ]);
    exportToXls('Old In-hand Stock Report', headers, rows, `Old_In_Hand_Stock_${new Date().toISOString().slice(0, 10)}.xls`);
  };

  const handleExportPdf = () => {
    const headers = ['#', 'Brand', 'Model', 'Storage', 'RAM', 'Color', 'Amount (Rs)', 'Status'];
    const rows = filteredDevices.map((d, idx) => [
      idx + 1,
      d.brand,
      d.model,
      `${d.storage} GB`,
      `${d.ram} GB`,
      d.colour || '-',
      `Rs. ${d.purchase_amount}`,
      d.status || 'OLD_IN_HAND'
    ]);
    const totalVal = filteredDevices.reduce((sum, d) => sum + (Number(d.purchase_amount) || 0), 0);
    setExportModalConfig({
      isOpen: true,
      title: 'Old In-hand Stock PDF Report',
      headers,
      rows,
      filename: `Old_In_Hand_Stock_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      summaryInfo: [
        { label: 'Total Stock Value', value: `Rs. ${totalVal.toLocaleString()}`, color: '#0284c7' }
      ]
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>Old In-hand Stock</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            Pre-existing / acquired mobile devices ready for customer sale • {selectedDate ? `Date: ${selectedDate}` : 'All Stock'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExportXls} className="btn-secondary" title="Export Excel (.xls)">
            <Download size={15} color="#0284c7" /> Excel (.xls)
          </button>
          <button onClick={handleExportPdf} className="btn-secondary" title="Export PDF">
            <FileText size={15} color="#dc2626" /> PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KPICard 
          title="Old In-hand Units" 
          value={filteredDevices.length} 
          icon={Smartphone}
          iconBg="#e0f2fe"
          iconColor="#0284c7"
        />
        <KPICard 
          title="Unique Models" 
          value={uniqueModelsCount} 
          icon={Layers}
          iconBg="#ecfdf5"
          iconColor="#059669"
        />
      </div>

      {/* Filter toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ width: '280px' }}>
          <Search size={16} color="#64748b" />
          <input 
            type="text" 
            placeholder="Search old in-hand devices..." 
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={handleClearInventory}
            className="btn-secondary"
            style={{ 
              backgroundColor: '#fef2f2', 
              color: '#ef4444', 
              borderColor: '#fca5a5',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Clear table data"
          >
            <Trash2 size={14} color="#ef4444" />
            Clear Inventory
          </button>

          <select 
            className="form-control" 
            style={{ width: '180px' }}
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="All Brands">All Brands</option>
            <option value="Apple">Apple</option>
            <option value="Samsung">Samsung</option>
            <option value="OnePlus">OnePlus</option>
            <option value="Xiaomi">Xiaomi</option>
          </select>
        </div>
      </div>

      {/* Table: Brand, Model, Storage, RAM, Color Name, Paid Amount, Purchased By, Date Added, Action (Sell) */}
      {/* IMEI is omitted per PRD */}
      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Storage</th>
              <th>RAM</th>
              <th>Color Name</th>
              <th>Purchased By</th>
              <th>Date Added</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Loading stock...
                </td>
              </tr>
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No Old In-hand devices available.
                </td>
              </tr>
            ) : (
              filteredDevices.map((d) => {
                const isBooked = d.status === 'Booked' || d.status === 'BOOKED';
                const isDelivered = d.status === 'Delivered';
                const isSold = d.status === 'Sold';
                const showNewDetails = isBooked || isDelivered || isSold;

                const displayBrand = showNewDetails ? (d.newBrand || d.brand) : d.brand;
                const displayModel = showNewDetails ? (d.newModel || d.model) : d.model;
                const displayStorage = showNewDetails ? (d.newStorage || d.storage) : d.storage;
                const displayRam = showNewDetails ? (d.newRam || d.ram) : d.ram;
                const displayColor = showNewDetails ? (d.newColor || d.colour) : d.colour;
                const displayPurchasedBy = showNewDetails ? (d.newPurchasedBy || d.paid_by) : d.paid_by;

                return (
                  <tr key={d.id}>
                    <td data-label="Image">
                      {d.images && d.images.length > 1 ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <img 
                            src={d.images[0]} 
                            alt="Front" 
                            className="device-thumb" 
                            onClick={() => setExpandedImage(d.images[0])}
                            style={{ cursor: 'zoom-in' }}
                            title="Click to zoom Front View"
                          />
                          <img 
                            src={d.images[1]} 
                            alt="Back" 
                            className="device-thumb" 
                            onClick={() => setExpandedImage(d.images[1])}
                            style={{ cursor: 'zoom-in' }}
                            title="Click to zoom Back View"
                          />
                        </div>
                      ) : (
                        <img 
                          src={d.image_url || 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=100'} 
                          alt={displayModel} 
                          className="device-thumb" 
                          onClick={() => setExpandedImage(d.image_url || 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=100')}
                          style={{ cursor: 'zoom-in' }}
                          title="Click to zoom photo"
                        />
                      )}
                    </td>

                    <td data-label="Brand" style={{ fontWeight: 700 }}>{displayBrand}</td>
                    <td data-label="Model">{displayModel}</td>
                    <td data-label="Storage">{displayStorage} GB</td>
                    <td data-label="RAM">{displayRam} GB</td>
                    <td data-label="Color Name"><span style={{ fontWeight: 600 }}>{displayColor || '-'}</span></td>
                    <td data-label="Purchased By"><span style={{ color: '#0284c7', fontWeight: 600 }}>{displayPurchasedBy || 'Rohit'}</span></td>
                    <td data-label="Date Added">{d.intake_date ? String(d.intake_date).slice(0, 10) : 'Today'}</td>
                    <td data-label="Action" style={{ textAlign: 'center' }}>
                      {isSold ? (
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={14} /> Sold ✔️
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenBookModal(d)}
                            style={{ background: '#f59e0b', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}
                            title="Exchange mobile device (Transfers to Booked & Exchange)"
                          >
                            Exchange
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(d)}
                            style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Edit device specs"
                          >
                            <Edit size={13} /> Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Device Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', margin: 0 }}>Edit Old In-hand Device</h2>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', margin: 0 }}>Update stock specifications and purchasing details.</p>
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
                  <label className="form-label">Purchased By *</label>
                  <input type="text" className="form-control" value={editForm.paid_by} onChange={(e) => setEditForm({ ...editForm, paid_by: e.target.value })} required />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Purchase Price (₹) *</label>
                <input type="number" className="form-control" value={editForm.purchase_amount} onChange={(e) => setEditForm({ ...editForm, purchase_amount: e.target.value })} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 24px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book New Device Modal (Triggered by clicking Exchange on an Old In-hand item) */}
      {isBookModalOpen && selectedDeviceForExchange && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'sticky', top: 0, background: '#fff', zIndex: 10, paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', margin: 0 }}>Book New Device for Exchange</h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', margin: 0 }}>Enter booking details for the new device to complete the exchange transaction.</p>
              </div>
              <button onClick={() => setIsBookModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
            </div>

            <form onSubmit={handleBookSubmit}>
              {/* SECTION 1: Exchange Old Phone (Pre-filled from selected old in-hand device) */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#334155', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🔄 Selected Old Phone Details</span>
                  <button 
                    type="button" 
                    onClick={() => setIsCameraOpen(true)} 
                    className="btn-secondary" 
                    style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', fontWeight: 700 }}
                  >
                    <Camera size={14} /> {bookForm.oldImage ? 'Change Photo' : 'Photo Option'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {bookForm.oldImage && (
                    <div 
                      onClick={() => setExpandedImage(bookForm.oldImage)}
                      title="Click photo to zoom"
                      style={{ width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #0284c7', flexShrink: 0, cursor: 'zoom-in', position: 'relative' }}
                    >
                      <img src={bookForm.oldImage} alt="Old Phone" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: 0, inset: 'auto 0 0 0', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '9px', textAlign: 'center', padding: '2px 0', fontWeight: 700 }}>🔍 Zoom</div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '13px', width: '100%' }}>
                    <div><strong>Old Brand:</strong> {bookForm.oldBrand}</div>
                    <div><strong>Old Model:</strong> {bookForm.oldModel}</div>
                    <div><strong>Storage / RAM:</strong> {bookForm.oldStorage} GB / {bookForm.oldRam} GB</div>
                    <div><strong>Evaluated By:</strong> {bookForm.oldPayBy}</div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Booking New Phone */}
              <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0369a1', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📱 Booking New Phone Details
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* Customer Name placed BEFORE Exchange Value */}
                  <div>
                    <label className="form-label">Customer Name *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Enter customer name" 
                      value={bookForm.customerName || ''} 
                      onChange={(e) => setBookForm({ ...bookForm, customerName: e.target.value })} 
                      required 
                    />
                  </div>

                  <div>
                    <label className="form-label">Exchange Value (₹) *</label>
                    <input type="number" className="form-control" placeholder="₹ Trade valuation" value={bookForm.exchangeValue} onChange={(e) => setBookForm({ ...bookForm, exchangeValue: e.target.value })} required />
                  </div>

                  <div>
                    <label className="form-label">New Phone Brand *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Enter brand name / remarks (e.g. Apple, Samsung)" 
                      value={bookForm.newBrand} 
                      onChange={(e) => setBookForm({ ...bookForm, newBrand: e.target.value })} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="form-label">New Phone Model *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Enter model name / remarks (e.g. iPhone 15 Pro)" 
                      value={bookForm.newModel} 
                      onChange={(e) => setBookForm({ ...bookForm, newModel: e.target.value })} 
                      required 
                    />
                  </div>

                  <div>
                    <label className="form-label">Storage *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Enter storage / remarks (e.g. 128 GB)" 
                      value={bookForm.newStorage} 
                      onChange={(e) => setBookForm({ ...bookForm, newStorage: e.target.value })} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="form-label">RAM *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Enter RAM / remarks (e.g. 8 GB)" 
                      value={bookForm.newRam} 
                      onChange={(e) => setBookForm({ ...bookForm, newRam: e.target.value })} 
                      required 
                    />
                  </div>

                  {/* Pay By field is separate */}
                  <div>
                    <label className="form-label">Pay By (Payer / Account) *</label>
                    <input type="text" className="form-control" placeholder="Enter payer / account (e.g. Jeet, Sonal, Staff)" value={bookForm.newPayBy} onChange={(e) => setBookForm({ ...bookForm, newPayBy: e.target.value })} required />
                  </div>

                  <div>
                    <label className="form-label">Platform *</label>
                    <select className="form-control" value={bookForm.platform} onChange={(e) => setBookForm({ ...bookForm, platform: e.target.value })}>
                      <option value="Offline / Store">Offline / Store</option>
                      <option value="Website">Website</option>
                      <option value="Amazon">Amazon</option>
                      <option value="Flipkart">Flipkart</option>
                      <option value="Others">Others</option>
                    </select>
                    <div style={{ marginTop: '8px' }}>
                      <label className="form-label" style={{ fontSize: '11px', color: '#64748b' }}>Platform / Order Remarks</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Enter platform remarks / order ID details" 
                        value={bookForm.platformRemarks} 
                        onChange={(e) => setBookForm({ ...bookForm, platformRemarks: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Purchased Amount (Paid ₹) *</label>
                    <input type="number" className="form-control" placeholder="₹ Amount paid" value={bookForm.purchasedAmount} onChange={(e) => setBookForm({ ...bookForm, purchasedAmount: e.target.value })} required />
                  </div>

                  <div>
                    <label className="form-label">Via (Cash/Card/UPI) *</label>
                    <select className="form-control" value={bookForm.via} onChange={(e) => setBookForm({ ...bookForm, via: e.target.value })}>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Account ID / UTR</label>
                    <input type="text" className="form-control" placeholder="Enter account ID / Transaction ref" value={bookForm.accountId} onChange={(e) => setBookForm({ ...bookForm, accountId: e.target.value })} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" onClick={() => setIsBookModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 24px' }}>Submit Booking</button>
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

      {/* Fullscreen Expandable Image Lightbox Modal */}
      {expandedImage && (
        <div 
          className="modal-overlay" 
          onClick={() => setExpandedImage(null)} 
          style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)', cursor: 'zoom-out', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setExpandedImage(null)}
              style={{ position: 'absolute', top: '-40px', right: '0', background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              title="Close Preview"
            >
              <X size={28} />
            </button>
            <img 
              src={expandedImage} 
              alt="Expanded Preview" 
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', border: '2px solid #ffffff' }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
