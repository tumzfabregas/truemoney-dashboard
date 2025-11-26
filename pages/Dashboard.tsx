import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Transaction, User } from '../types';
import { fetchTransactions, simulateIncomingWebhook, clearAllData, getUsers, addUser, updateUser, deleteUser, updateTransactionStatusMock, deleteTransactionMock } from '../services/mockService';
import { fetchLiveTransactions, triggerLiveWebhook, clearLiveTransactions, fetchUsersApi, addUserApi, updateUserApi, deleteUserApi, updateTransactionStatusApi, deleteTransactionApi } from '../services/apiService';
import { analyzeTransactions } from '../services/geminiService';
import { RefreshCw, Sparkles, Server, Clipboard, Check, Clock, Power, Play, Code, Trash2, LayoutDashboard, Globe, Database, Users, Edit, Plus, X, Wallet, BellRing, History, Smartphone, LayoutGrid, ChevronLeft, ChevronRight, Search, FileSpreadsheet, Calculator, Calendar, Volume2, VolumeX, BarChart3, Tag, LockKeyhole } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { t } = useLanguage();
  
  // Permissions Logic
  const isDev = user.role === 'dev';
  const isAdmin = user.role === 'dev' || user.role === 'admin';
  const isStaff = user.role === 'staff';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'users' | 'code' | 'reports'>('dashboard');
  
  // Initialize DataSource with Persistence
  const [dataSource, setDataSource] = useState<'mock' | 'live'>(() => {
    if (!isDev) return 'live';
    const savedPref = localStorage.getItem('tm_datasource_pref');
    if (savedPref === 'live' || savedPref === 'mock') {
        return savedPref;
    }
    return 'mock';
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [analysis, setAnalysis] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  // Status Dropdown State
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Auto Refresh State
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const REFRESH_INTERVAL = 10000; 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Sound Alert State
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousTxCount = useRef(0);

  // Payload Tester State
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Copy State
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Verification Secret State
  const [verificationSecret, setVerificationSecret] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  
  // Service Token & Balance
  const [serviceToken, setServiceToken] = useState('');
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletPhone, setWalletPhone] = useState<string | null>(null);

  // Database Status Check
  const [dbStatus, setDbStatus] = useState<string>('Checking...');

  // User Management State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'staff' as 'dev' | 'admin' | 'staff' });
  const [userFormError, setUserFormError] = useState('');

  // Constants
  const ITEMS_PER_PAGE = 20;
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  // Initialize Audio
  useEffect(() => {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audioRef.current.volume = 0.5;
  }, []);

  useEffect(() => {
    if (!isDev) {
      setDataSource('live');
    }
  }, [isDev]);

  useEffect(() => {
    if (isDev) {
        localStorage.setItem('tm_datasource_pref', dataSource);
    }
  }, [dataSource, isDev]);

  // Close Dropdown when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (activeDropdown) {
              setActiveDropdown(null);
          }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
  }, [activeDropdown]);

  const checkDbStatus = useCallback(async () => {
      try {
           const res = await fetch('/api/webhook/truemoney');
           if (res.ok) {
               const statusData = await res.json();
               if (statusData.db_status === 'connected') {
                   setDbStatus('✅ Connected (MongoDB)');
               } else {
                   setDbStatus('⚠️ Disconnected (Memory)');
               }
           } else {
               setDbStatus('❌ Offline (API Error)');
           }
      } catch(e) {
           setDbStatus('❌ Offline (Unreachable)');
      }
  }, []);

  // Fetch Service Token
  const fetchSettings = useCallback(async () => {
      try {
          const res = await fetch('/api/settings/service_token');
          if (res.ok) {
              const data = await res.json();
              if (data.value) setServiceToken(data.value);
          }
      } catch (e) { console.error(e); }
  }, []);

  // Fetch Balance
  const fetchBalance = useCallback(async () => {
      if (dataSource !== 'live') return;
      try {
          const res = await fetch('/api/balance');
          if (res.ok) {
              const data = await res.json();
              if (data.status === 'ok' && data.data) {
                  const rawBalance = Number(data.data.balance || 0);
                  setWalletBalance((rawBalance / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 }));
                  setWalletPhone(formatPhoneNumber(data.data.mobile_no, true));
              }
          } else {
              setWalletPhone(null);
          }
      } catch (e) { 
          console.error("Balance fetch error", e);
          setWalletPhone(null);
      }
  }, [dataSource]);

  useEffect(() => {
      // Check DB status for both Dev and Admin
      if (isAdmin) {
          checkDbStatus();
          // Fetch settings only for Dev (Admin shouldn't see token anymore)
          if (isDev) fetchSettings(); 
          const statusInterval = setInterval(checkDbStatus, 30000); 
          return () => clearInterval(statusInterval);
      }
  }, [isAdmin, isDev, checkDbStatus, fetchSettings]);

  useEffect(() => {
      if (dataSource === 'live' && isAdmin) {
          fetchBalance();
      } else {
          setWalletBalance(null);
          setWalletPhone(null);
      }
  }, [dataSource, fetchBalance, isAdmin]);

  const loadData = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);
    try {
      let data: Transaction[] = [];
      if (dataSource === 'mock') {
          const res = await fetchTransactions(1, 100); 
          data = res.data;
      } else {
          data = await fetchLiveTransactions();
          const cachedKey = 'tm_cached_transactions';
          const cached = localStorage.getItem(cachedKey);
          
          if (cached) {
              const cachedData: Transaction[] = JSON.parse(cached);
              const dataMap = new Map();
              cachedData.forEach(item => dataMap.set(item.id, item));
              data.forEach(item => dataMap.set(item.id, item));
              data = Array.from(dataMap.values());
          }
          
          if (data.length > 0) {
              localStorage.setItem(cachedKey, JSON.stringify(data.slice(0, 100)));
          }
      }

      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Sound Alert Logic
      if (soundEnabled && isBackgroundRefresh && data.length > previousTxCount.current) {
          audioRef.current?.play().catch(e => console.log("Audio play failed", e));
      }
      previousTxCount.current = data.length;

      setTransactions(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  }, [dataSource, soundEnabled]);

  const loadUsers = useCallback(async () => {
      try {
          if (dataSource === 'live') {
              const users = await fetchUsersApi();
              setUsersList(users);
          } else {
              setUsersList(getUsers());
          }
      } catch (e) {
          console.error("Failed to load users", e);
      }
  }, [dataSource]);

  useEffect(() => {
      if (isAdmin && activeTab === 'users') loadUsers();
  }, [dataSource, isAdmin, loadUsers, activeTab]);

  useEffect(() => {
    loadData();
    const storedSecret = localStorage.getItem('tm_verification_secret');
    if (storedSecret) {
        setVerificationSecret(storedSecret);
        setIsVerified(true);
    }

    if (isAutoRefresh) {
      timerRef.current = setInterval(() => {
        loadData(true);
        if (dataSource === 'live' && isAdmin) fetchBalance();
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadData, isAutoRefresh, dataSource, fetchBalance, isAdmin]);

  const toggleAutoRefresh = () => setIsAutoRefresh(prev => !prev);
  const toggleSound = () => setSoundEnabled(prev => !prev);

  const handleManualRefresh = () => {
    loadData();
    if (dataSource === 'live' && isAdmin) fetchBalance();
    if (isAdmin && activeTab === 'users') loadUsers();
    if (isAdmin) checkDbStatus();
  };

  const handleClearData = async () => {
      if (confirm('Are you sure you want to clear all data?')) {
          if (dataSource === 'mock') {
              clearAllData();
          } else {
              await clearLiveTransactions();
              localStorage.removeItem('tm_cached_transactions');
              loadData();
          }
      }
  }

  const handleSimulateWebhook = async () => {
    const randomAmount = Math.floor(Math.random() * 1000) + 50;
    const prefix = `08${Math.floor(Math.random() * 10)}`; 
    const middle = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const last = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const randomSender = `${prefix}${middle}${last}`;
    
    if (dataSource === 'mock') {
        simulateIncomingWebhook(randomAmount, randomSender);
        loadData();
    } else {
        await triggerLiveWebhook({
            amount: randomAmount * 100, 
            sender_mobile: randomSender,
            message: 'Live Simulation',
            received_time: new Date().toISOString()
        });
        setTimeout(loadData, 500);
    }
  };

  const handlePayloadTest = async () => {
    setJsonError('');
    const trimmedInput = jsonInput.trim();

    if (!trimmedInput) {
      setJsonError('Please enter JSON or JWT Token');
      return;
    }

    try {
      let data: any = null;
      if (trimmedInput.split('.').length === 3) {
        try {
            const base64Url = trimmedInput.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            data = JSON.parse(jsonPayload);
        } catch (e) {
            setJsonError('Invalid Token Format');
            return;
        }
      } else {
        try {
            data = JSON.parse(trimmedInput);
        } catch (e) {
            setJsonError('Invalid JSON Format');
            return;
        }
      }

      if (!data) {
          setJsonError('Could not parse data');
          return;
      }

      if (dataSource === 'live') {
           await triggerLiveWebhook(data);
           setJsonInput('');
           setTimeout(loadData, 500);
           return;
      }

      const amount = Number(data.amount || data.txn_amount || 0);
      const sender = data.sender_mobile || data.payer_mobile || 'Unknown';
      const message = data.message || 'Webhook Payload';
      
      // --- Validation for Simulation ---
      if (amount <= 0) {
         setJsonError('Amount must be greater than 0');
         return;
      }
      if (!sender || sender === 'Unknown') {
          setJsonError('Missing sender information');
          return;
      }

      let date = new Date().toISOString();
      if (data.received_time || data.created_at) {
        const parsedDate = new Date(data.received_time || data.created_at);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString();
        }
      }

      simulateIncomingWebhook(amount, sender, message, date);
      setJsonInput('');
      loadData();

    } catch (e) {
      console.error(e);
      setJsonError('Error processing data');
    }
  };

  const handleGeminiAnalysis = async () => {
    setAnalyzing(true);
    const result = await analyzeTransactions(transactions);
    setAnalysis(result);
    setAnalyzing(false);
  };

  const handleCopyEndpoint = () => {
    const url = dataSource === 'live' ? `${currentOrigin}/api/webhook/truemoney` : 'https://api.yourwebsite.com/webhook/truemoney';
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyBackendCode = () => {
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  const handleSaveSecret = () => {
      if (!verificationSecret.trim()) return;
      localStorage.setItem('tm_verification_secret', verificationSecret);
      setIsVerified(true);
  };

  const handleSaveServiceToken = async () => {
      if (!serviceToken.trim()) return;
      try {
          await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: 'service_token', value: serviceToken })
          });
          alert('Service token saved');
          fetchBalance();
      } catch (e) {
          alert('Failed to save token');
      }
  };

  const handleCheckBalance = () => {
      if (dataSource === 'live') {
          fetchBalance();
      } else {
          alert(`Balance (Demo): ${Math.floor(Math.random() * 100000).toLocaleString()} THB`);
      }
  };

  const handleCheckLastTx = () => {
      handleManualRefresh();
      alert("Fetched last transaction successfully");
      setActiveTab('dashboard');
  };

  const openUserModal = (userToEdit?: User) => {
      setUserFormError('');
      if (userToEdit) {
          setEditingUser(userToEdit);
          setUserForm({ username: userToEdit.username, password: userToEdit.password || '', role: userToEdit.role });
      } else {
          setEditingUser(null);
          setUserForm({ username: '', password: '', role: 'staff' }); 
      }
      setIsUserModalOpen(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setUserFormError('');
      try {
          if (dataSource === 'live') {
               if (editingUser) await updateUserApi(editingUser.id, userForm);
               else await addUserApi(userForm);
          } else {
              if (editingUser) updateUser(editingUser.id, userForm);
              else addUser(userForm);
          }
          loadUsers();
          setIsUserModalOpen(false);
      } catch (err: any) {
          setUserFormError(err.message);
      }
  };

  const handleDeleteUser = async (id: string) => {
      if (confirm('Delete this user?')) {
          try {
              if (dataSource === 'live') await deleteUserApi(id);
              else deleteUser(id);
              loadUsers();
          } catch (err: any) {
              alert(err.message);
          }
      }
  };

  const handleStatusClick = (e: React.MouseEvent, tx: Transaction) => {
      e.stopPropagation(); 
      // Permissions check for opening dropdown
      if (isStaff && tx.status !== 'normal') {
          // Locked for staff: Cannot edit once changed from normal
          return;
      }
      setActiveDropdown(activeDropdown === tx.id ? null : tx.id);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
      // Staff Confirmation
      if (isStaff) {
          if (!confirm(t('confirm_status_change'))) {
              return;
          }
      }

      try {
          if (dataSource === 'live') {
              await updateTransactionStatusApi(id, newStatus);
          } else {
              updateTransactionStatusMock(id, newStatus);
          }
          // Optimistic update locally
          setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, status: newStatus as any } : tx));
          setActiveDropdown(null);
      } catch (e) {
          console.error("Failed to update status", e);
      }
  };

  const handleDeleteTransaction = async (id: string) => {
      if (confirm(t('confirm_delete_tx'))) {
          setDeletingId(id);
          try {
              if (dataSource === 'live') {
                  await deleteTransactionApi(id);
              } else {
                  deleteTransactionMock(id);
              }
              setTransactions(prev => prev.filter(tx => tx.id !== id));
      } catch (e) {
              console.error("Failed to delete transaction", e);
              alert("Failed to delete");
          } finally {
              setDeletingId(null);
          }
      }
  };

  const handleExportCSV = () => {
      const headers = ['Date', 'Sender', 'Amount', 'Message', 'Status'];
      const csvContent = [
          headers.join(','),
          ...filteredTransactions.map(tx => [
              `"${new Date(tx.date).toLocaleString('th-TH')}"`,
              `"${tx.sender}"`,
              `"${tx.amount}"`,
              `"${(tx.message || '').replace(/"/g, '""')}"`,
              `"${tx.status || 'normal'}"`
          ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `truemoney_transactions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Utilities
  const formatDate = (isoString: string) => {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        });
    } catch (e) {
        return isoString;
    }
  };

  const formatPhoneNumber = (phone: string, isHeader: boolean = false) => {
      if (!phone) return 'Unknown';
      if (phone.length === 10) {
          return `${phone.substring(0, 3)}-${phone.substring(3, 6)}-${phone.substring(6, 10)}`;
      }
      return phone;
  };

  // Filter & Pagination Logic
  const filteredTransactions = transactions.filter(tx => {
    const query = searchQuery.toLowerCase();
    const phone = tx.sender.toLowerCase();
    const msg = (tx.message || '').toLowerCase();
    const amount = tx.amount.toString();
    return phone.includes(query) || msg.includes(query) || amount.includes(query);
  });

  // Calculate Daily & Monthly Totals
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Daily Total
  const dailyTotalData = filteredTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getDate() === today.getDate() && 
             txDate.getMonth() === currentMonth && 
             txDate.getFullYear() === currentYear &&
             tx.amount > 0;
  });
  const totalDailyAmount = dailyTotalData.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalDailyCount = dailyTotalData.length;

  // Monthly Total
  const monthlyTotalData = filteredTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && 
             txDate.getFullYear() === currentYear &&
             tx.amount > 0;
  });
  const totalMonthlyAmount = monthlyTotalData.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalMonthlyCount = monthlyTotalData.length;

  // Monthly History Data (Last 3 Months) for Report
  const monthlyReportData = React.useMemo(() => {
    const data = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const month = d.getMonth();
        const year = d.getFullYear();
        
        const txsInMonth = transactions.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate.getMonth() === month && txDate.getFullYear() === year && tx.amount > 0;
        });

        data.push({
            name: d.toLocaleString('th-TH', { month: 'long', year: 'numeric' }),
            total: txsInMonth.reduce((sum, tx) => sum + Number(tx.amount), 0),
            count: txsInMonth.length
        });
    }
    return data;
  }, [transactions]);

  // Daily Report Data (Last 30 Days)
  const dailyReportData = React.useMemo(() => {
      const data = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
          
          const txsInDay = transactions.filter(tx => {
              const txDate = new Date(tx.date);
              return txDate.getDate() === d.getDate() && 
                     txDate.getMonth() === d.getMonth() && 
                     txDate.getFullYear() === d.getFullYear() && 
                     tx.amount > 0;
          });

          data.push({
              name: dateStr,
              total: txsInDay.reduce((sum, tx) => sum + Number(tx.amount), 0),
              count: txsInDay.length
          });
      }
      return data;
  }, [transactions]);


  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* 1. Header Cards: Status & Actions */}
      <div className="bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
            <div>
                 <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                    <span className="bg-orange-500/10 p-2 rounded-xl border border-orange-500/20 text-orange-500">
                        <LayoutDashboard size={24} />
                    </span>
                    {t('tab_dashboard')}
                 </h2>
                 <p className="text-gray-400 text-sm mt-1 ml-1">{t('dashboard_subtitle')}</p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
                 {/* Sound Toggle */}
                 <button 
                    onClick={toggleSound}
                    className={`p-3 rounded-xl border transition-all ${soundEnabled ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-[#2b2d30] border-[#444746] text-gray-500'}`}
                    title={soundEnabled ? t('sound_on') : t('sound_off')}
                 >
                    {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                 </button>

                 {/* Refresh & Auto */}
                 <div className="flex bg-[#2b2d30] rounded-xl p-1 border border-[#444746] w-full sm:w-auto">
                     <button 
                        onClick={toggleAutoRefresh}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isAutoRefresh ? 'bg-green-500/10 text-green-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                     >
                        <Power size={16} /> <span className="hidden sm:inline">{isAutoRefresh ? t('auto_on') : t('auto_off')}</span>
                     </button>
                     <button 
                        onClick={handleManualRefresh}
                        disabled={loading}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-[#383a3e] hover:text-white transition-all disabled:opacity-50"
                     >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">{t('refresh')}</span>
                     </button>
                 </div>
            </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-col sm:flex-row gap-4">
             {/* API Status Button */}
             <div className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border transition-all ${
                 dataSource === 'live' 
                 ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                 : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
             }`}>
                 {dataSource === 'live' ? <Globe size={20} /> : <Database size={20} />}
                 <div className="flex flex-col items-start">
                     <span className="text-xs font-bold uppercase tracking-wider opacity-70">{t('source')}</span>
                     <span className="font-bold text-lg">
                        {dataSource === 'live' ? (walletPhone ? `API : ${walletPhone}` : t('live')) : t('mock')}
                     </span>
                 </div>
             </div>

             {/* Balance Card (Visible only to Dev/Admin) */}
             {isAdmin && (
                 <div className="flex-1 flex items-center justify-center gap-4 px-6 py-4 rounded-2xl border border-[#444746] bg-[#2b2d30]">
                     <div className="p-3 bg-orange-500/20 rounded-full text-orange-500 border border-orange-500/30">
                         <Wallet size={24} />
                     </div>
                     <div className="flex flex-col">
                         <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('wallet_balance')}</span>
                         <span className="text-2xl font-bold text-white tracking-tight">
                             {walletBalance ? `฿ ${walletBalance}` : '---'}
                         </span>
                     </div>
                 </div>
             )}
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'dashboard' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'bg-[#1E1F20] text-gray-400 hover:bg-[#2b2d30] border border-[#444746]'}`}>
            <LayoutDashboard size={16} /> {t('tab_dashboard')}
        </button>
        {/* Services: Dev Only */}
        {isDev && (
            <button onClick={() => setActiveTab('services')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'services' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'bg-[#1E1F20] text-gray-400 hover:bg-[#2b2d30] border border-[#444746]'}`}>
                <LayoutGrid size={16} /> {t('tab_services')}
            </button>
        )}
        {/* Reports: Admin/Dev Only */}
        {isAdmin && (
            <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'reports' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'bg-[#1E1F20] text-gray-400 hover:bg-[#2b2d30] border border-[#444746]'}`}>
                <BarChart3 size={16} /> {t('tab_reports')}
            </button>
        )}
        {/* Users: Admin/Dev Only */}
        {isAdmin && (
            <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'users' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'bg-[#1E1F20] text-gray-400 hover:bg-[#2b2d30] border border-[#444746]'}`}>
                <Users size={16} /> {t('tab_users')}
            </button>
        )}
        {/* Code: Dev Only */}
        {isDev && (
            <button onClick={() => setActiveTab('code')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'code' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' : 'bg-[#1E1F20] text-gray-400 hover:bg-[#2b2d30] border border-[#444746]'}`}>
                <Code size={16} /> {t('tab_code')}
            </button>
        )}
      </div>

      {/* 3. Main Content Area */}
      
      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
            
            {/* Summary Cards: Daily & Monthly */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Daily Total (Admin/Dev Only) */}
                 {isAdmin ? (
                     <div className="bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] relative overflow-hidden group hover:border-orange-500/30 transition-all">
                        <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Calendar size={100} />
                        </div>
                        <div className="relative z-10">
                            <span className="text-gray-400 text-sm font-bold uppercase tracking-wider">{t('summary_today')}</span>
                            <div className="text-xs text-orange-400 font-medium mt-1 mb-2">{t('time_range_today')}</div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-3xl font-bold text-white tracking-tight">฿ {totalDailyAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 font-medium bg-[#2b2d30] w-fit px-3 py-1 rounded-full border border-[#444746]">
                                <Tag size={14} className="text-orange-500"/> {totalDailyCount} {t('entries')}
                            </div>
                        </div>
                     </div>
                 ) : (
                     // Search Bar Full Width for Staff
                     <div className="md:col-span-2 bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] flex flex-col justify-center">
                         <h3 className="text-lg font-bold text-white mb-2">{t('search')}</h3>
                         <div className="relative">
                            <input 
                                type="text" 
                                placeholder={t('search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#2b2d30] border border-[#444746] text-white px-5 py-4 pl-12 rounded-xl focus:outline-none focus:border-orange-500 transition-all placeholder:text-gray-500"
                            />
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                         </div>
                     </div>
                 )}

                 {/* Monthly Total (Everyone sees this or maybe just Admin? Keeping consistent with request "Staff sees Search full width") */}
                 {isAdmin && (
                     <div className="bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] relative overflow-hidden group hover:border-orange-500/30 transition-all">
                        <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <FileSpreadsheet size={100} />
                        </div>
                        <div className="relative z-10">
                            <span className="text-gray-400 text-sm font-bold uppercase tracking-wider">{t('summary_month')}</span>
                            <div className="text-3xl font-bold text-white mt-2 tracking-tight">฿ {totalMonthlyAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                            <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 font-medium bg-[#2b2d30] w-fit px-3 py-1 rounded-full border border-[#444746]">
                                <Tag size={14} className="text-orange-500"/> {totalMonthlyCount} {t('entries')}
                            </div>
                        </div>
                     </div>
                 )}
            </div>

            {/* Filter & Export Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* Search (If Admin, show here. If Staff, already showed above) */}
                {isAdmin && (
                    <div className="relative w-full">
                        <input 
                            type="text" 
                            placeholder={t('search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#1E1F20] border border-[#444746] text-white px-5 py-3 pl-12 rounded-xl focus:outline-none focus:border-orange-500 transition-all placeholder:text-gray-500"
                        />
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                    </div>
                )}
                
                {/* Export Button */}
                <button 
                    onClick={handleExportCSV}
                    disabled={filteredTransactions.length === 0}
                    className="w-full sm:w-auto px-6 py-3 bg-[#1E1F20] hover:bg-[#2b2d30] border border-[#444746] text-gray-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:text-white hover:border-gray-500"
                >
                    <FileSpreadsheet size={18} /> <span className="whitespace-nowrap">{t('export_csv')}</span>
                </button>
            </div>

            {/* Transactions List */}
            <div className="bg-[#1E1F20] rounded-3xl border border-[#444746] overflow-hidden shadow-xl min-h-[400px]">
                {/* Header Row (Desktop) */}
                <div className="hidden md:grid grid-cols-12 gap-4 p-5 bg-[#2b2d30] border-b border-[#444746] text-gray-400 font-bold text-xs uppercase tracking-wider">
                    <div className="col-span-2">{t('date')}</div>
                    <div className="col-span-3">{t('sender')}</div>
                    <div className="col-span-2 text-right">{t('amount')}</div>
                    <div className="col-span-3">{t('message')}</div>
                    <div className="col-span-2 text-center">{t('status')}</div>
                </div>

                <div className="divide-y divide-[#2b2d30]">
                    {paginatedTransactions.length > 0 ? (
                        paginatedTransactions.map((tx) => (
                            <div key={tx.id} className="group hover:bg-[#2b2d30]/50 transition-colors">
                                {/* Desktop View */}
                                <div className="hidden md:grid grid-cols-12 gap-4 p-5 items-center">
                                    <div className="col-span-2 text-gray-400 text-sm font-medium">{formatDate(tx.date)}</div>
                                    <div className="col-span-3 font-bold text-white text-base tracking-wide flex items-center gap-2">
                                        <Smartphone size={16} className="text-gray-600"/>
                                        {formatPhoneNumber(tx.sender)}
                                    </div>
                                    <div className="col-span-2 text-right font-bold text-green-400 text-base">
                                        + {tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="col-span-3 text-gray-400 text-sm truncate pr-4">{tx.message}</div>
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                         {/* Status Badge */}
                                         <div className="relative">
                                            <button 
                                                onClick={(e) => handleStatusClick(e, tx)}
                                                disabled={isStaff && tx.status !== 'normal'}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1 ${
                                                    tx.status === 'verified' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                                    tx.status === 'issue' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                                    tx.status === 'refund' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                                                    'bg-gray-700/50 border-gray-600 text-gray-400 hover:bg-gray-700'
                                                } ${(isStaff && tx.status !== 'normal') ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {t(`status_${tx.status || 'normal'}`)} 
                                                {(isStaff && tx.status !== 'normal') && <LockKeyhole size={10} />}
                                            </button>
                                            
                                            {/* Dropdown */}
                                            {activeDropdown === tx.id && (
                                                <div className="absolute top-full right-0 mt-2 w-32 bg-[#353639] border border-[#444746] rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200">
                                                    {['normal', 'verified', 'issue', 'refund'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleStatusChange(tx.id, status)}
                                                            className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-[#444746] transition-colors ${tx.status === status ? 'text-orange-500' : 'text-gray-300'}`}
                                                        >
                                                            {t(`status_${status}`)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                         </div>

                                         {/* Delete Button (Admin/Dev Only) */}
                                         {isAdmin && (
                                             <button 
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                disabled={deletingId === tx.id}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                title="Delete"
                                             >
                                                 {deletingId === tx.id ? (
                                                     <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                                 ) : (
                                                     <Trash2 size={16} />
                                                 )}
                                             </button>
                                         )}
                                    </div>
                                </div>

                                {/* Mobile View (Card Layout) */}
                                <div className="md:hidden p-5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Smartphone size={16} className="text-gray-600"/>
                                            <span className="font-bold text-white text-base tracking-wide">{formatPhoneNumber(tx.sender)}</span>
                                        </div>
                                        <span className="font-bold text-green-400 text-base">+ {tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 flex items-center gap-2">
                                            {formatDate(tx.date)} 
                                            <span className="w-1 h-1 rounded-full bg-gray-600"></span> 
                                            <span className="text-gray-300 max-w-[150px] truncate">{tx.message}</span>
                                        </span>
                                    </div>
                                    <div className="flex justify-end items-center gap-3 pt-2 border-t border-[#2b2d30] mt-2">
                                         {/* Delete Button Mobile */}
                                         {isAdmin && (
                                             <button 
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                disabled={deletingId === tx.id}
                                                className="p-2 text-gray-500 hover:text-red-400 disabled:opacity-50"
                                             >
                                                 {deletingId === tx.id ? (
                                                     <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                                 ) : (
                                                     <Trash2 size={16} />
                                                 )}
                                             </button>
                                         )}

                                         {/* Status Badge Mobile */}
                                         <div className="relative">
                                            <button 
                                                onClick={(e) => handleStatusClick(e, tx)}
                                                disabled={isStaff && tx.status !== 'normal'}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border flex items-center gap-1 ${
                                                    tx.status === 'verified' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                                    tx.status === 'issue' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                                    tx.status === 'refund' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                                                    'bg-gray-700/50 border-gray-600 text-gray-400'
                                                } ${(isStaff && tx.status !== 'normal') ? 'opacity-70' : ''}`}
                                            >
                                                {t(`status_${tx.status || 'normal'}`)}
                                                {(isStaff && tx.status !== 'normal') && <LockKeyhole size={10} />}
                                            </button>
                                            {activeDropdown === tx.id && (
                                                <div className="absolute bottom-full right-0 mb-2 w-32 bg-[#353639] border border-[#444746] rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                                                    {['normal', 'verified', 'issue', 'refund'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleStatusChange(tx.id, status)}
                                                            className={`w-full text-left px-4 py-2 text-xs font-medium active:bg-[#444746] ${tx.status === status ? 'text-orange-500' : 'text-gray-300'}`}
                                                        >
                                                            {t(`status_${status}`)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                         </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-10 text-center flex flex-col items-center justify-center text-gray-500">
                            <History size={48} className="mb-4 opacity-20" />
                            <p>{t('no_transactions')}</p>
                            {dataSource === 'live' && <p className="text-xs mt-2 text-gray-600">{t('waiting_webhook')}</p>}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 bg-[#1E1F20] border-t border-[#444746] flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-medium">
                            {t('page')} {currentPage} {t('of')} {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg bg-[#2b2d30] border border-[#444746] text-gray-400 disabled:opacity-30 hover:bg-[#383a3e]"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg bg-[#2b2d30] border border-[#444746] text-gray-400 disabled:opacity-30 hover:bg-[#383a3e]"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Configuration Section (Dev Only) */}
            {isDev && (
                <div className="bg-[#1E1F20] rounded-3xl border border-[#444746] overflow-hidden">
                    <div className="p-6 border-b border-[#444746] flex items-center gap-3">
                         <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20"><Server size={20} /></div>
                         <h3 className="text-lg font-bold text-gray-100">{t('config_sim')}</h3>
                    </div>
                    <div className="p-6 space-y-8">
                         {/* Setup Info */}
                         <div className="space-y-4">
                             <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('setup_info')}</h4>
                             <div className="bg-[#0f1113] p-4 rounded-xl border border-[#2b2d30] space-y-4">
                                 <div>
                                     <label className="text-xs text-gray-500 block mb-1">Webhook Endpoint URL:</label>
                                     <div className="flex gap-2">
                                         <code className="flex-1 bg-[#1E1F20] p-3 rounded-lg text-green-400 font-mono text-xs border border-[#2b2d30] break-all">
                                             {dataSource === 'live' ? `${currentOrigin}/api/webhook/truemoney` : 'https://api.yourwebsite.com/webhook/truemoney'}
                                         </code>
                                         <button onClick={handleCopyEndpoint} className="bg-[#2b2d30] hover:bg-[#383a3e] text-white p-3 rounded-lg border border-[#444746] transition-colors">
                                             {copied ? <Check size={16} className="text-green-500"/> : <Clipboard size={16} />}
                                         </button>
                                     </div>
                                 </div>
                                 <div className="flex justify-between items-center pt-2">
                                     <span className="text-xs text-gray-500">{t('db_status')}:</span>
                                     <span className={`text-xs font-bold px-2 py-1 rounded border ${dbStatus.includes('Connected') ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                         {dbStatus}
                                     </span>
                                 </div>
                             </div>
                         </div>
                         
                         {/* Tokens */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                 <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('verification_secret')}</label>
                                 <div className="flex gap-2">
                                     <input 
                                         type="text" 
                                         value={verificationSecret}
                                         onChange={(e) => setVerificationSecret(e.target.value)}
                                         placeholder={t('verification_placeholder')}
                                         className="flex-1 bg-[#2b2d30] border border-[#444746] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500 text-sm"
                                     />
                                     <button onClick={handleSaveSecret} className="bg-green-600 hover:bg-green-500 text-white px-4 rounded-xl font-bold transition-colors"><Check size={18} /></button>
                                 </div>
                                 {isVerified && <div className="text-xs text-green-400 flex items-center gap-1 mt-1"><Check size={12}/> {t('verified')}</div>}
                            </div>
                            <div className="space-y-2">
                                 <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('service_token')}</label>
                                 <div className="flex gap-2">
                                     <input 
                                         type="text" 
                                         value={serviceToken}
                                         onChange={(e) => setServiceToken(e.target.value)}
                                         placeholder={t('service_token_placeholder')}
                                         className="flex-1 bg-[#2b2d30] border border-[#444746] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500 text-sm"
                                     />
                                     <button onClick={handleSaveServiceToken} className="bg-green-600 hover:bg-green-500 text-white px-4 rounded-xl font-bold transition-colors"><Check size={18} /></button>
                                 </div>
                            </div>
                         </div>
                         
                         {/* Simulator */}
                         <div className="pt-6 border-t border-[#2b2d30]">
                             <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t('simulator')}</h4>
                             <button 
                                onClick={handleSimulateWebhook}
                                className="w-full bg-[#2b2d30] hover:bg-[#383a3e] border border-[#444746] hover:border-gray-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all group"
                             >
                                <Play size={20} className="text-orange-500 group-hover:scale-110 transition-transform" /> {t('simulate_btn')}
                             </button>
                             <div className="mt-2 text-center text-xs text-gray-500">{t('simulate_desc')} <strong>{dataSource === 'mock' ? 'Local' : 'Live API'}</strong></div>
                         </div>
                    </div>
                </div>
            )}
            
            {/* Clear Data (Dev/Admin) */}
            {isAdmin && (
                <div className="flex justify-center pt-8 pb-12">
                    <button 
                        onClick={handleClearData}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-6 py-2 rounded-full text-sm font-medium transition-colors border border-transparent hover:border-red-500/20"
                    >
                        {t('clear')}
                    </button>
                </div>
            )}
        </div>
      )}

      {/* REPORTS TAB (Admin/Dev) */}
      {activeTab === 'reports' && isAdmin && (
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Daily Report Chart */}
                  <div className="bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] md:col-span-2">
                      <h3 className="text-lg font-bold text-gray-100 mb-6 flex items-center gap-2">
                          <BarChart3 size={20} className="text-orange-500"/> {t('report_daily_income')}
                      </h3>
                      <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={dailyReportData.slice().reverse()}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#444746" vertical={false} />
                                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `฿${val/1000}k`} />
                                  <Tooltip 
                                      contentStyle={{ backgroundColor: '#2b2d30', borderColor: '#444746', color: '#fff' }}
                                      itemStyle={{ color: '#fb923c' }}
                                      formatter={(value: number) => [`฿ ${value.toLocaleString()}`, 'Total']}
                                  />
                                  <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
                  
                  {/* Monthly Summary Table */}
                  <div className="bg-[#1E1F20] rounded-3xl border border-[#444746] overflow-hidden h-fit">
                      <div className="p-5 border-b border-[#444746] bg-[#2b2d30]">
                          <h3 className="text-base font-bold text-gray-100">{t('summary_month_3')}</h3>
                      </div>
                      <div className="divide-y divide-[#2b2d30]">
                          <div className="grid grid-cols-3 p-3 text-xs font-bold text-gray-500 uppercase">
                              <div>{t('report_month')}</div>
                              <div className="text-center">{t('report_count')}</div>
                              <div className="text-right">{t('report_total')}</div>
                          </div>
                          {monthlyReportData.map((m, i) => (
                              <div key={i} className="grid grid-cols-3 p-4 text-sm hover:bg-[#2b2d30]/50 transition-colors">
                                  <div className="font-bold text-gray-300">{m.name}</div>
                                  <div className="text-center text-gray-400">{m.count}</div>
                                  <div className="text-right font-bold text-orange-400">฿ {m.total.toLocaleString()}</div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Daily Detail Table */}
                  <div className="bg-[#1E1F20] rounded-3xl border border-[#444746] overflow-hidden max-h-[400px] flex flex-col">
                      <div className="p-5 border-b border-[#444746] bg-[#2b2d30] shrink-0">
                          <h3 className="text-base font-bold text-gray-100">{t('summary_today')} (History)</h3>
                      </div>
                      <div className="overflow-y-auto">
                        <div className="divide-y divide-[#2b2d30]">
                            {dailyReportData.map((d, i) => (
                                <div key={i} className="flex justify-between items-center p-4 hover:bg-[#2b2d30]/50 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-300 text-sm">{d.name}</span>
                                        <span className="text-xs text-gray-500">{d.count} items</span>
                                    </div>
                                    <span className="font-bold text-green-400">฿ {d.total.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SERVICES TAB (Dev Only) */}
      {activeTab === 'services' && isDev && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] hover:border-orange-500/50 transition-all group">
                  <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
                      <BellRing className="text-orange-500" size={24} />
                  </div>
                  <h3 className="font-bold text-gray-100 mb-1">{t('svc_incoming')}</h3>
                  <p className="text-xs text-gray-500 mb-4">{t('svc_incoming_desc')}</p>
                  <span className="inline-block px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">{t('active')}</span>
              </div>
              <div className="bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] hover:border-orange-500/50 transition-all group opacity-60">
                   <div className="w-12 h-12 rounded-full bg-gray-700/30 flex items-center justify-center mb-4">
                      <Smartphone className="text-gray-500" size={24} />
                  </div>
                  <h3 className="font-bold text-gray-100 mb-1">{t('svc_outgoing')}</h3>
                  <p className="text-xs text-gray-500 mb-4">{t('svc_outgoing_desc')}</p>
                  <span className="inline-block px-3 py-1 rounded-full bg-gray-700/50 text-gray-400 text-xs font-bold border border-gray-600">{t('soon')}</span>
              </div>
              <div className="bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] hover:border-orange-500/50 transition-all group">
                   <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
                      <Wallet className="text-orange-500" size={24} />
                  </div>
                  <h3 className="font-bold text-gray-100 mb-1">{t('svc_balance')}</h3>
                  <p className="text-xs text-gray-500 mb-4">{t('svc_balance_desc')}</p>
                  <button onClick={handleCheckBalance} className="text-xs font-bold text-orange-500 hover:text-orange-400">{t('demo')}</button>
              </div>
              <div className="bg-[#1E1F20] p-6 rounded-3xl border border-[#444746] hover:border-orange-500/50 transition-all group">
                   <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
                      <History className="text-orange-500" size={24} />
                  </div>
                  <h3 className="font-bold text-gray-100 mb-1">{t('svc_last_tx')}</h3>
                  <p className="text-xs text-gray-500 mb-4">{t('svc_last_tx_desc')}</p>
                  <button onClick={handleCheckLastTx} className="inline-block px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold border border-purple-500/20 hover:bg-purple-500/20">{t('api')}</button>
              </div>
          </div>
      )}

      {/* USERS TAB (Admin/Dev) */}
      {activeTab === 'users' && isAdmin && (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-100">{t('user_management')}</h3>
                  <button onClick={() => openUserModal()} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                      <Plus size={16} /> {t('add_user')}
                  </button>
              </div>
              
              <div className="bg-[#1E1F20] rounded-3xl border border-[#444746] overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-[#2b2d30] border-b border-[#444746]">
                          <tr>
                              <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('username')}</th>
                              <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('role')}</th>
                              <th className="p-5 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2b2d30]">
                          {usersList
                              .filter(u => isDev || u.role !== 'dev') // Admin hides Devs
                              .map(u => (
                              <tr key={u.id} className="hover:bg-[#2b2d30]/50 transition-colors">
                                  <td className="p-5 font-medium text-gray-200">{u.username}</td>
                                  <td className="p-5">
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                                          u.role === 'dev' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                          u.role === 'admin' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                      }`}>
                                          {t(`role_${u.role}`)}
                                      </span>
                                  </td>
                                  <td className="p-5 text-right flex justify-end gap-2">
                                      <button onClick={() => openUserModal(u)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"><Edit size={16}/></button>
                                      {/* Prevent deleting yourself or Dev/Owner if not Dev */}
                                      {u.username !== user.username && (isDev || u.role !== 'admin') && (
                                          <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={16}/></button>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* CODE TAB (Dev Only) */}
      {activeTab === 'code' && isDev && (
        <div className="bg-[#1E1F20] rounded-3xl border border-[#444746] overflow-hidden">
            <div className="p-4 bg-[#2b2d30] border-b border-[#444746] flex justify-between items-center">
                <span className="text-xs font-mono text-gray-400">api/index.js (Backend Logic)</span>
                <button onClick={handleCopyBackendCode} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                    {codeCopied ? <Check size={14}/> : <Clipboard size={14}/>} Copy
                </button>
            </div>
            <div className="p-0 overflow-x-auto">
<pre className="text-xs font-mono text-gray-300 p-6 leading-relaxed">
{`// Express.js Backend for Vercel
app.post('/api/webhook/truemoney', async (req, res) => {
  try {
    const token = req.body.message || req.body.token;
    // Decode JWT or Parse JSON...
    const data = decode(token);
    
    // Save to Database
    await Transaction.create({
       sender: data.sender_mobile,
       amount: data.amount,
       message: data.message
    });
    
    res.status(200).send({ status: 'success' });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});`}
</pre>
            </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
               <div className="bg-[#1E1F20] rounded-3xl shadow-2xl border border-[#444746] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-[#444746] flex justify-between items-center bg-[#2b2d30]">
                      <h3 className="text-lg font-bold text-gray-100">{editingUser ? t('edit_user') : t('new_user')}</h3>
                      <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
                       {userFormError && <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-xl border border-red-500/20">{userFormError}</div>}
                       <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('username')}</label>
                           <input type="text" required value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full bg-[#2b2d30] border border-[#444746] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500" />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('password')}</label>
                           <input type="text" required={!editingUser} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder={editingUser ? "(Unchanged)" : ""} className="w-full bg-[#2b2d30] border border-[#444746] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500" />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{t('role')}</label>
                           <div className="grid grid-cols-3 gap-2">
                               {/* Dev Role: Only visible if current user is Dev */}
                               {isDev && (
                                   <button type="button" onClick={() => setUserForm({...userForm, role: 'dev'})} className={`px-2 py-2 rounded-lg text-xs font-bold border ${userForm.role === 'dev' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-[#2b2d30] border-[#444746] text-gray-400'}`}>Dev</button>
                               )}
                               {/* Admin Role: Visible if Dev OR Admin */}
                               {(isDev || isAdmin) && (
                                   <button type="button" onClick={() => setUserForm({...userForm, role: 'admin'})} className={`px-2 py-2 rounded-lg text-xs font-bold border ${userForm.role === 'admin' ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-[#2b2d30] border-[#444746] text-gray-400'}`}>Admin</button>
                               )}
                               <button type="button" onClick={() => setUserForm({...userForm, role: 'staff'})} className={`px-2 py-2 rounded-lg text-xs font-bold border ${userForm.role === 'staff' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-[#2b2d30] border-[#444746] text-gray-400'}`}>Staff</button>
                           </div>
                       </div>
                       <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl mt-4">{t('save_user')}</button>
                  </form>
               </div>
          </div>
      )}

    </div>
  );
};

export default Dashboard;