import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Transaction, User } from '../types';
import { fetchTransactions, simulateIncomingWebhook, clearAllData, getUsers, addUser, updateUser, deleteUser } from '../services/mockService';
import { fetchLiveTransactions, triggerLiveWebhook, clearLiveTransactions, fetchUsersApi, addUserApi, updateUserApi, deleteUserApi } from '../services/apiService';
import { analyzeTransactions } from '../services/geminiService';
import { RefreshCw, Sparkles, Server, Clipboard, Check, Clock, Power, Play, Code, Trash2, LayoutDashboard, Globe, Database, Users, Edit, Plus, X, Wallet, BellRing, History, Smartphone, LayoutGrid, ChevronLeft, ChevronRight, Search, FileSpreadsheet, Calculator, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { t } = useLanguage();
  
  // Permissions Logic
  const isDev = user.role === 'dev';
  const isAdmin = user.role === 'dev' || user.role === 'admin';
  const isStaff = user.role === 'staff';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'users' | 'code'>('dashboard');
  
  // Initialize DataSource with Persistence
  const [dataSource, setDataSource] = useState<'mock' | 'live'>(() => {
    // Force Live for Staff/Admin unless they are Dev
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
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Auto Refresh State
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const REFRESH_INTERVAL = 10000; 
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
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
      
      setTransactions(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  }, [dataSource]);

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
      
      if (amount === 0) {
         setJsonError('Amount missing');
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

  const handleExportCSV = () => {
      const headers = ['Date', 'Sender', 'Amount', 'Message'];
      const csvContent = [
          headers.join(','),
          ...filteredTransactions.map(tx => [
              `"${new Date(tx.date).toLocaleString('th-TH')}"`,
              `"${tx.sender}"`,
              `"${tx.amount}"`,
              `"${(tx.message || '').replace(/"/g, '""')}"`
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

  const formatPhoneNumber = (phoneNumber: string, forceShow: boolean = false) => {
      if (!phoneNumber) return '-';
      const cleaned = phoneNumber.replace(/\D/g, '');
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
      
      // Mask for Staff, unless it's their own balance (forceShow)
      if (!isAdmin && !forceShow) {
          if (match) {
              return `${match[1]}-xxx-${match[3]}`;
          }
          return phoneNumber.substring(0, 3) + 'xxxx' + phoneNumber.substring(phoneNumber.length - 4);
      }

      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
      return phoneNumber;
  };

  // Filter & Pagination Logic
  const filteredTransactions = transactions.filter(tx => 
    tx.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.amount.toString().includes(searchQuery)
  );

  // --- Total Calculation Logic ---
  
  // 1. Daily Total
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyTransactions = transactions.filter(tx => new Date(tx.date) >= today);
  const totalTodayAmount = dailyTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalTodayCount = dailyTransactions.length;

  // 2. Monthly Total
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthlyTransactions = transactions.filter(tx => new Date(tx.date) >= startOfMonth);
  const totalMonthAmount = monthlyTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalMonthCount = monthlyTransactions.length;


  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const displayedTransactions = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const backendCodeString = `// Backend Logic (api/index.js)...`.trim();

  // Filter Users List: Admin cannot see Dev
  const filteredUsersList = usersList.filter(u => {
    if (user.role === 'admin' && u.role === 'dev') return false;
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 mt-4 sm:mt-10 font-sans pb-24 text-gray-200">
      
      {/* Header / Title Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <Wallet className="text-orange-500" size={32} />
                <span>TrueMoney <span className="text-orange-500 font-light hidden xs:inline">/ Dashboard</span></span>
            </h1>
            <p className="text-sm text-gray-400 mt-2 font-medium">{t('dashboard_subtitle')}</p>
        </div>

        {/* Navigation Tabs (Admin/Dev Only) */}
        {isAdmin && (
            <div className="w-full md:w-auto flex bg-[#1E1F20] p-1.5 rounded-xl border border-[#444746] shadow-lg overflow-x-auto no-scrollbar">
                {[
                    { id: 'dashboard', label: t('tab_dashboard'), icon: LayoutDashboard },
                    { id: 'services', label: t('tab_services'), icon: LayoutGrid },
                    { id: 'users', label: t('tab_users'), icon: Users },
                    // Code tab only for Dev
                    ...(isDev ? [{ id: 'code', label: t('tab_code'), icon: Code }] : []),
                ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'bg-orange-600 text-white shadow-md shadow-orange-900/40' 
                            : 'text-gray-400 hover:text-white hover:bg-[#2b2d30]'
                        }`}
                    >
                        <tab.icon size={18} /> <span className="hidden xs:inline">{tab.label}</span>
                    </button>
                ))}
            </div>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
            
            {/* Control Bar */}
            <div className="bg-[#1E1F20] border border-[#444746] rounded-2xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-stretch md:items-center gap-5">
                
                {/* Data Source Toggle & Balance */}
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden md:inline">{t('source')}</span>
                     <div className="w-full sm:w-auto flex bg-[#2b2d30] p-1.5 rounded-xl border border-[#444746] shadow-inner">
                         {isDev ? (
                            <>
                                <button 
                                    onClick={() => { setDataSource('mock'); setCurrentPage(1); }}
                                    className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide ${dataSource === 'mock' ? 'bg-[#444746] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Database size={14} /> {t('mock')}
                                </button>
                                <button 
                                    onClick={() => { setDataSource('live'); setCurrentPage(1); }}
                                    className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide ${dataSource === 'live' ? 'bg-green-800 text-green-100 border border-green-700 shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Globe size={14} /> 
                                    {dataSource === 'live' && walletPhone ? `API : ${walletPhone}` : t('live')}
                                </button>
                            </>
                         ) : (
                             <div className="w-full flex justify-center items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-green-900/30 text-green-400 border border-green-800 uppercase tracking-wide">
                                 <Globe size={14} /> 
                                 {walletPhone ? `API : ${walletPhone}` : t('live')}
                             </div>
                         )}
                     </div>
                     
                     {/* Wallet Balance Display (Admin Only) */}
                     {dataSource === 'live' && walletBalance && isAdmin && (
                        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 px-5 py-3 sm:py-2 rounded-xl bg-[#2b2d30] border border-[#444746] shadow-inner mt-1 sm:mt-0">
                            <span className="text-xs text-gray-400 font-bold uppercase sm:hidden">Balance</span>
                            <div className="flex items-center gap-2">
                                <Wallet size={18} className="text-orange-500" />
                                <span className="text-white font-mono font-bold text-sm tracking-wide">฿ {walletBalance}</span>
                            </div>
                        </div>
                     )}
                </div>

                {/* Status & Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="hidden lg:flex items-center gap-2 text-gray-300 bg-[#2b2d30] px-4 py-2 rounded-xl border border-[#444746] shadow-inner">
                        <Clock size={16} className="text-orange-500"/> 
                        <span className="text-sm font-mono font-medium">{lastUpdated.toLocaleTimeString('th-TH')}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:flex gap-3">
                        <button 
                            onClick={toggleAutoRefresh}
                            className={`flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl border transition-all text-xs font-bold uppercase tracking-wide ${isAutoRefresh ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-[#2b2d30] border-[#444746] text-gray-500'}`}
                        >
                            <Power size={14} /> {isAutoRefresh ? t('auto_on') : t('auto_off')}
                        </button>

                        <button 
                            onClick={handleManualRefresh}
                            disabled={loading}
                            className="flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl bg-[#444746] hover:bg-[#505356] text-white transition-all text-xs font-bold border border-[#505356] shadow-sm uppercase tracking-wide"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t('refresh')}
                        </button>
                    </div>

                    {isAdmin && (
                        <button 
                            onClick={handleClearData}
                            className="flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all text-xs font-bold uppercase tracking-wide"
                        >
                            <Trash2 size={14} /> {t('clear')}
                        </button>
                    )}
                </div>
            </div>
            
            {/* Search & Summary Section */}
            <div className={`grid grid-cols-1 ${!isStaff ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
                <div className={`${!isStaff ? '' : ''} bg-[#1E1F20] border border-[#444746] rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row gap-4 items-center`}>
                    <div className="relative flex-1 w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-500" />
                        </div>
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full bg-[#2b2d30] border border-[#444746] text-gray-200 text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors shadow-inner placeholder:text-gray-600"
                            placeholder={t('search_placeholder')}
                        />
                    </div>
                    {isAdmin && (
                        <button 
                            onClick={handleExportCSV}
                            className="w-full sm:w-auto flex justify-center items-center gap-2 px-5 py-3 rounded-xl bg-[#2b2d30] hover:bg-[#444746] text-gray-300 border border-[#444746] transition-all text-sm font-bold shadow-sm"
                        >
                            <FileSpreadsheet size={18} className="text-green-500"/> {t('export_csv')}
                        </button>
                    )}
                </div>

                {/* Summary Cards (Daily & Monthly) - Hidden for Staff */}
                {!isStaff && (
                    <div className="grid grid-cols-2 gap-4">
                        {/* Daily Total */}
                        <div className="bg-[#1E1F20] border border-[#444746] rounded-2xl p-4 shadow-lg flex flex-col justify-between relative overflow-hidden">
                             <div className="flex justify-between items-start z-10">
                                 <div>
                                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{t('summary_today')}</span>
                                     <div className="text-lg md:text-xl font-bold text-white mt-1 font-mono tracking-wide">฿ {totalTodayAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                                 </div>
                                 <div className="bg-orange-500/10 p-2 rounded-lg text-orange-500">
                                     <Calculator size={16} />
                                 </div>
                             </div>
                             <div className="mt-2 text-[10px] text-gray-500 font-medium z-10">
                                 {totalTodayCount} {t('tx_count')}
                             </div>
                             {/* Decorative BG */}
                             <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-orange-500/5 rounded-full blur-xl"></div>
                        </div>

                        {/* Monthly Total */}
                        <div className="bg-[#1E1F20] border border-[#444746] rounded-2xl p-4 shadow-lg flex flex-col justify-between relative overflow-hidden">
                             <div className="flex justify-between items-start z-10">
                                 <div>
                                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{t('summary_month')}</span>
                                     <div className="text-lg md:text-xl font-bold text-white mt-1 font-mono tracking-wide">฿ {totalMonthAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                                 </div>
                                 <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                                     <Calendar size={16} />
                                 </div>
                             </div>
                             <div className="mt-2 text-[10px] text-gray-500 font-medium z-10">
                                 {totalMonthCount} {t('tx_count')}
                             </div>
                             {/* Decorative BG */}
                             <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-blue-500/5 rounded-full blur-xl"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Table Card */}
            <div className="bg-[#1E1F20] border border-[#444746] rounded-2xl overflow-hidden shadow-xl">
                {/* Desktop Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-6 p-5 bg-[#2b2d30] border-b border-[#444746] text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <div className="col-span-3">{t('sender')}</div>
                    <div className="col-span-3 text-right">{t('amount')}</div>
                    <div className="col-span-3 text-center">{t('date')}</div>
                    <div className="col-span-3">{t('message')}</div>
                </div>

                {/* Table Body */}
                <div className="relative min-h-[400px]">
                    {loading && !isAutoRefresh && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1E1F20]/50 backdrop-blur-sm">
                            <RefreshCw className="animate-spin text-orange-500" size={40} />
                        </div>
                    )}

                    {displayedTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-80 text-gray-500">
                            <div className="bg-[#2b2d30] p-5 rounded-full mb-4 border border-[#444746] shadow-inner">
                                <History size={40} />
                            </div>
                            <span className="font-semibold text-lg text-gray-400">{t('no_transactions')}</span>
                            {searchQuery && <span className="text-sm mt-1 text-orange-400">"{searchQuery}"</span>}
                            {!searchQuery && <span className="text-sm mt-1 opacity-70">{t('waiting_webhook')}</span>}
                        </div>
                    ) : (
                        <div className="divide-y divide-[#444746]">
                            {displayedTransactions.map((tx) => (
                                <React.Fragment key={tx.id}>
                                    {/* Desktop Row */}
                                    <div className="hidden md:grid grid-cols-12 gap-6 p-5 items-center hover:bg-[#2b2d30] transition-colors group">
                                        <div className="col-span-3 flex items-center gap-4">
                                            <span className="text-base font-semibold text-white font-mono tracking-wide">
                                                {formatPhoneNumber(tx.sender)}
                                            </span>
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <span className="inline-block px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-base font-bold font-mono shadow-sm">
                                                +{tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="col-span-3 text-center text-sm text-gray-400 font-mono">
                                            {formatDate(tx.date)}
                                        </div>
                                        <div className="col-span-3 text-sm text-gray-300 truncate group-hover:text-white transition-colors">
                                            {tx.message}
                                        </div>
                                    </div>

                                    {/* Mobile Card Row */}
                                    <div className="md:hidden p-5 flex flex-col gap-2 hover:bg-[#2b2d30] transition-colors border-b border-[#444746] last:border-0">
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-bold text-white font-mono tracking-wide">
                                                {formatPhoneNumber(tx.sender)}
                                            </span>
                                            <span className="px-3 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-lg font-bold font-mono">
                                                +{tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-400 font-medium flex items-center gap-2 mt-1">
                                            <span className="font-mono">{formatDate(tx.date)}</span>
                                            {tx.message && (
                                                <span className="text-gray-300 truncate flex-1 opacity-80 border-l border-gray-600 pl-2">{tx.message}</span>
                                            )}
                                        </div>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination Footer */}
                <div className="p-5 border-t border-[#444746] bg-[#2b2d30] flex flex-col sm:flex-row justify-between items-center gap-5">
                    <div className="text-sm text-gray-400 text-center sm:text-left font-medium">
                        {t('showing')} <span className="text-white">{displayedTransactions.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> {t('to')} <span className="text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)}</span> {t('of')} <span className="text-white">{filteredTransactions.length}</span> {t('entries')}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1 || loading}
                            className="p-2.5 rounded-lg bg-[#444746] border border-[#505356] text-gray-400 hover:text-white hover:bg-[#505356] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        
                        <div className="px-4 py-2 rounded-lg bg-[#444746] border border-[#505356] text-sm font-bold font-mono text-gray-200 shadow-inner">
                            {t('page')} {currentPage} / {Math.max(totalPages, 1)}
                        </div>

                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage >= totalPages || loading}
                            className="p-2.5 rounded-lg bg-[#444746] border border-[#505356] text-gray-400 hover:text-white hover:bg-[#505356] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Admin Tools Section (Only for Dev) */}
            {isDev && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
                    
                    {/* Left Panel: Configuration */}
                    <div className="bg-[#1E1F20] border border-[#444746] rounded-2xl p-6 shadow-xl">
                        <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                            <Server size={18} /> {t('config_sim')}
                        </h3>

                        <div className="space-y-6">
                            {/* Simulator */}
                            <div className="bg-[#2b2d30] p-6 rounded-xl border border-[#444746] shadow-inner">
                                <label className="text-xs text-gray-400 font-bold uppercase mb-3 block tracking-wide">{t('simulator')}</label>
                                <button 
                                    onClick={handleSimulateWebhook}
                                    className="w-full flex items-center justify-center gap-3 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold py-3.5 rounded-xl shadow-lg shadow-orange-900/40 transition-all active:scale-98"
                                >
                                    <Play size={18} fill="currentColor" /> {t('simulate_btn')}
                                </button>
                                <p className="text-[11px] text-gray-500 mt-3 text-center font-medium">
                                    {t('simulate_desc')} {dataSource === 'live' ? 'Real API' : 'Mock Store'}.
                                </p>
                            </div>

                            {/* Setup Info */}
                            <div className="bg-[#2b2d30] p-6 rounded-xl border border-[#444746] shadow-inner">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">{t('setup_info')}</label>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${dbStatus.includes('Connected') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                        {dbStatus}
                                    </span>
                                </div>
                                
                                <div className="flex gap-3 mb-5">
                                    <div className="flex-1 bg-[#1a1b1d] border border-[#444746] rounded-xl px-4 py-3 text-xs font-mono text-gray-300 overflow-hidden whitespace-nowrap text-ellipsis shadow-inner">
                                        {dataSource === 'live' ? `${currentOrigin}/api/webhook/truemoney` : 'Switch to Live Mode to see URL'}
                                    </div>
                                    <button onClick={handleCopyEndpoint} className="bg-[#444746] hover:bg-[#505356] text-gray-300 p-3 rounded-xl border border-[#505356] transition-colors shadow-sm">
                                        {copied ? <Check size={18} className="text-green-500"/> : <Clipboard size={18}/>}
                                    </button>
                                </div>

                                <div className="pt-4 border-t border-[#444746] space-y-4">
                                    {/* Verification Secret */}
                                    <div>
                                        <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wide">{t('verification_secret')}</label>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input 
                                                type="text" 
                                                value={verificationSecret}
                                                onChange={(e) => { setVerificationSecret(e.target.value); setIsVerified(false); }}
                                                placeholder={t('verification_placeholder')}
                                                className="flex-1 bg-[#1a1b1d] border border-[#444746] text-sm text-gray-200 px-4 py-2.5 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors font-mono shadow-inner placeholder:text-gray-600"
                                            />
                                            <button 
                                                onClick={handleSaveSecret}
                                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${isVerified ? 'bg-green-600 text-white shadow-md shadow-green-900/40' : 'bg-[#444746] hover:bg-[#505356] text-white'}`}
                                            >
                                                {isVerified ? <Check size={16} /> : t('save')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Service Token Input */}
                                    <div>
                                        <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wide">{t('service_token')}</label>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input 
                                                type="text" 
                                                value={serviceToken}
                                                onChange={(e) => setServiceToken(e.target.value)}
                                                placeholder={t('service_token_placeholder')}
                                                className="flex-1 bg-[#1a1b1d] border border-[#444746] text-sm text-gray-200 px-4 py-2.5 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors font-mono shadow-inner placeholder:text-gray-600"
                                            />
                                            <button 
                                                onClick={handleSaveServiceToken}
                                                className="px-4 py-2.5 bg-[#444746] hover:bg-[#505356] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                                            >
                                                {t('save')}
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Tester & AI */}
                    <div className="bg-[#1E1F20] border border-[#444746] rounded-2xl p-6 shadow-xl">
                        <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                            <Code size={18} /> {t('advanced_tools')}
                        </h3>

                        <div className="space-y-6">
                            {/* JSON Tester */}
                            <div className="bg-[#2b2d30] p-6 rounded-xl border border-[#444746] shadow-inner">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">{t('payload_tester')}</label>
                                </div>
                                <textarea 
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder={t('payload_placeholder')}
                                    className="w-full bg-[#1a1b1d] border border-[#444746] text-gray-200 text-xs p-4 rounded-xl h-28 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono resize-none mb-3 placeholder:text-gray-600 shadow-inner"
                                />
                                {jsonError && <p className="text-red-400 text-xs mb-3 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 flex items-center gap-2"><X size={12}/>{jsonError}</p>}
                                <button 
                                    onClick={handlePayloadTest}
                                    className="w-full flex items-center justify-center gap-2 bg-[#444746] hover:bg-[#505356] text-white text-xs font-bold py-3 rounded-xl transition-all uppercase tracking-wide shadow-sm"
                                >
                                    <Play size={14} /> {t('send_payload')}
                                </button>
                            </div>

                            {/* AI Analysis */}
                            <div className="bg-[#2b2d30] p-6 rounded-xl border border-[#444746] shadow-inner">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs text-gray-400 font-bold uppercase flex items-center gap-2 tracking-wide">
                                        <Sparkles size={14} className="text-purple-400" /> {t('ai_analysis')}
                                    </label>
                                    <button 
                                        onClick={handleGeminiAnalysis}
                                        disabled={analyzing}
                                        className="text-[10px] text-purple-400 hover:text-purple-300 underline disabled:opacity-50 font-medium"
                                    >
                                        {analyzing ? t('thinking') : t('analyze_btn')}
                                    </button>
                                </div>
                                <div className="bg-[#1a1b1d] p-4 rounded-xl min-h-[70px] text-sm text-gray-400 border border-[#444746] leading-relaxed italic shadow-inner">
                                    {analysis || "AI analysis of your transactions will appear here..."}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in zoom-in-95 duration-300">
            <div 
                className="bg-[#1E1F20] p-8 rounded-2xl border border-[#444746] flex flex-col items-center text-center hover:border-orange-500/50 hover:shadow-2xl transition-all cursor-pointer group shadow-lg"
                onClick={() => setActiveTab('dashboard')}
            >
                <div className="bg-orange-500/10 p-6 rounded-full mb-6 text-orange-500 group-hover:bg-orange-600 group-hover:text-white transition-all shadow-inner border border-orange-500/20">
                    <BellRing size={40} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{t('svc_incoming')}</h3>
                <p className="text-sm text-gray-400 mb-6 font-medium">{t('svc_incoming_desc')}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full border border-green-500/20">{t('active')}</span>
            </div>
            
            <div className="bg-[#1E1F20] p-8 rounded-2xl border border-[#444746] flex flex-col items-center text-center opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer shadow-lg">
                <div className="bg-[#2b2d30] p-6 rounded-full mb-6 text-gray-400 shadow-inner border border-[#444746]">
                    <Smartphone size={40} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{t('svc_outgoing')}</h3>
                <p className="text-sm text-gray-400 mb-6 font-medium">{t('svc_outgoing_desc')}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#2b2d30] text-gray-400 px-3 py-1.5 rounded-full border border-[#444746]">{t('soon')}</span>
            </div>

            <div 
                className="bg-[#1E1F20] p-8 rounded-2xl border border-[#444746] flex flex-col items-center text-center hover:border-blue-400/50 hover:shadow-2xl transition-all cursor-pointer group shadow-lg"
                onClick={handleCheckBalance}
            >
                <div className="bg-[#2b2d30] p-6 rounded-full mb-6 text-gray-400 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-inner border border-[#444746]">
                    <Wallet size={40} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{t('svc_balance')}</h3>
                <p className="text-sm text-gray-400 mb-6 font-medium">{t('svc_balance_desc')}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/20">{t('demo')}</span>
            </div>

            <div 
                className="bg-[#1E1F20] p-8 rounded-2xl border border-[#444746] flex flex-col items-center text-center hover:border-orange-500/50 hover:shadow-2xl transition-all cursor-pointer group shadow-lg"
                onClick={handleCheckLastTx}
            >
                <div className="bg-orange-500/10 p-6 rounded-full mb-6 text-orange-500 group-hover:bg-orange-600 group-hover:text-white transition-all shadow-inner border border-orange-500/20">
                    <History size={40} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{t('svc_last_tx')}</h3>
                <p className="text-sm text-gray-400 mb-6 font-medium">{t('svc_last_tx_desc')}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-full border border-purple-500/20">{t('api')}</span>
            </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && isAdmin && (
          <div className="bg-[#1E1F20] border border-[#444746] rounded-2xl p-6 shadow-xl animate-in fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-5">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                      <Users className="text-orange-500" size={28} /> {t('user_management')}
                  </h2>
                  <button 
                    onClick={() => openUserModal()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-orange-900/40"
                  >
                      <Plus size={18} /> {t('add_user')}
                  </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#444746] shadow-lg">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-[#2b2d30] text-gray-400 text-xs font-bold uppercase tracking-widest">
                              <th className="p-5">{t('username')}</th>
                              <th className="p-5 hidden sm:table-cell">{t('role')}</th>
                              <th className="p-5 text-right"></th>
                          </tr>
                      </thead>
                      <tbody className="text-sm text-gray-200 divide-y divide-[#444746] bg-[#1E1F20]">
                          {filteredUsersList.map(u => (
                              <tr key={u.id} className="hover:bg-[#2b2d30] transition-colors">
                                  <td className="p-5">
                                      <div className="font-bold text-lg text-white">{u.username}</div>
                                      <div className="sm:hidden mt-2">
                                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${u.role === 'dev' ? 'bg-red-500/10 text-red-400 border-red-500/20' : u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                              {u.role === 'dev' ? t('role_dev') : u.role === 'admin' ? t('role_admin') : t('role_staff')}
                                          </span>
                                      </div>
                                  </td>
                                  <td className="p-5 hidden sm:table-cell">
                                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${u.role === 'dev' ? 'bg-red-500/10 text-red-400 border-red-500/20' : u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                          {u.role === 'dev' ? t('role_dev') : u.role === 'admin' ? t('role_admin') : t('role_staff')}
                                      </span>
                                  </td>
                                  <td className="p-5 flex justify-end gap-3">
                                      {/* Admin can edit Staff. Dev can edit everyone. */}
                                      {(isDev || (isAdmin && u.role === 'staff')) && (
                                        <button 
                                            onClick={() => openUserModal(u)}
                                            className="p-2.5 hover:bg-[#444746] rounded-lg text-gray-400 hover:text-white transition-colors border border-transparent hover:border-[#505356]"
                                        >
                                            <Edit size={18} />
                                        </button>
                                      )}
                                      
                                      {(isDev || (isAdmin && u.role === 'staff')) && (
                                        <button 
                                            onClick={() => handleDeleteUser(u.id)}
                                            className="p-2.5 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors border border-transparent hover:border-red-500/30"
                                            disabled={u.username.toLowerCase() === 'owner'}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Code Tab */}
      {activeTab === 'code' && isDev && (
        <div className="bg-[#1a1a1a] rounded-2xl border border-[#444746] overflow-hidden shadow-2xl animate-in fade-in">
             <div className="bg-[#2b2d30] px-5 py-4 border-b border-[#444746] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    </div>
                    <span className="text-xs font-mono text-gray-400 ml-2 font-medium">api/index.js</span>
                </div>
                <button 
                    onClick={handleCopyBackendCode}
                    className="text-xs bg-[#444746] hover:bg-[#505356] text-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-[#505356] font-bold uppercase tracking-wide"
                >
                    {codeCopied ? <Check size={16} className="text-green-500"/> : <Clipboard size={16} />} {t('copy')}
                </button>
             </div>
             <div className="p-0 overflow-x-auto bg-[#1a1a1a]">
                 <pre className="text-xs md:text-sm font-mono text-gray-300 p-8 leading-relaxed whitespace-pre-wrap">
                    <code className="language-javascript">{backendCodeString}</code>
                 </pre>
             </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-[#1E1F20] rounded-2xl shadow-2xl border border-[#444746] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-5 border-b border-[#444746] flex justify-between items-center bg-[#2b2d30]">
                      <h3 className="text-white font-bold text-lg">{editingUser ? t('edit_user') : t('new_user')}</h3>
                      <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                          <X size={24} />
                      </button>
                  </div>
                  <form onSubmit={handleUserSubmit} className="p-8 space-y-5">
                      {userFormError && (
                          <div className="bg-red-500/10 text-red-300 text-sm p-3 rounded-xl border border-red-500/20 flex items-center gap-2">
                              <X size={16} /> {userFormError}
                          </div>
                      )}
                      <div>
                          <label className="block text-gray-400 text-xs font-bold uppercase mb-2 tracking-wide">{t('username')}</label>
                          <input 
                              type="text" 
                              required
                              value={userForm.username}
                              onChange={e => setUserForm({...userForm, username: e.target.value})}
                              className="w-full bg-[#2b2d30] border border-[#444746] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors text-base"
                          />
                      </div>
                      <div>
                          <label className="block text-gray-400 text-xs font-bold uppercase mb-2 tracking-wide">{t('password')}</label>
                          <input 
                              type="text" 
                              required
                              value={userForm.password}
                              onChange={e => setUserForm({...userForm, password: e.target.value})}
                              className="w-full bg-[#2b2d30] border border-[#444746] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors text-base"
                          />
                      </div>
                      <div>
                          <label className="block text-gray-400 text-xs font-bold uppercase mb-2 tracking-wide">{t('role')}</label>
                          <div className="relative">
                            <select 
                                value={userForm.role}
                                onChange={e => setUserForm({...userForm, role: e.target.value as 'dev'|'admin'|'staff'})}
                                className="w-full bg-[#2b2d30] border border-[#444746] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors appearance-none text-base"
                            >
                                <option value="staff">{t('role_staff')}</option>
                                {/* Admin can create Staff. Dev can create everything. */}
                                {isDev && <option value="admin">{t('role_admin')}</option>}
                                {isDev && <option value="dev">{t('role_dev')}</option>}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                <ChevronRight size={16} className="rotate-90" />
                            </div>
                          </div>
                      </div>
                      <div className="pt-6 flex justify-end gap-3">
                          <button 
                            type="button" 
                            onClick={() => setIsUserModalOpen(false)}
                            className="px-5 py-2.5 bg-[#2b2d30] hover:bg-[#444746] text-gray-300 rounded-xl text-sm font-bold transition-colors border border-[#444746]"
                          >
                              {t('cancel')}
                          </button>
                          <button 
                            type="submit" 
                            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-orange-900/40"
                          >
                              {t('save_user')}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};

export default Dashboard;