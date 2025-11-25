import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Transaction, User } from '../types';
import { fetchTransactions, simulateIncomingWebhook, clearAllData, getUsers, addUser, updateUser, deleteUser } from '../services/mockService';
import { fetchLiveTransactions, triggerLiveWebhook, clearLiveTransactions, fetchUsersApi, addUserApi, updateUserApi, deleteUserApi } from '../services/apiService';
import { analyzeTransactions } from '../services/geminiService';
import { RefreshCw, Sparkles, Server, Clipboard, Check, Clock, Power, Play, Code, Trash2, FileText, LayoutDashboard, Globe, Database, Lock, Users, Edit, Plus, X, Wallet, BellRing, History, Smartphone, LayoutGrid, KeyRound, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { t } = useLanguage();
  const isAdmin = user.role === 'admin';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'users' | 'code'>('dashboard');
  
  // Initialize DataSource with Persistence
  const [dataSource, setDataSource] = useState<'mock' | 'live'>(() => {
    if (!isAdmin) return 'live';
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

  // Database Status Check
  const [dbStatus, setDbStatus] = useState<string>('Checking...');

  // User Management State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'member' as 'admin' | 'member' });
  const [userFormError, setUserFormError] = useState('');

  // Constants
  const ITEMS_PER_PAGE = 20;
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  useEffect(() => {
    if (!isAdmin) {
      setDataSource('live');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
        localStorage.setItem('tm_datasource_pref', dataSource);
    }
  }, [dataSource, isAdmin]);

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

  useEffect(() => {
      if (isAdmin) {
          checkDbStatus();
          const statusInterval = setInterval(checkDbStatus, 30000); 
          return () => clearInterval(statusInterval);
      }
  }, [isAdmin, checkDbStatus]);

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

      // Sort Date Descending
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
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadData, isAutoRefresh]);

  const toggleAutoRefresh = () => setIsAutoRefresh(prev => !prev);

  const handleManualRefresh = () => {
    loadData();
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
    const randomSender = `${prefix}${middle}${last}`; // Send raw, format later
    
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

  const handleCheckBalance = () => {
      alert(`Balance (Demo): ${Math.floor(Math.random() * 100000).toLocaleString()} THB`);
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
          setUserForm({ username: '', password: '', role: 'member' });
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

  const formatPhoneNumber = (phoneNumber: string) => {
      if (!phoneNumber) return '-';
      const cleaned = phoneNumber.replace(/\D/g, '');
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
      return phoneNumber;
  };

  // Pagination Logic
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const displayedTransactions = transactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const backendCodeString = `// Backend Logic (api/index.js)...`.trim();

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 mt-4 sm:mt-8 font-sans pb-24 text-slate-200">
      
      {/* Header / Title Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Wallet className="text-orange-500" />
                <span>TrueMoney <span className="text-slate-500 font-light hidden xs:inline">/ Webhook Dashboard</span></span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{t('dashboard_subtitle')}</p>
        </div>

        {/* Navigation Tabs (Glass Style) */}
        {isAdmin && (
            <div className="w-full md:w-auto flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 backdrop-blur-md overflow-x-auto no-scrollbar">
                {[
                    { id: 'dashboard', label: t('tab_dashboard'), icon: LayoutDashboard },
                    { id: 'services', label: t('tab_services'), icon: LayoutGrid },
                    { id: 'users', label: t('tab_users'), icon: Users },
                    { id: 'code', label: t('tab_code'), icon: Code },
                ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                    >
                        <tab.icon size={16} /> <span className="hidden xs:inline">{tab.label}</span>
                    </button>
                ))}
            </div>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-4 sm:space-y-6">
            
            {/* Control Bar */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-sm shadow-xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                
                {/* Data Source Toggle */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-wider w-full sm:w-auto text-left">{t('source')}</span>
                     <div className="w-full sm:w-auto flex bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
                         {isAdmin ? (
                            <>
                                <button 
                                    onClick={() => { setDataSource('mock'); setCurrentPage(1); }}
                                    className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dataSource === 'mock' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    <Database size={12} /> {t('mock')}
                                </button>
                                <button 
                                    onClick={() => { setDataSource('live'); setCurrentPage(1); }}
                                    className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dataSource === 'live' ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    <Globe size={12} /> {t('live')}
                                </button>
                            </>
                         ) : (
                             <div className="w-full flex justify-center items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                                 <Globe size={12} /> {t('live')}
                             </div>
                         )}
                     </div>
                </div>

                {/* Status & Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-sm">
                    <div className="hidden lg:flex items-center gap-2 text-slate-400 bg-slate-900/30 px-3 py-1.5 rounded-lg border border-slate-800">
                        <Clock size={14} className="text-orange-500"/> 
                        <span className="text-xs font-mono">{lastUpdated.toLocaleTimeString('th-TH')}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:flex gap-3">
                        <button 
                            onClick={toggleAutoRefresh}
                            className={`flex justify-center items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg border transition-all text-xs font-medium ${isAutoRefresh ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                            <Power size={12} /> {isAutoRefresh ? t('auto_on') : t('auto_off')}
                        </button>

                        <button 
                            onClick={handleManualRefresh}
                            disabled={loading}
                            className="flex justify-center items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all text-xs font-medium"
                        >
                            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> {t('refresh')}
                        </button>
                    </div>

                    {isAdmin && (
                        <button 
                            onClick={handleClearData}
                            className="flex justify-center items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 transition-all text-xs font-medium"
                        >
                            <Trash2 size={12} /> {t('clear')}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
                {/* Desktop Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-slate-900/50 border-b border-slate-700/50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="col-span-3">{t('sender')}</div>
                    <div className="col-span-3 text-right">{t('amount')}</div>
                    <div className="col-span-3 text-center">{t('date')}</div>
                    <div className="col-span-3">{t('message')}</div>
                </div>

                {/* Table Body */}
                <div className="relative min-h-[400px]">
                    {loading && !isAutoRefresh && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px]">
                            <RefreshCw className="animate-spin text-orange-500" size={32} />
                        </div>
                    )}

                    {displayedTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                            <div className="bg-slate-800/50 p-4 rounded-full mb-3">
                                <History size={32} />
                            </div>
                            <span className="font-medium">{t('no_transactions')}</span>
                            <span className="text-xs mt-1">{t('waiting_webhook')}</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-700/30">
                            {displayedTransactions.map((tx) => (
                                <React.Fragment key={tx.id}>
                                    {/* Desktop Row */}
                                    <div className="hidden md:grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors group">
                                        <div className="col-span-3 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                                                {tx.sender.slice(0, 2)}
                                            </div>
                                            <span className="text-sm font-medium text-slate-200 font-mono tracking-wide">
                                                {formatPhoneNumber(tx.sender)}
                                            </span>
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <span className="inline-block px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-bold font-mono">
                                                +{tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="col-span-3 text-center text-xs text-slate-400 font-mono">
                                            {formatDate(tx.date)}
                                        </div>
                                        <div className="col-span-3 text-sm text-slate-300 truncate opacity-80 group-hover:opacity-100">
                                            {tx.message}
                                        </div>
                                    </div>

                                    {/* Mobile Card Row */}
                                    <div className="md:hidden p-4 flex flex-col gap-3 hover:bg-white/5 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                 <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                                                    {tx.sender.slice(0, 2)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-200 font-mono tracking-wide">
                                                        {formatPhoneNumber(tx.sender)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        {formatDate(tx.date)}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-bold font-mono">
                                                +{tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="pl-10 text-sm text-slate-300 break-words bg-slate-900/30 p-2 rounded-lg border border-slate-700/30">
                                            <span className="text-xs text-slate-500 block mb-1 uppercase tracking-wider">{t('message')}:</span>
                                            {tx.message || "-"}
                                        </div>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t border-slate-700/50 bg-slate-900/30 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-xs text-slate-500 text-center sm:text-left">
                        {t('showing')} {displayedTransactions.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} {t('to')} {Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)} {t('of')} {transactions.length} {t('entries')}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1 || loading}
                            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
                            {t('page')} {currentPage} / {Math.max(totalPages, 1)}
                        </div>

                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage >= totalPages || loading}
                            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Admin Tools Section */}
            {isAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    
                    {/* Left Panel: Configuration */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Server size={16} className="text-blue-500" /> {t('config_sim')}
                        </h3>

                        <div className="space-y-4">
                            {/* Simulator */}
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">{t('simulator')}</label>
                                <button 
                                    onClick={handleSimulateWebhook}
                                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-sm font-medium py-2.5 rounded-lg shadow-lg shadow-orange-900/20 transition-all active:scale-95"
                                >
                                    <Play size={16} fill="currentColor" /> {t('simulate_btn')}
                                </button>
                                <p className="text-[10px] text-slate-500 mt-2 text-center">
                                    {t('simulate_desc')} {dataSource === 'live' ? 'Real API' : 'Mock Store'}.
                                </p>
                            </div>

                            {/* Setup Info */}
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase">{t('setup_info')}</label>
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${dbStatus.includes('Connected') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                        {dbStatus}
                                    </span>
                                </div>
                                
                                <div className="flex gap-2 mb-3">
                                    <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 overflow-hidden whitespace-nowrap text-ellipsis">
                                        {dataSource === 'live' ? `${currentOrigin}/api/webhook/truemoney` : 'Switch to Live Mode to see URL'}
                                    </div>
                                    <button onClick={handleCopyEndpoint} className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700 transition-colors">
                                        {copied ? <Check size={16} className="text-green-500"/> : <Clipboard size={16}/>}
                                    </button>
                                </div>

                                <div className="pt-3 border-t border-slate-800">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">{t('verification_secret')}</label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input 
                                            type="text" 
                                            value={verificationSecret}
                                            onChange={(e) => { setVerificationSecret(e.target.value); setIsVerified(false); }}
                                            placeholder={t('verification_placeholder')}
                                            className="flex-1 bg-slate-950 border border-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg focus:outline-none focus:border-green-500/50 transition-colors font-mono"
                                        />
                                        <button 
                                            onClick={handleSaveSecret}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${isVerified ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                                        >
                                            {isVerified ? <Check size={14} /> : t('save')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Tester & AI */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Code size={16} className="text-purple-500" /> {t('advanced_tools')}
                        </h3>

                        <div className="space-y-4">
                            {/* JSON Tester */}
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase">{t('payload_tester')}</label>
                                </div>
                                <textarea 
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder={t('payload_placeholder')}
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs p-3 rounded-lg h-24 focus:border-orange-500/50 focus:outline-none font-mono resize-none mb-2"
                                />
                                {jsonError && <p className="text-red-400 text-xs mb-2 bg-red-900/20 p-2 rounded border border-red-900/30">{jsonError}</p>}
                                <button 
                                    onClick={handlePayloadTest}
                                    className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                                >
                                    <Play size={14} /> {t('send_payload')}
                                </button>
                            </div>

                            {/* AI Analysis */}
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase flex items-center gap-1">
                                        <Sparkles size={12} className="text-purple-400" /> {t('ai_analysis')}
                                    </label>
                                    <button 
                                        onClick={handleGeminiAnalysis}
                                        disabled={analyzing}
                                        className="text-[10px] text-purple-400 hover:text-purple-300 underline disabled:opacity-50"
                                    >
                                        {analyzing ? t('thinking') : t('analyze_btn')}
                                    </button>
                                </div>
                                <div className="bg-slate-950 p-3 rounded-lg min-h-[60px] text-xs text-slate-300 border border-slate-800 leading-relaxed italic">
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
      {activeTab === 'services' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <div 
                className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 flex flex-col items-center text-center hover:border-orange-500/50 hover:bg-slate-800/60 transition-all cursor-pointer group backdrop-blur-sm"
                onClick={() => setActiveTab('dashboard')}
            >
                <div className="bg-orange-500/10 p-5 rounded-full mb-4 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-lg shadow-orange-900/20">
                    <BellRing size={36} />
                </div>
                <h3 className="text-white font-bold mb-2">{t('svc_incoming')}</h3>
                <p className="text-sm text-slate-400 mb-4">{t('svc_incoming_desc')}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/20">{t('active')}</span>
            </div>
            
            <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 flex flex-col items-center text-center opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
                <div className="bg-blue-500/10 p-5 rounded-full mb-4 text-blue-500">
                    <Smartphone size={36} />
                </div>
                <h3 className="text-white font-bold mb-2">{t('svc_outgoing')}</h3>
                <p className="text-sm text-slate-400 mb-4">{t('svc_outgoing_desc')}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-slate-400 px-2 py-1 rounded-full border border-slate-600">{t('soon')}</span>
            </div>

            <div 
                className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 flex flex-col items-center text-center hover:border-green-500/50 hover:bg-slate-800/60 transition-all cursor-pointer group backdrop-blur-sm"
                onClick={handleCheckBalance}
            >
                <div className="bg-green-500/10 p-5 rounded-full mb-4 text-green-500 group-hover:bg-green-500 group-hover:text-white transition-all shadow-lg shadow-green-900/20">
                    <Wallet size={36} />
                </div>
                <h3 className="text-white font-bold mb-2">{t('svc_balance')}</h3>
                <p className="text-sm text-slate-400 mb-4">{t('svc_balance_desc')}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full border border-blue-500/20">{t('demo')}</span>
            </div>

            <div 
                className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 flex flex-col items-center text-center hover:border-purple-500/50 hover:bg-slate-800/60 transition-all cursor-pointer group backdrop-blur-sm"
                onClick={handleCheckLastTx}
            >
                <div className="bg-purple-500/10 p-5 rounded-full mb-4 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all shadow-lg shadow-purple-900/20">
                    <History size={36} />
                </div>
                <h3 className="text-white font-bold mb-2">{t('svc_last_tx')}</h3>
                <p className="text-sm text-slate-400 mb-4">{t('svc_last_tx_desc')}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/20">{t('api')}</span>
            </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 sm:p-6 backdrop-blur-sm shadow-xl animate-in fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="text-orange-500" size={24} /> {t('user_management')}
                  </h2>
                  <button 
                    onClick={() => openUserModal()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-orange-900/20"
                  >
                      <Plus size={18} /> {t('add_user')}
                  </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-700/50">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-slate-900/80 text-slate-400 text-xs font-bold uppercase tracking-wider">
                              <th className="p-4">{t('username')}</th>
                              <th className="p-4 hidden sm:table-cell">{t('role')}</th>
                              <th className="p-4 text-right"></th>
                          </tr>
                      </thead>
                      <tbody className="text-sm text-slate-300 divide-y divide-slate-700/50 bg-slate-800/30">
                          {usersList.map(u => (
                              <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                  <td className="p-4">
                                      <div className="font-medium text-white">{u.username}</div>
                                      <div className="sm:hidden mt-1">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : 'bg-blue-500/10 text-blue-300 border-blue-500/20'}`}>
                                              {u.role === 'admin' ? t('role_admin') : t('role_member')}
                                          </span>
                                      </div>
                                  </td>
                                  <td className="p-4 hidden sm:table-cell">
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : 'bg-blue-500/10 text-blue-300 border-blue-500/20'}`}>
                                          {u.role === 'admin' ? t('role_admin') : t('role_member')}
                                      </span>
                                  </td>
                                  <td className="p-4 flex justify-end gap-2">
                                      <button 
                                        onClick={() => openUserModal(u)}
                                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                      >
                                          <Edit size={16} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteUser(u.id)}
                                        className="p-2 hover:bg-red-900/30 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                                        disabled={u.username === 'admin'}
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Code Tab */}
      {activeTab === 'code' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl animate-in fade-in">
             <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    </div>
                    <span className="text-xs font-mono text-slate-400 ml-3">api/index.js</span>
                </div>
                <button 
                    onClick={handleCopyBackendCode}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
                >
                    {codeCopied ? <Check size={14} className="text-green-500"/> : <Clipboard size={14} />} {t('copy')}
                </button>
             </div>
             <div className="p-0 overflow-x-auto bg-[#0a0f1c]">
                 <pre className="text-xs md:text-sm font-mono text-slate-300 p-6 leading-relaxed whitespace-pre-wrap">
                    <code className="language-javascript">{backendCodeString}</code>
                 </pre>
             </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                      <h3 className="text-white font-bold">{editingUser ? t('edit_user') : t('new_user')}</h3>
                      <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
                      {userFormError && (
                          <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg border border-red-500/20 flex items-center gap-2">
                              <X size={14} /> {userFormError}
                          </div>
                      )}
                      <div>
                          <label className="block text-slate-400 text-xs font-bold uppercase mb-1.5">{t('username')}</label>
                          <input 
                              type="text" 
                              required
                              value={userForm.username}
                              onChange={e => setUserForm({...userForm, username: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                          />
                      </div>
                      <div>
                          <label className="block text-slate-400 text-xs font-bold uppercase mb-1.5">{t('password')}</label>
                          <input 
                              type="text" 
                              required
                              value={userForm.password}
                              onChange={e => setUserForm({...userForm, password: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                          />
                      </div>
                      <div>
                          <label className="block text-slate-400 text-xs font-bold uppercase mb-1.5">{t('role')}</label>
                          <select 
                              value={userForm.role}
                              onChange={e => setUserForm({...userForm, role: e.target.value as 'admin'|'member'})}
                              className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-orange-500 transition-colors appearance-none"
                          >
                              <option value="member">{t('role_member')}</option>
                              <option value="admin">{t('role_admin')}</option>
                          </select>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button 
                            type="button" 
                            onClick={() => setIsUserModalOpen(false)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                              {t('cancel')}
                          </button>
                          <button 
                            type="submit" 
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-orange-900/20"
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