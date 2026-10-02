import React, { useState } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  Wallet, 
  DollarSign, 
  Percent, 
  Plus, 
  Home, 
  Download, 
  Users, 
  X, 
  Target,
  Smartphone,
  ChevronDown,
  ChevronUp,
  BookOpen,
  UserCheck,
  CheckCircle,
  Tag,
  ShieldCheck,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { CurrencyAmount } from '../components/common/UIComponents';
import { useOutletContext, useNavigate } from 'react-router-dom';
import PdfExportModal from '../components/common/PdfExportModal';

import { expenseService, saleService, deviceService } from '../services/api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function ProfitExpenseAndStatistic() {
  const navigate = useNavigate();
  const { globalSearch, selectedDate } = useOutletContext() || {};
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'profit' | 'expenses' | 'statistics' | 'booking_staff_expenses'
  const [selectedAdmin, setSelectedAdmin] = useState('All Super Admins');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Dropdown option for Booking & Staff Expenses: 'book' (Book) or 'staff' (Staff)
  const [expenseViewType, setExpenseViewType] = useState('book');
  const [expandedPayer, setExpandedPayer] = useState(null);
  const [openEvaluateMenuId, setOpenEvaluateMenuId] = useState(null);

  // Persistent Evaluation State (Paid by Jeet / Paid by Sonal)
  const [evaluations, setEvaluations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mrx_expense_evaluations') || '{}');
    } catch (e) {
      return {};
    }
  });

  // Dynamic Super Admins List (Only actual Super Admins: Jeet & Sonal)
  const superAdminsList = React.useMemo(() => {
    try {
      const storedMembers = JSON.parse(localStorage.getItem('mrx_team_members') || '[]');
      const admins = storedMembers
        .filter(m => m.role === 'SUPERADMIN' || m.isSuperAdmin)
        .map(m => m.name);
      if (admins.length > 0) return ['All Super Admins', ...new Set(admins)];
    } catch (e) {}
    return ['All Super Admins', 'Jeet Khubchandani', 'Sonal Wadwani'];
  }, []);

  const handleSetEvaluation = (key, superAdminName) => {
    const updated = {
      ...evaluations,
      [key]: superAdminName ? {
        evaluatedBy: superAdminName,
        status: `Paid by ${superAdminName}`,
        evaluatedAt: new Date().toISOString()
      } : null
    };
    if (!superAdminName) {
      delete updated[key];
    }
    setEvaluations(updated);
    localStorage.setItem('mrx_expense_evaluations', JSON.stringify(updated));
    setOpenEvaluateMenuId(null);
    window.dispatchEvent(new Event('mrx_evaluations_updated'));
  };

  // Export PDF Dialogue Modal State
  const [exportModalConfig, setExportModalConfig] = useState({
    isOpen: false,
    title: '',
    headers: [],
    rows: [],
    filename: '',
    summaryInfo: []
  });

  // Add Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: 'Shop Rent',
    remarks: ''
  });

  const [phoneProfits, setPhoneProfits] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [exchanges, setExchanges] = useState([]);

  const loadData = async () => {
    try {
      const [salesRes, expRes, devRes] = await Promise.all([
        saleService.getSales().catch(() => ({ data: [] })),
        expenseService.getExpenses().catch(() => ({ data: [] })),
        deviceService.getDevices().catch(() => [])
      ]);

      const localSales = JSON.parse(localStorage.getItem('mrx_sales') || '[]');
      const remoteSales = salesRes?.data || [];
      const combinedSalesMap = new Map();
      [...remoteSales, ...localSales].forEach(s => {
        if (!s) return;
        const actualAmount = Number(s.selling || s.selling_price || s.actualAmount || s.actual_amount || s.totalAmount || s.soldPrice || s.ppu || 0);
        const purchaseCost = Number(s.purchase || s.purchase_amount || s.oldAmount || s.pv || s.boughtCost || s.costPrice || 0);
        const bevVal = Number(s.exchangeValue || s.bev || s.newAmount || 0);
        const repairVal = Number(s.repair_cost || s.repairCost || 0);
        
        let perMobileProfit = 0;
        if (s.profit !== undefined && s.profit !== null && !isNaN(Number(s.profit)) && Number(s.profit) !== 0) {
          perMobileProfit = Number(s.profit);
        } else {
          perMobileProfit = actualAmount - (purchaseCost + bevVal + repairVal);
        }

        const norm = {
          ...s,
          id: s.id || s.sale_code || `SALE-${s.brand}_${s.model}_${actualAmount}_${s.date}`,
          admin: s.admin || s.admin_name || s.soldBy || s.sold_by || 'Jeet Khubchandani',
          brand: s.brand || 'Device',
          model: s.model || 'Mobile',
          actualAmount: actualAmount,
          selling: actualAmount,
          ppu: actualAmount,
          purchase: purchaseCost,
          purchase_amount: purchaseCost,
          pv: purchaseCost,
          exchangeValue: bevVal,
          bev: bevVal,
          repair_cost: repairVal,
          profit: perMobileProfit,
          unitProfit: perMobileProfit,
          date: s.date || s.sale_date || new Date().toISOString().split('T')[0]
        };

        const key = norm.id || `${norm.brand}_${norm.model}_${norm.selling}_${norm.date}`;
        combinedSalesMap.set(String(key), norm);
      });
      setPhoneProfits(Array.from(combinedSalesMap.values()));

      const localExpenses = JSON.parse(localStorage.getItem('mrx_expenses') || '[]');
      const remoteExpenses = expRes?.data || [];
      const mergedExpMap = new Map();
      [...remoteExpenses, ...localExpenses].forEach(e => {
        if (e) {
          const key = e.id || e.expense_code || `${e.category || e.type}_${e.amount}_${e.expense_date || e.date}`;
          mergedExpMap.set(String(key), {
            ...e,
            date: e.date || e.expense_date || new Date().toISOString().split('T')[0],
            admin: e.admin || e.admin_name || 'Jeet',
            type: e.type || e.category || 'Shop Rent',
            remarks: e.remarks || ''
          });
        }
      });
      setExpenses(Array.from(mergedExpMap.values()));

      // Deduplicate and merge Add Inventory devices from API and localStorage
      const localOldInv = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]');
      const localDev = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
      const apiDev = Array.isArray(devRes) ? devRes : (devRes?.data || []);

      const combinedDevMap = new Map();
      [...localOldInv, ...localDev, ...apiDev].forEach(d => {
        if (d) {
          const key = d.id || d.device_code || `${d.brand}_${d.model}_${d.purchase_amount}_${d.date || d.intake_date}`;
          combinedDevMap.set(String(key), d);
        }
      });
      setAllDevices(Array.from(combinedDevMap.values()));

      // Deduplicate and load Booking / Exchange records
      const localExchanges = JSON.parse(localStorage.getItem('mrx_exchanges') || '[]');
      const localOldStock = JSON.parse(localStorage.getItem('mrx_old_in_hand_stock') || '[]').filter(s => s.status === 'Booked');
      const combinedExchMap = new Map();
      [...localExchanges, ...localOldStock].forEach(e => {
        if (e) {
          const key = e.id || e.exchangeId || `${e.newBrand || e.brand}_${e.newModel || e.model}_${e.newAmount || e.purchasedAmount}_${e.date}`;
          combinedExchMap.set(String(key), e);
        }
      });
      setExchanges(Array.from(combinedExchMap.values()));

      try {
        setEvaluations(JSON.parse(localStorage.getItem('mrx_expense_evaluations') || '{}'));
      } catch (e) {}

    } catch (err) {
      console.error("Error loading profit and expense data:", err);
      try {
        const localSales = JSON.parse(localStorage.getItem('mrx_sales') || '[]');
        const normLocalSales = localSales.map(s => {
          if (!s) return null;
          const sellingVal = Number(s.selling || s.selling_price || s.soldPrice || s.totalAmount || s.unitPrice || s.ppu || 0);
          const buyVal = Number(s.purchase || s.purchase_amount || s.oldAmount || s.pv || s.boughtCost || 0);
          const bevVal = Number(s.bev || s.exchangeValue || s.newAmount || 0);
          const repairVal = Number(s.repair_cost || s.repairCost || 0);
          let calculatedProfit = 0;
          if (s.profit !== undefined && s.profit !== null && !isNaN(Number(s.profit)) && Number(s.profit) !== 0) {
            calculatedProfit = Number(s.profit);
          } else if (s.unitProfit !== undefined && s.unitProfit !== null && !isNaN(Number(s.unitProfit))) {
            calculatedProfit = Number(s.unitProfit);
          } else {
            calculatedProfit = sellingVal - (buyVal + bevVal + repairVal);
          }
          return {
            ...s,
            id: s.id || s.sale_code || `SALE-${s.brand}_${s.model}_${sellingVal}_${s.date}`,
            admin: s.admin || s.admin_name || s.soldBy || s.sold_by || 'Jeet Khubchandani',
            brand: s.brand || 'Device',
            model: s.model || 'Mobile',
            actualAmount: sellingVal,
            selling: sellingVal,
            ppu: sellingVal,
            purchase: buyVal,
            purchase_amount: buyVal,
            pv: buyVal,
            exchangeValue: bevVal,
            bev: bevVal,
            repair_cost: repairVal,
            profit: calculatedProfit,
            unitProfit: calculatedProfit,
            date: s.date || s.sale_date || new Date().toISOString().split('T')[0]
          };
        }).filter(Boolean);
        setPhoneProfits(normLocalSales);
        setExpenses(JSON.parse(localStorage.getItem('mrx_expenses') || '[]'));

        const localOldInv = JSON.parse(localStorage.getItem('mrx_old_inventory') || '[]');
        const localDev = JSON.parse(localStorage.getItem('mrx_devices') || '[]');
        const combinedDevMap = new Map();
        [...localOldInv, ...localDev].forEach(d => {
          if (d) {
            const key = d.id || d.device_code || `${d.brand}_${d.model}_${d.purchase_amount}_${d.date || d.intake_date}`;
            combinedDevMap.set(String(key), d);
          }
        });
        setAllDevices(Array.from(combinedDevMap.values()));

        const localExchanges = JSON.parse(localStorage.getItem('mrx_exchanges') || '[]');
        setExchanges(localExchanges);
        setEvaluations(JSON.parse(localStorage.getItem('mrx_expense_evaluations') || '{}'));
      } catch (e) {}
    }
  };

  React.useEffect(() => {
    loadData();

    const handleSync = () => loadData();
    window.addEventListener('storage', handleSync);
    window.addEventListener('mrx_sales_updated', handleSync);
    window.addEventListener('mrx_expenses_updated', handleSync);
    window.addEventListener('mrx_inventory_updated', handleSync);
    window.addEventListener('mrx_exchanges_updated', handleSync);
    window.addEventListener('mrx_evaluations_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('mrx_sales_updated', handleSync);
      window.removeEventListener('mrx_expenses_updated', handleSync);
      window.removeEventListener('mrx_inventory_updated', handleSync);
      window.removeEventListener('mrx_exchanges_updated', handleSync);
      window.removeEventListener('mrx_evaluations_updated', handleSync);
    };
  }, []);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingExpense) return;
    setIsSubmittingExpense(true);
    try {
      const adminName = selectedAdmin === 'All Super Admins' ? 'Jeet Khubchandani' : selectedAdmin;
      const expPayload = {
        date: expenseForm.date,
        expense_date: expenseForm.date,
        admin: adminName,
        admin_name: adminName,
        type: expenseForm.type,
        category: expenseForm.type === 'Salary' ? 'SALARY' : (expenseForm.type === 'Repairing Cost' ? 'REPAIRING_COST' : 'OTHER'),
        amount: Number(expenseForm.amount) || 0,
        remarks: expenseForm.remarks || 'Business expense'
      };
      await expenseService.createExpense(expPayload);
      alert('Expense added successfully & synced!');
      setIsExpenseModalOpen(false);
      setExpenseForm({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        type: 'Shop Rent',
        remarks: ''
      });
      window.dispatchEvent(new Event('mrx_expenses_updated'));
      window.dispatchEvent(new Event('storage'));
      await loadData();
    } catch (err) {
      alert('Failed to add expense: ' + (err.message || 'Server error'));
    } finally {
      setIsSubmittingExpense(false);
    }
  };

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

  const matchesAdmin = (itemAdmin, selAdmin) => {
    if (!selAdmin || selAdmin === 'All Admins' || selAdmin === 'All Super Admins' || selAdmin === 'ALL') return true;
    if (!itemAdmin) return true;
    const itemLower = String(itemAdmin).toLowerCase();
    const selLower = String(selAdmin).toLowerCase();
    if (itemLower === selLower) return true;
    if (selLower.includes('jeet') && itemLower.includes('jeet')) return true;
    if (selLower.includes('sonal') && itemLower.includes('sonal')) return true;
    return false;
  };

  const filteredProfits = (phoneProfits || []).filter(p => {
    if (!p) return false;
    if (!matchesAdmin(p.admin || p.sold_by || p.soldBy, selectedAdmin)) return false;
    if (selectedDate) {
      const pYMD = toYMD(p.date);
      const selYMD = toYMD(selectedDate);
      if (pYMD && selYMD && pYMD !== selYMD) return false;
    }
    if (fromDate) {
      const pYMD = toYMD(p.date);
      const fYMD = toYMD(fromDate);
      if (pYMD && fYMD && pYMD < fYMD) return false;
    }
    if (toDate) {
      const pYMD = toYMD(p.date);
      const tYMD = toYMD(toDate);
      if (pYMD && tYMD && pYMD > tYMD) return false;
    }
    const q = (globalSearch || '').trim().toLowerCase();
    if (q) {
      const matchModel = (p.model || '').toLowerCase().includes(q);
      const matchBrand = (p.brand || '').toLowerCase().includes(q);
      if (!matchModel && !matchBrand) return false;
    }
    return true;
  });

  const filteredExpenses = (expenses || []).filter(e => {
    if (!e) return false;
    if (!matchesAdmin(e.admin || e.admin_name, selectedAdmin)) return false;
    if (selectedDate) {
      const eYMD = toYMD(e.date || e.expense_date);
      const selYMD = toYMD(selectedDate);
      if (eYMD && selYMD && eYMD !== selYMD) return false;
    }
    if (fromDate) {
      const eYMD = toYMD(e.date || e.expense_date);
      const fYMD = toYMD(fromDate);
      if (eYMD && fYMD && eYMD < fYMD) return false;
    }
    if (toDate) {
      const eYMD = toYMD(e.date || e.expense_date);
      const tYMD = toYMD(toDate);
      if (eYMD && tYMD && eYMD > tYMD) return false;
    }
    const q = (globalSearch || '').trim().toLowerCase();
    if (q) {
      const matchType = (e.type || e.category || '').toLowerCase().includes(q);
      const matchRemarks = (e.remarks || '').toLowerCase().includes(q);
      const matchAdmin = (e.admin || e.admin_name || '').toLowerCase().includes(q);
      if (!matchType && !matchRemarks && !matchAdmin) return false;
    }
    return true;
  });

  const filteredDevices = allDevices.filter(d => {
    if (!matchesAdmin(d.paid_by || d.purchasedBy || d.admin, selectedAdmin)) return false;
    if (selectedDate) {
      const dYMD = toYMD(d.intake_date || d.date || d.created_at);
      const selYMD = toYMD(selectedDate);
      if (dYMD && selYMD && dYMD !== selYMD) return false;
    }
    if (fromDate) {
      const dYMD = toYMD(d.intake_date || d.date || d.created_at);
      const fYMD = toYMD(fromDate);
      if (dYMD && fYMD && dYMD < fYMD) return false;
    }
    if (toDate) {
      const dYMD = toYMD(d.intake_date || d.date || d.created_at);
      const tYMD = toYMD(toDate);
      if (dYMD && tYMD && dYMD > tYMD) return false;
    }
    const q = (globalSearch || '').trim().toLowerCase();
    if (q) {
      const matchModel = (d.model || '').toLowerCase().includes(q);
      const matchBrand = (d.brand || '').toLowerCase().includes(q);
      const matchPayer = (d.paid_by || d.purchasedBy || '').toLowerCase().includes(q);
      const matchColor = (d.color || d.colour || '').toLowerCase().includes(q);
      if (!matchModel && !matchBrand && !matchPayer && !matchColor) return false;
    }
    return true;
  });

  // 1. PV (Purchase Value / Paid Amount from Add Inventory)
  const totalPV = filteredDevices.reduce((sum, d) => sum + (Number(d.purchase_amount || d.amount || d.paidAmount || d.pv) || 0), 0);
  const totalInvestment = totalPV;

  // 2. Selling Revenue (PPU)
  const totalSelling = filteredProfits.reduce((sum, p) => sum + (Number(p.ppu || p.selling || p.selling_price || p.soldPrice || p.totalAmount) || 0), 0);

  // 3. Profit Formula = PPU - (PV + BEV)
  const totalProfit = filteredProfits.reduce((sum, p) => {
    const ppu = Number(p.ppu || p.selling || p.selling_price || p.soldPrice || p.totalAmount) || 0;
    const pv = Number(p.pv || p.oldAmount || p.purchase_amount || p.purchase) || 0;
    const bev = Number(p.bev || p.exchangeValue || p.newAmount) || 0;
    const units = Number(p.units || p.unit || 1);

    let unitProfit = 0;
    if (p.unitProfit !== undefined && p.unitProfit !== null && !isNaN(p.unitProfit)) {
      unitProfit = Number(p.unitProfit);
    } else if (p.profit !== undefined && p.profit !== null && !isNaN(p.profit)) {
      unitProfit = Number(p.profit);
    } else {
      unitProfit = ppu - (pv + bev + (Number(p.repair_cost || p.repairCost) || 0));
    }
    return sum + (unitProfit * units);
  }, 0);

  // 4. Expenses = Operational Expenses (Rent, Salary, Bills, etc.)
  const operationalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalExpensesAmount = operationalExpenses;
  const finalProfit = totalProfit - operationalExpenses;

  // Investment Base for ROI calculation
  const investmentBase = totalInvestment > 0 ? totalInvestment : (totalSelling > 0 ? totalSelling : 100000);
  const roi = investmentBase > 0 ? ((finalProfit / investmentBase) * 100).toFixed(2) : '0.00';

  // -------------------------------------------------------------
  // AGGREGATION 1: STAFF EXPENSES (Add Inventory Payers)
  // -------------------------------------------------------------
  const staffGroups = {};
  filteredDevices.forEach(d => {
    const rawPayer = (d.paid_by || d.purchasedBy || d.paidBy || d.admin || 'General Staff').trim();
    const payer = rawPayer.charAt(0).toUpperCase() + rawPayer.slice(1);
    if (!staffGroups[payer]) {
      staffGroups[payer] = {
        payerName: payer,
        totalAmountPaid: 0,
        mobileCount: 0,
        mobiles: []
      };
    }
    const amount = Number(d.purchase_amount || d.amount || d.paidAmount || 0);
    staffGroups[payer].totalAmountPaid += amount;
    staffGroups[payer].mobileCount += 1;
    staffGroups[payer].mobiles.push({
      id: d.id || d.device_code || Math.random().toString(),
      brand: d.brand || 'Unknown Brand',
      model: d.model || 'Unknown Model',
      ram: d.ram ? `${d.ram} GB` : '-',
      storage: d.storage ? `${d.storage} GB` : '-',
      color: d.color || d.colour || '-',
      amount: amount,
      date: d.date || d.intake_date || d.created_at || '-',
      remarks: d.remarks || d.accessories || d.condition || 'No remarks',
      status: d.status || 'Active in Inventory',
      image: d.image_url || (Array.isArray(d.images) && d.images[0]) || ''
    });
  });

  const staffAggregatedList = Object.values(staffGroups).sort((a, b) => b.totalAmountPaid - a.totalAmountPaid);
  const totalStaffPaidAmount = staffAggregatedList.reduce((sum, s) => sum + s.totalAmountPaid, 0);
  const totalStaffMobilesCount = staffAggregatedList.reduce((sum, s) => sum + s.mobileCount, 0);

  // -------------------------------------------------------------
  // AGGREGATION 2: BOOK EXPENSES (Booking / Exchange Payers)
  // -------------------------------------------------------------
  const filteredExchanges = exchanges.filter(e => {
    if (!matchesAdmin(e.newPurchasedBy || e.oldPurchasedBy || e.paid_by, selectedAdmin)) return false;
    if (selectedDate) {
      const eYMD = toYMD(e.date || e.bookingDate);
      const selYMD = toYMD(selectedDate);
      if (eYMD && selYMD && eYMD !== selYMD) return false;
    }
    if (fromDate) {
      const eYMD = toYMD(e.date || e.bookingDate);
      const fYMD = toYMD(fromDate);
      if (eYMD && fYMD && eYMD < fYMD) return false;
    }
    if (toDate) {
      const eYMD = toYMD(e.date || e.bookingDate);
      const tYMD = toYMD(toDate);
      if (eYMD && tYMD && eYMD > tYMD) return false;
    }
    const q = (globalSearch || '').trim().toLowerCase();
    if (q) {
      const matchPayer = (e.newPurchasedBy || e.newPayBy || e.paid_by || e.customerName || e.oldPurchasedBy || '').toLowerCase().includes(q);
      const matchNewBrand = (e.newBrand || e.brand || '').toLowerCase().includes(q);
      const matchNewModel = (e.newModel || e.model || '').toLowerCase().includes(q);
      const matchOldBrand = (e.oldBrand || '').toLowerCase().includes(q);
      const matchOldModel = (e.oldModel || '').toLowerCase().includes(q);
      const matchPlatform = (e.platform || '').toLowerCase().includes(q);
      if (!matchPayer && !matchNewBrand && !matchNewModel && !matchOldBrand && !matchOldModel && !matchPlatform) return false;
    }
    return true;
  });

  const bookGroups = {};
  filteredExchanges.forEach(e => {
    const rawPayBy = (e.newPurchasedBy || e.newPayBy || e.paid_by || e.customerName || e.oldPurchasedBy || e.soldBy || 'General Booking').trim();
    const payBy = rawPayBy.charAt(0).toUpperCase() + rawPayBy.slice(1);
    if (!bookGroups[payBy]) {
      bookGroups[payBy] = {
        payByName: payBy,
        totalAmountPaid: 0,
        totalExchangeValue: 0,
        mobileCount: 0,
        mobiles: []
      };
    }
    const amount = Number(e.newAmount !== undefined && e.newAmount !== '' ? e.newAmount : (e.purchasedAmount || e.amount || 0));
    const exVal = Number(e.exchangeValue || 0);
    bookGroups[payBy].totalAmountPaid += amount;
    bookGroups[payBy].totalExchangeValue += exVal;
    bookGroups[payBy].mobileCount += 1;
    bookGroups[payBy].mobiles.push({
      id: e.id || e.exchangeId || Math.random().toString(),
      newBrand: e.newBrand || e.brand || 'Unknown Brand',
      newModel: e.newModel || e.model || 'Unknown Model',
      newRam: e.newRam ? `${e.newRam} GB` : (e.ram ? `${e.ram} GB` : '-'),
      newStorage: e.newStorage ? `${e.newStorage} GB` : (e.storage ? `${e.storage} GB` : '-'),
      oldBrand: e.oldBrand || '-',
      oldModel: e.oldModel || '-',
      purchasedAmount: amount,
      exchangeValue: exVal,
      platform: e.platform || 'Offline / Store',
      platformRemarks: e.platformRemarks || e.remarks || '-',
      via: e.via || e.paymentType || 'Cash',
      accountId: e.accountId || e.utr || '-',
      date: e.date || e.bookingDate || '-',
      status: e.status || 'Booked'
    });
  });

  const bookAggregatedList = Object.values(bookGroups).sort((a, b) => b.totalAmountPaid - a.totalAmountPaid);
  const totalBookPaidAmount = bookAggregatedList.reduce((sum, b) => sum + b.totalAmountPaid, 0);
  const totalBookMobilesCount = bookAggregatedList.reduce((sum, b) => sum + b.mobileCount, 0);
  const totalBookExchangeValue = bookAggregatedList.reduce((sum, b) => sum + b.totalExchangeValue, 0);

  // PDF Export Handlers
  const openProfitExport = () => {
    const headers = ['#', 'Date', 'Admin', 'Model', 'Brand', 'Purchase Price (Rs)', 'Selling Price (Rs)', 'Profit (Rs)'];
    const rows = filteredProfits.map((item, idx) => [
      idx + 1,
      item.date,
      item.admin,
      item.model,
      item.brand,
      `Rs. ${Number(item.purchase || 0).toLocaleString()}`,
      `Rs. ${Number(item.selling || 0).toLocaleString()}`,
      `Rs. ${Number(item.profit || 0).toLocaleString()}`
    ]);
    setExportModalConfig({
      isOpen: true,
      title: 'Phone-wise Profit Report',
      headers,
      rows,
      filename: `Phone_Profit_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      summaryInfo: [
        { label: 'Total Profit', value: `Rs. ${totalProfit.toLocaleString()}`, color: '#16a34a' },
        { label: 'Total Sales', value: `Rs. ${totalSelling.toLocaleString()}`, color: '#0284c7' }
      ]
    });
  };

  const handleDeleteExpense = (id) => {
    if (window.confirm('Are you sure you want to delete this expense entry?')) {
      const updated = expenses.filter(e => String(e.id) !== String(id));
      setExpenses(updated);
      localStorage.setItem('mrx_expenses', JSON.stringify(updated));
      window.dispatchEvent(new Event('mrx_expenses_updated'));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleClearExpenses = () => {
    if (window.confirm('Are you sure you want to clear all expenses from the register?')) {
      setExpenses([]);
      localStorage.setItem('mrx_expenses', '[]');
      localStorage.removeItem('mrx_expenses_cleared');
      window.dispatchEvent(new Event('mrx_expenses_updated'));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const openExpensesExport = () => {
    const headers = ['#', 'Date', 'Admin', 'Type', 'Amount (Rs)', 'Remarks'];
    const rows = filteredExpenses.map((exp, idx) => [
      idx + 1,
      exp.date,
      exp.admin,
      exp.type,
      `Rs. ${Number(exp.amount || 0).toLocaleString()}`,
      exp.remarks || '-'
    ]);
    setExportModalConfig({
      isOpen: true,
      title: 'Expenses Register Report',
      headers,
      rows,
      filename: `Expenses_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      summaryInfo: [
        { label: 'Total Expenses', value: `Rs. ${totalExpensesAmount.toLocaleString()}`, color: '#ea580c' }
      ]
    });
  };

  const openStaffExport = () => {
    const headers = ['S.No.', 'Name (Staff)', 'Total Spend (Rs)', 'Evaluate By', 'Devices Breakdown'];
    const rows = staffAggregatedList.map((s, idx) => {
      const evalKey = `staff_${s.payerName}`;
      const evalState = evaluations[evalKey];
      return [
        idx + 1,
        s.payerName,
        `Rs. ${s.totalAmountPaid.toLocaleString()}`,
        evalState?.status || 'Pending Evaluation',
        s.mobiles.map(m => `${m.brand} ${m.model} (Rs. ${m.amount.toLocaleString()})`).join(', ')
      ];
    });
    setExportModalConfig({
      isOpen: true,
      title: 'Staff Expenses & Evaluation Report',
      headers,
      rows,
      filename: `Staff_Expenses_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      summaryInfo: [
        { label: 'Total Staff Spend', value: `Rs. ${totalStaffPaidAmount.toLocaleString()}`, color: '#059669' },
        { label: 'Total Mobiles Paid', value: `${totalStaffMobilesCount} Units`, color: '#0284c7' },
        { label: 'Staff Count', value: `${staffAggregatedList.length} Persons`, color: '#64748b' }
      ]
    });
  };

  const openBookExport = () => {
    const headers = ['S.No.', 'Name (Book)', 'Total Spend (Rs)', 'Evaluate By', 'Booked Devices'];
    const rows = bookAggregatedList.map((b, idx) => {
      const evalKey = `book_${b.payByName}`;
      const evalState = evaluations[evalKey];
      return [
        idx + 1,
        b.payByName,
        `Rs. ${b.totalAmountPaid.toLocaleString()}`,
        evalState?.status || 'Pending Evaluation',
        b.mobiles.map(m => `${m.newBrand} ${m.newModel} (Rs. ${m.purchasedAmount.toLocaleString()})`).join(', ')
      ];
    });
    setExportModalConfig({
      isOpen: true,
      title: 'Book Expenses & Evaluation Report',
      headers,
      rows,
      filename: `Book_Expenses_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      summaryInfo: [
        { label: 'Total Book Spend', value: `Rs. ${totalBookPaidAmount.toLocaleString()}`, color: '#0284c7' },
        { label: 'Total Mobiles Booked', value: `${totalBookMobilesCount} Units`, color: '#16a34a' },
        { label: 'Total Exchange Value', value: `Rs. ${totalBookExchangeValue.toLocaleString()}`, color: '#8b5cf6' }
      ]
    });
  };

  const barChartData = {
    labels: ['Investment', 'Selling Amount', 'Profit', 'Expenses', 'Final Profit'],
    datasets: [
      {
        label: 'Amount (in ₹)',
        data: [totalInvestment, totalSelling, totalProfit, totalExpensesAmount, finalProfit],
        backgroundColor: ['#2563eb', '#16a34a', '#0284c7', '#ea580c', '#ec4899'],
        borderRadius: 6,
      }
    ]
  };

  const doughnutData = {
    labels: ['Investment', 'Selling Amount', 'Total Profit', 'Total Expenses', 'Final Profit'],
    datasets: [
      {
        data: [totalInvestment, totalSelling, totalProfit, totalExpensesAmount, Math.max(0, finalProfit)],
        backgroundColor: ['#0284c7', '#16a34a', '#8b5cf6', '#ea580c', '#ec4899'],
        borderWidth: 0,
      }
    ]
  };

  return (
    <div>
      {/* Header & Breadcrumbs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>Profit, Expense and Statistic</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Track investment, expenses, profit and overall business performance.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
          <Home size={14} /> / <span style={{ color: '#0284c7', fontWeight: 600 }}>Profit, Expense and Statistic</span>
        </div>
      </div>

      {/* Top Bar with Super Admin Selector (Only verified Super Admins: Jeet & Sonal) */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
            <ShieldCheck size={14} /> Select Super Admin
          </label>
          <select 
            className="form-control" 
            value={selectedAdmin} 
            onChange={(e) => setSelectedAdmin(e.target.value)}
            style={{ width: '230px', padding: '7px 12px', fontWeight: 700 }}
          >
            {superAdminsList.map(admin => (
              <option key={admin} value={admin}>{admin}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: '4px' }}>From Date</label>
          <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: '160px', padding: '7px 12px' }} />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: '4px' }}>To Date</label>
          <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: '160px', padding: '7px 12px' }} />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button onClick={() => { setSelectedAdmin('All Super Admins'); setFromDate(''); setToDate(''); loadData(); }} className="btn-secondary">Clear</button>
          <button onClick={() => loadData()} className="btn-primary">Apply</button>
        </div>
      </div>

      {/* Tabulation Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: '13px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'overview' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'overview' ? '3px solid #0284c7' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <BarChart2 size={16} /> All Overview
        </button>

        <button
          onClick={() => setActiveTab('profit')}
          style={{
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: '13px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'profit' ? '#0284c7' : '#64748b',
            borderBottom: activeTab === 'profit' ? '3px solid #0284c7' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <TrendingUp size={16} /> Phone-wise Profit
          <span style={{ background: activeTab === 'profit' ? '#0284c7' : '#e2e8f0', color: activeTab === 'profit' ? '#ffffff' : '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
            {filteredProfits.length}
          </span>
        </button>

        <button
          onClick={() => navigate('/expenses')}
          style={{
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: '13px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'expenses' ? '#ea580c' : '#64748b',
            borderBottom: activeTab === 'expenses' ? '3px solid #ea580c' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
          title="Open Operating Expenses Page"
        >
          <Wallet size={16} /> Expenses Register Page
          <span style={{ background: activeTab === 'expenses' ? '#ea580c' : '#e2e8f0', color: activeTab === 'expenses' ? '#ffffff' : '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
            {filteredExpenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('statistics')}
          style={{
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: '13px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'statistics' ? '#8b5cf6' : '#64748b',
            borderBottom: activeTab === 'statistics' ? '3px solid #8b5cf6' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Target size={16} /> Statistics & Analytics
        </button>

        <button
          onClick={() => setActiveTab('booking_staff_expenses')}
          style={{
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: '13px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: activeTab === 'booking_staff_expenses' ? '#059669' : '#64748b',
            borderBottom: activeTab === 'booking_staff_expenses' ? '3px solid #059669' : '3px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Users size={16} /> Booking & Staff Expenses
          <span style={{ background: activeTab === 'booking_staff_expenses' ? '#059669' : '#e2e8f0', color: activeTab === 'booking_staff_expenses' ? '#ffffff' : '#64748b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
            {staffAggregatedList.length + bookAggregatedList.length}
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="kpi-card" style={{ padding: '16px' }}>
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#e0f2fe' }}><TrendingUp size={24} color="#0284c7" /></div>
          <div className="kpi-info">
            <span className="kpi-title" style={{ fontSize: '12px' }}>Total Selling Amount</span>
            <span className="kpi-value" style={{ fontSize: '20px', fontWeight: 800 }}>₹ {totalSelling.toLocaleString()}</span>
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '16px' }}>
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#f3e8ff' }}><BarChart2 size={24} color="#8b5cf6" /></div>
          <div className="kpi-info">
            <span className="kpi-title" style={{ fontSize: '12px' }}>Total Profit</span>
            <span className="kpi-value" style={{ fontSize: '20px', fontWeight: 800, color: '#8b5cf6' }}>₹ {totalProfit.toLocaleString()}</span>
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '16px' }}>
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#ffedd5' }}><Wallet size={24} color="#ea580c" /></div>
          <div className="kpi-info">
            <span className="kpi-title" style={{ fontSize: '12px' }}>Total Expenses</span>
            <span className="kpi-value" style={{ fontSize: '20px', fontWeight: 800, color: '#ea580c' }}>₹ {totalExpensesAmount.toLocaleString()}</span>
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '16px' }}>
          <div className="kpi-icon-wrap" style={{ backgroundColor: finalProfit >= 0 ? '#fce7f3' : '#fee2e2' }}>
            <DollarSign size={24} color={finalProfit >= 0 ? '#ec4899' : '#dc2626'} />
          </div>
          <div className="kpi-info">
            <span className="kpi-title" style={{ fontSize: '12px' }}>Final Net Profit</span>
            <span className="kpi-value" style={{ fontSize: '20px', fontWeight: 800, color: finalProfit >= 0 ? '#ec4899' : '#dc2626' }}>
              {finalProfit >= 0 ? `₹ ${finalProfit.toLocaleString()}` : `-₹ ${Math.abs(finalProfit).toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '16px' }}>
          <div className="kpi-icon-wrap" style={{ backgroundColor: Number(roi) >= 0 ? '#dcfce7' : '#fee2e2' }}>
            <Percent size={24} color={Number(roi) >= 0 ? '#16a34a' : '#dc2626'} />
          </div>
          <div className="kpi-info">
            <span className="kpi-title" style={{ fontSize: '12px' }}>Return (ROI)</span>
            <span className="kpi-value" style={{ fontSize: '20px', fontWeight: 800, color: Number(roi) >= 0 ? '#16a34a' : '#dc2626' }}>
              {roi}%
            </span>
          </div>
        </div>
      </div>

      {/* Tab Content: All Overview */}
      {activeTab === 'overview' && (
        <>
          {/* Main 5 Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #2563eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Investment</span>
                <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '10px' }}><Wallet size={20} /></div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '8px 0 2px' }}>
                <CurrencyAmount amount={totalInvestment} />
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{filteredDevices.length} Mobiles in Add Inventory</span>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #16a34a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Selling Amount</span>
                <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '8px', borderRadius: '10px' }}><DollarSign size={20} /></div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '8px 0 2px' }}>
                <CurrencyAmount amount={totalSelling} />
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>From sold devices in new stock</span>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Profit</span>
                <div style={{ background: '#f0f9ff', color: '#0284c7', padding: '8px', borderRadius: '10px' }}><TrendingUp size={20} /></div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '8px 0 2px' }}>
                <CurrencyAmount amount={totalProfit} />
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Sold price - (bought + repair)</span>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #ea580c' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Expenses</span>
                <div style={{ background: '#fff7ed', color: '#ea580c', padding: '8px', borderRadius: '10px' }}><DollarSign size={20} /></div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '8px 0 2px' }}>
                <CurrencyAmount amount={totalExpensesAmount} />
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{filteredExpenses.length} Expense entries</span>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: `4px solid ${finalProfit >= 0 ? '#10b981' : '#ef4444'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Final Profit</span>
                <div style={{ background: finalProfit >= 0 ? '#ecfdf5' : '#fef2f2', color: finalProfit >= 0 ? '#10b981' : '#ef4444', padding: '8px', borderRadius: '10px' }}><Percent size={20} /></div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: finalProfit >= 0 ? '#10b981' : '#ef4444', margin: '8px 0 2px' }}>
                <CurrencyAmount amount={finalProfit} />
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Profit - Expenses | ROI: {roi}%</span>
            </div>
          </div>

          {/* Dual Table View */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Recent Phone Profits</h3>
                <button onClick={() => setActiveTab('profit')} style={{ color: '#0284c7', background: 'none', border: 'none', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>View All</button>
              </div>
              <div className="table-responsive">
                <table className="custom-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Model</th>
                      <th>Profit (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfits.slice(0, 5).map((p, idx) => (
                      <tr key={p.id || idx}>
                        <td>{p.date}</td>
                        <td style={{ fontWeight: 600 }}>{p.model}</td>
                        <td style={{ fontWeight: 700, color: '#16a34a' }}><CurrencyAmount amount={p.profit} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Recent Expenses</h3>
                <button onClick={() => setActiveTab('expenses')} style={{ color: '#ea580c', background: 'none', border: 'none', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>View All</button>
              </div>
              <div className="table-responsive">
                <table className="custom-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.slice(0, 5).map((e, idx) => (
                      <tr key={e.id || idx}>
                        <td>{e.date}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#fff7ed', color: '#ea580c', fontWeight: 600 }}>{e.type}</span></td>
                        <td style={{ fontWeight: 700, color: '#ef4444' }}><CurrencyAmount amount={e.amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ----------------- TAB: PHONE-WISE PROFIT ----------------- */}
      {activeTab === 'profit' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Phone-wise Profit Records</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>Showing all sold devices and calculated margins.</p>
            </div>
            <button onClick={openProfitExport} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={15} /> Export PDF Report
            </button>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Super Admin</th>
                  <th>Brand & Model</th>
                  <th>Intake Cost (₹)</th>
                  <th>Actual Amount (₹)</th>
                  <th>Per Mobile Profit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfits.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No profit records found.</td></tr>
                ) : (
                  filteredProfits.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>{idx + 1}</td>
                      <td>{item.date}</td>
                      <td style={{ fontWeight: 600 }}>{item.admin}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.model}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{item.brand}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#475569' }}><CurrencyAmount amount={item.purchase !== undefined ? item.purchase : (item.purchase_amount || 0)} /></td>
                      <td style={{ fontWeight: 700, color: '#0284c7' }}><CurrencyAmount amount={item.actualAmount !== undefined ? item.actualAmount : item.selling} /></td>
                      <td style={{ fontWeight: 800, color: item.profit >= 0 ? '#16a34a' : '#ef4444' }}>
                        <CurrencyAmount amount={item.profit} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- TAB: EXPENSES REGISTER ----------------- */}
      {activeTab === 'expenses' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Expenses Register</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0' }}>Log of rent, payroll, repair costs, and miscellaneous disbursements.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                type="button"
                onClick={handleClearExpenses} 
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
                title="Clear expense register data"
              >
                <Trash2 size={14} color="#ef4444" /> Clear Expenses
              </button>
              <button onClick={() => setIsExpenseModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Add Expense
              </button>
              <button onClick={openExpensesExport} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={15} /> Export PDF Report
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Admin</th>
                  <th>Expense Type</th>
                  <th>Amount (₹)</th>
                  <th>Remarks / Description</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No expenses found.</td></tr>
                ) : (
                  filteredExpenses.map((exp, idx) => (
                    <tr key={exp.id || idx}>
                      <td>{idx + 1}</td>
                      <td>{exp.date}</td>
                      <td style={{ fontWeight: 600 }}>{exp.admin}</td>
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
                          {exp.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: '#ef4444' }}>
                        <CurrencyAmount amount={exp.amount} />
                      </td>
                      <td style={{ color: '#64748b' }}>{exp.remarks || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Delete expense entry"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- TAB: STATISTICS & ANALYTICS ----------------- */}
      {activeTab === 'statistics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>Financial Breakdown (Bar View)</h3>
            <div style={{ height: '280px' }}>
              <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>Capital Allocation (Doughnut View)</h3>
            <div style={{ height: '280px', display: 'flex', justifyContent: 'center' }}>
              <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB: BOOKING & STAFF EXPENSES (IMAGE 3 & 4 TABULAR FORMAT + EVALUATE STATUS) ----------------- */}
      {activeTab === 'booking_staff_expenses' && (
        <div className="card" style={{ padding: '24px' }}>
          {/* Header Bar with Dropdown Selector [ Book v ] / [ Staff v ] */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '12px', backgroundColor: expenseViewType === 'book' ? '#eff6ff' : '#ecfdf5', color: expenseViewType === 'book' ? '#0284c7' : '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${expenseViewType === 'book' ? '#bfdbfe' : '#a7f3d0'}` }}>
                {expenseViewType === 'book' ? <BookOpen size={24} /> : <Users size={24} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {expenseViewType === 'book' ? 'Book Expenses' : 'Staff Expenses'}
                  </h2>
                  <span style={{ fontSize: '11px', fontWeight: 800, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px' }}>
                    {expenseViewType === 'book' ? `${bookAggregatedList.length} Payers` : `${staffAggregatedList.length} Staff`}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0' }}>
                  {expenseViewType === 'book' 
                    ? 'Total spend of booking payers with Super Admin evaluation (Jeet / Sonal).' 
                    : 'Total spend of staff members in Add Inventory with Super Admin evaluation (Jeet / Sonal).'
                  }
                </p>
              </div>
            </div>

            {/* Dropdown Selector matching Image 3 & 4 drawings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Select:</span>
                <select 
                  className="form-control"
                  value={expenseViewType}
                  onChange={(e) => {
                    setExpenseViewType(e.target.value);
                    setExpandedPayer(null);
                    setOpenEvaluateMenuId(null);
                  }}
                  style={{ 
                    fontWeight: 800, 
                    padding: '6px 14px', 
                    fontSize: '14px', 
                    width: '130px', 
                    cursor: 'pointer',
                    borderRadius: '8px',
                    borderColor: expenseViewType === 'book' ? '#0284c7' : '#059669',
                    color: expenseViewType === 'book' ? '#0284c7' : '#059669'
                  }}
                >
                  <option value="book">Book</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <button 
                onClick={expenseViewType === 'book' ? openBookExport : openStaffExport} 
                className="btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 700 }}
              >
                <Download size={15} /> Export PDF
              </button>
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                {expenseViewType === 'book' ? 'Total Book Spend' : 'Total Staff Spend'}
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: expenseViewType === 'book' ? '#0284c7' : '#059669', marginTop: '4px' }}>
                <CurrencyAmount amount={expenseViewType === 'book' ? totalBookPaidAmount : totalStaffPaidAmount} />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                {expenseViewType === 'book' ? 'Total Mobiles Booked' : 'Total Mobiles Paid'}
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {expenseViewType === 'book' ? totalBookMobilesCount : totalStaffMobilesCount} <span style={{ fontSize: '13px', fontWeight: 600 }}>Units</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Evaluated By Super Admin
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
                {expenseViewType === 'book' 
                  ? bookAggregatedList.filter(b => evaluations[`book_${b.payByName}`]).length 
                  : staffAggregatedList.filter(s => evaluations[`staff_${s.payerName}`]).length
                } / {expenseViewType === 'book' ? bookAggregatedList.length : staffAggregatedList.length}
              </div>
            </div>
          </div>

          {/* ----------------- SUB-VIEW 1: BOOK TABLE (AS PER IMAGE 3) ----------------- */}
          {expenseViewType === 'book' && (
            <div>
              <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'visible' }}>
                <table className="custom-table" style={{ margin: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ width: '80px', textAlign: 'center' }}>S.No.</th>
                      <th>Name</th>
                      <th style={{ textAlign: 'right' }}>Total Spend</th>
                      <th style={{ textAlign: 'center', width: '220px' }}>Evaluate By</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookAggregatedList.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                          <BookOpen size={32} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                          <div>No Book expenses recorded yet.</div>
                        </td>
                      </tr>
                    ) : (
                      bookAggregatedList.map((book, idx) => {
                        const rowKey = `book_${book.payByName}`;
                        const evalState = evaluations[rowKey];
                        const isExpanded = expandedPayer === rowKey;
                        const isMenuOpen = openEvaluateMenuId === rowKey;

                        return (
                          <React.Fragment key={rowKey}>
                            <tr style={{ background: isExpanded ? '#f0f9ff' : '#ffffff', transition: 'all 0.15s ease' }}>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                                ① {idx + 1}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                                    {book.payByName.charAt(0)}
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{book.payByName}</strong>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{book.mobileCount} {book.mobileCount === 1 ? 'Mobile' : 'Mobiles (Additive)'}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '15px', color: '#0284c7' }}>
                                <CurrencyAmount amount={book.totalAmountPaid} />
                              </td>
                              <td style={{ textAlign: 'center', position: 'relative' }}>
                                {/* Evaluate Status Bar or Trigger */}
                                {evalState?.evaluatedBy ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setOpenEvaluateMenuId(isMenuOpen ? null : rowKey)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        border: evalState.evaluatedBy === 'Jeet' ? '1px solid #86efac' : '1px solid #c4b5fd',
                                        background: evalState.evaluatedBy === 'Jeet' ? '#f0fdf4' : '#f5f3ff',
                                        color: evalState.evaluatedBy === 'Jeet' ? '#166534' : '#5b21b6',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                      }}
                                    >
                                      <ShieldCheck size={14} />
                                      {evalState.status}
                                      <ChevronDown size={13} style={{ opacity: 0.7 }} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setOpenEvaluateMenuId(isMenuOpen ? null : rowKey)}
                                    style={{
                                      padding: '6px 16px',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      color: '#0284c7',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                    }}
                                  >
                                    Evaluate <ChevronDown size={14} />
                                  </button>
                                )}

                                {/* Interactive Popup Menu (Jeet / Sonal) */}
                                {isMenuOpen && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 50,
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    padding: '6px',
                                    width: '180px',
                                    textAlign: 'left',
                                    marginTop: '4px'
                                  }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', padding: '4px 8px' }}>
                                      Evaluate By (Super Admin):
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSetEvaluation(rowKey, 'Jeet')}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '7px 10px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: evalState?.evaluatedBy === 'Jeet' ? '#f0fdf4' : 'transparent',
                                        color: '#15803d',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                      }}
                                    >
                                      <CheckCircle size={14} color="#15803d" /> Jeet
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetEvaluation(rowKey, 'Sonal')}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '7px 10px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: evalState?.evaluatedBy === 'Sonal' ? '#f5f3ff' : 'transparent',
                                        color: '#6d28d9',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                      }}
                                    >
                                      <CheckCircle size={14} color="#6d28d9" /> Sonal
                                    </button>
                                    {evalState?.evaluatedBy && (
                                      <button
                                        type="button"
                                        onClick={() => handleSetEvaluation(rowKey, null)}
                                        style={{
                                          width: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '6px 10px',
                                          borderTop: '1px solid #f1f5f9',
                                          marginTop: '4px',
                                          background: 'transparent',
                                          color: '#ef4444',
                                          fontWeight: 600,
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          textAlign: 'left'
                                        }}
                                      >
                                        <X size={12} /> Clear Evaluation
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedPayer(isExpanded ? null : rowKey)}
                                  style={{
                                    border: 'none',
                                    background: isExpanded ? '#0284c7' : '#f1f5f9',
                                    color: isExpanded ? '#ffffff' : '#64748b',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  {book.mobileCount} Mobiles
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Nested Details */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="5" style={{ padding: '16px 20px', background: '#fafbfc', borderBottom: '2px solid #e2e8f0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                                      📱 Mobiles Booked by {book.payByName} ({book.mobiles.length} Units)
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '3px 10px', borderRadius: '12px' }}>
                                      Additive Total Spend: ₹{book.totalAmountPaid.toLocaleString()}
                                    </span>
                                  </div>

                                  <table className="custom-table" style={{ fontSize: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                                    <thead>
                                      <tr style={{ background: '#f1f5f9' }}>
                                        <th>#</th>
                                        <th>Booking Date</th>
                                        <th>New Phone (Booked)</th>
                                        <th>Specs (RAM / Storage)</th>
                                        <th>Old Exchanged Device</th>
                                        <th>Purchased Amount (Paid ₹)</th>
                                        <th>Exchange Value (₹)</th>
                                        <th>Platform</th>
                                        <th>Payment Via / Ref</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {book.mobiles.map((m, mIdx) => (
                                        <tr key={m.id || mIdx}>
                                          <td>{mIdx + 1}</td>
                                          <td>{m.date}</td>
                                          <td><strong style={{ color: '#0f172a' }}>{m.newBrand}</strong> {m.newModel}</td>
                                          <td>{m.newRam} / {m.newStorage}</td>
                                          <td style={{ color: '#475569' }}>{m.oldBrand !== '-' ? `${m.oldBrand} ${m.oldModel}` : 'Direct Purchase'}</td>
                                          <td style={{ fontWeight: 800, color: '#0284c7' }}><CurrencyAmount amount={m.purchasedAmount} /></td>
                                          <td style={{ fontWeight: 700, color: '#8b5cf6' }}><CurrencyAmount amount={m.exchangeValue} /></td>
                                          <td><span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: '#f1f5f9', color: '#334155', fontWeight: 600 }}>{m.platform}</span></td>
                                          <td style={{ fontSize: '11px', color: '#64748b' }}>{m.via} {m.accountId !== '-' ? `(${m.accountId})` : ''}</td>
                                          <td><span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8' }}>{m.status}</span></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ----------------- SUB-VIEW 2: STAFF TABLE (AS PER IMAGE 4) ----------------- */}
          {expenseViewType === 'staff' && (
            <div>
              <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'visible' }}>
                <table className="custom-table" style={{ margin: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ width: '80px', textAlign: 'center' }}>S.No.</th>
                      <th>Name</th>
                      <th style={{ textAlign: 'right' }}>Total Spend</th>
                      <th style={{ textAlign: 'center', width: '220px' }}>Evaluate By</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffAggregatedList.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                          <Users size={32} color="#cbd5e1" style={{ marginBottom: '8px' }} />
                          <div>No Staff inventory expenses recorded yet.</div>
                        </td>
                      </tr>
                    ) : (
                      staffAggregatedList.map((staff, idx) => {
                        const rowKey = `staff_${staff.payerName}`;
                        const evalState = evaluations[rowKey];
                        const isExpanded = expandedPayer === rowKey;
                        const isMenuOpen = openEvaluateMenuId === rowKey;

                        return (
                          <React.Fragment key={rowKey}>
                            <tr style={{ background: isExpanded ? '#f0fdf4' : '#ffffff', transition: 'all 0.15s ease' }}>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                                ① {idx + 1}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                                    {staff.payerName.charAt(0)}
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{staff.payerName}</strong>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{staff.mobileCount} {staff.mobileCount === 1 ? 'Mobile' : 'Mobiles (Additive)'}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '15px', color: '#059669' }}>
                                <CurrencyAmount amount={staff.totalAmountPaid} />
                              </td>
                              <td style={{ textAlign: 'center', position: 'relative' }}>
                                {/* Evaluate Status Bar or Trigger */}
                                {evalState?.evaluatedBy ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setOpenEvaluateMenuId(isMenuOpen ? null : rowKey)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        border: evalState.evaluatedBy === 'Jeet' ? '1px solid #86efac' : '1px solid #c4b5fd',
                                        background: evalState.evaluatedBy === 'Jeet' ? '#f0fdf4' : '#f5f3ff',
                                        color: evalState.evaluatedBy === 'Jeet' ? '#166534' : '#5b21b6',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                      }}
                                    >
                                      <ShieldCheck size={14} />
                                      {evalState.status}
                                      <ChevronDown size={13} style={{ opacity: 0.7 }} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setOpenEvaluateMenuId(isMenuOpen ? null : rowKey)}
                                    style={{
                                      padding: '6px 16px',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      color: '#059669',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                    }}
                                  >
                                    Evaluate <ChevronDown size={14} />
                                  </button>
                                )}

                                {/* Interactive Popup Menu (Jeet / Sonal) */}
                                {isMenuOpen && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 50,
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    padding: '6px',
                                    width: '180px',
                                    textAlign: 'left',
                                    marginTop: '4px'
                                  }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', padding: '4px 8px' }}>
                                      Evaluate By (Super Admin):
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleSetEvaluation(rowKey, 'Jeet')}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '7px 10px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: evalState?.evaluatedBy === 'Jeet' ? '#f0fdf4' : 'transparent',
                                        color: '#15803d',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                      }}
                                    >
                                      <CheckCircle size={14} color="#15803d" /> Jeet
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetEvaluation(rowKey, 'Sonal')}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '7px 10px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: evalState?.evaluatedBy === 'Sonal' ? '#f5f3ff' : 'transparent',
                                        color: '#6d28d9',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                      }}
                                    >
                                      <CheckCircle size={14} color="#6d28d9" /> Sonal
                                    </button>
                                    {evalState?.evaluatedBy && (
                                      <button
                                        type="button"
                                        onClick={() => handleSetEvaluation(rowKey, null)}
                                        style={{
                                          width: '100%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '6px 10px',
                                          borderTop: '1px solid #f1f5f9',
                                          marginTop: '4px',
                                          background: 'transparent',
                                          color: '#ef4444',
                                          fontWeight: 600,
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          textAlign: 'left'
                                        }}
                                      >
                                        <X size={12} /> Clear Evaluation
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedPayer(isExpanded ? null : rowKey)}
                                  style={{
                                    border: 'none',
                                    background: isExpanded ? '#059669' : '#f1f5f9',
                                    color: isExpanded ? '#ffffff' : '#64748b',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  {staff.mobileCount} Mobiles
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Nested Details */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="5" style={{ padding: '16px 20px', background: '#fafbfc', borderBottom: '2px solid #e2e8f0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                                      📱 Mobiles Entered in Add Inventory by {staff.payerName} ({staff.mobiles.length} Units)
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', background: '#dcfce7', padding: '3px 10px', borderRadius: '12px' }}>
                                      Additive Total Spend: ₹{staff.totalAmountPaid.toLocaleString()}
                                    </span>
                                  </div>

                                  <table className="custom-table" style={{ fontSize: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                                    <thead>
                                      <tr style={{ background: '#f1f5f9' }}>
                                        <th>#</th>
                                        <th>Date Added</th>
                                        <th>Brand & Model</th>
                                        <th>Specs (RAM / Storage)</th>
                                        <th>Color</th>
                                        <th>Paid Amount (₹)</th>
                                        <th>Remarks / Accessories</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {staff.mobiles.map((m, mIdx) => (
                                        <tr key={m.id || mIdx}>
                                          <td>{mIdx + 1}</td>
                                          <td>{m.date}</td>
                                          <td><strong style={{ color: '#0f172a' }}>{m.brand}</strong> {m.model}</td>
                                          <td>{m.ram} / {m.storage}</td>
                                          <td>{m.color}</td>
                                          <td style={{ fontWeight: 800, color: '#059669' }}><CurrencyAmount amount={m.amount} /></td>
                                          <td style={{ color: '#64748b' }}>{m.remarks}</td>
                                          <td><span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: '#ecfdf5', color: '#047857' }}>{m.status}</span></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '440px', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Add Expense</h2>
                <p style={{ fontSize: '12px', color: '#64748b' }}>Record a new business expense. This will be included in overall statistics.</p>
              </div>
              <button onClick={() => setIsExpenseModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
            </div>

            <form onSubmit={handleExpenseSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-control" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Amount (₹) *</label>
                  <input type="number" className="form-control" placeholder="Enter amount" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Expense Type *</label>
                <select className="form-control" value={expenseForm.type} onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}>
                  <option>Shop Rent</option>
                  <option>Staff Salary</option>
                  <option>Repair Cost</option>
                  <option>Transport</option>
                  <option>Utilities (Electricity/Internet)</option>
                  <option>Office Expense</option>
                  <option>Marketing</option>
                  <option>Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Remarks</label>
                <textarea className="form-control" rows="3" placeholder="Enter remarks (optional)..." value={expenseForm.remarks} onChange={(e) => setExpenseForm({ ...expenseForm, remarks: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="btn-secondary">Cancel</button>
                <button 
                  type="submit" 
                  disabled={isSubmittingExpense} 
                  className="btn-primary" 
                  style={{ padding: '10px 24px', opacity: isSubmittingExpense ? 0.6 : 1, cursor: isSubmittingExpense ? 'not-allowed' : 'pointer' }}
                >
                  {isSubmittingExpense ? 'Saving...' : 'Save Expense'}
                </button>
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
    </div>
  );
}
