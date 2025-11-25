import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Transaction, User } from '../types';
import { fetchTransactions, simulateIncomingWebhook, clearAllData, getUsers, addUser, updateUser, deleteUser } from '../services/mockService';
import { fetchLiveTransactions, triggerLiveWebhook, clearLiveTransactions } from '../services/apiService';
import { analyzeTransactions } from '../services/geminiService';
import { RefreshCw, Sparkles, Server, Clipboard, Check, Clock, Power, Play, Code, Trash2, FileText, LayoutDashboard, Globe, Database, Lock, Users, Edit, Plus, X, Wallet, BellRing, History, Smartphone, LayoutGrid } from 'lucide-react';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const isAdmin = user.role === 'admin';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'services' | 'users' | 'code'>('dashboard');
  
  // If not admin, force 'live' mode initially
  const [dataSource, setDataSource] = useState<'mock' | 'live'>(isAdmin ? 'mock' : 'live');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [analysis, setAnalysis] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  
  // Auto Refresh State
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const REFRESH_INTERVAL = 10000; // 10 Seconds for faster feedback
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Payload Tester State
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Copy State
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // User Management State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'member' as 'admin' | 'member' });
  const [userFormError, setUserFormError] = useState('');

  // Constants
  const ITEMS_PER_PAGE = 10;
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  // Enforce Live Mode for non-admins
  useEffect(() => {
    if (!isAdmin) {
      setDataSource('live');
    }
  }, [isAdmin]);

  const loadData = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);
    try {
      if (dataSource === 'mock') {
          // Fetch from LocalStorage Mock
          const { data } = await fetchTransactions(currentPage, ITEMS_PER_PAGE);
          setTransactions(data);
      } else {
          // Fetch from Real Server API
          const data = await fetchLiveTransactions();
          // Sort client-side for simple display
          data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(data);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  }, [currentPage, dataSource]);

  // Load Users
  const loadUsers = () => {
      setUsersList(getUsers());
  };

  // Initial Load & Auto Refresh Logic
  useEffect(() => {
    loadData();
    if (isAdmin) loadUsers();

    if (isAutoRefresh) {
      timerRef.current = setInterval(() => {
        loadData(true); // Background refresh without full loading spinner
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadData, isAutoRefresh, isAdmin]);

  const toggleAutoRefresh = () => {
    setIsAutoRefresh(prev => !prev);
  };

  const handleManualRefresh = () => {
    loadData();
  };

  const handleClearData = async () => {
      if (dataSource === 'mock') {
          clearAllData();
      } else {
          await clearLiveTransactions();
          loadData();
      }
  }

  const handleSimulateWebhook = async () => {
    const randomAmount = Math.floor(Math.random() * 1000) + 50;
    const prefix = `08${Math.floor(Math.random() * 10)}`; 
    const middle = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const last = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const randomSender = `${prefix}-${middle}-${last}`;
    
    if (dataSource === 'mock') {
        simulateIncomingWebhook(randomAmount, randomSender);
        refreshTable();
    } else {
        // Trigger via API
        await triggerLiveWebhook({
            amount: randomAmount,
            sender_mobile: randomSender,
            message: 'Live Simulation',
            received_time: new Date().toISOString()
        });
        // Wait a bit for server to process then refresh
        setTimeout(loadData, 500);
    }
  };

  const handlePayloadTest = async () => {
    setJsonError('');
    const trimmedInput = jsonInput.trim();

    if (!trimmedInput) {
      setJsonError('กรุณากรอก JSON หรือ JWT Token');
      return;
    }

    try {
      let data: any = null;

      // Check if input is JWT
      if (trimmedInput.split('.').length === 3) {
        try {
            const base64Url = trimmedInput.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            data = JSON.parse(jsonPayload);
        } catch (e) {
            setJsonError('รูปแบบ Token ไม่ถูกต้อง (Base64 Decode Error)');
            return;
        }
      } else {
        try {
            data = JSON.parse(trimmedInput);
        } catch (e) {
            setJsonError('รูปแบบข้อมูลไม่ถูกต้อง (ไม่ใช่ JSON หรือ Token)');
            return;
        }
      }

      if (!data) {
          setJsonError('ไม่สามารถอ่านข้อมูลได้');
          return;
      }

      // If Live Mode, send directly to API Endpoint to test full flow
      if (dataSource === 'live') {
           await triggerLiveWebhook(data);
           setJsonInput('');
           setTimeout(loadData, 500);
           return;
      }

      // If Mock Mode, process locally
      const amount = Number(data.amount || data.txn_amount || 0);
      const sender = data.sender_mobile || data.payer_mobile || 'Unknown';
      const message = data.message || 'Webhook Payload';
      
      if (amount === 0) {
         setJsonError('ไม่พบยอดเงิน (amount)');
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
      setJsonInput(''); // Clear input on success
      refreshTable();

    } catch (e) {
      console.error(e);
      setJsonError('เกิดข้อผิดพลาดในการประมวลผล');
    }
  };

  const refreshTable = () => {
    if (currentPage === 1) {
      loadData();
    } else {
      setCurrentPage(1);
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

  // --- Mock Service Handlers ---
  const handleCheckBalance = () => {
      alert(`ยอดเงินคงเหลือในกระเป๋า (จำลอง): ${Math.floor(Math.random() * 100000).toLocaleString()} THB`);
  };

  const handleCheckLastTx = () => {
      handleManualRefresh();
      alert("ดึงข้อมูลรายการล่าสุดเรียบร้อยแล้ว");
      setActiveTab('dashboard');
  };

  // --- User Management Handlers ---
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

  const handleUserSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setUserFormError('');
      try {
          if (editingUser) {
              updateUser(editingUser.id, userForm);
          } else {
              addUser(userForm);
          }
          loadUsers();
          setIsUserModalOpen(false);
      } catch (err: any) {
          setUserFormError(err.message);
      }
  };

  const handleDeleteUser = (id: string) => {
      if (confirm('ต้องการลบผู้ใช้งานนี้ใช่หรือไม่?')) {
          try {
              deleteUser(id);
              loadUsers();
          } catch (err: any) {
              alert(err.message);
          }
      }
  };


  // Format date for Thai locale
  const formatDate = (isoString: string) => {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        });
    } catch (e) {
        return isoString;
    }
  };

  const backendCodeString = `
// นี่คือโค้ดที่รันอยู่ใน api/index.js (Vercel Serverless Function)
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Database (Reset on restart)
let transactions = [];
let users = [
    { id: '1', username: 'admin', password: 'admin', role: 'admin' },
    { id: '2', username: 'staff', password: '1234', role: 'member' }
];

// --- Webhook ---
app.post('/api/webhook/truemoney', (req, res) => {
    const token = req.body.message || req.body;
    // ... decoding logic ...
    transactions.unshift(newTransaction);
    res.status(200).send({ status: 'success' });
});

app.get('/api/transactions', (req, res) => {
    res.json(transactions);
});

// --- User Management ---
app.get('/api/users', (req, res) => res.json(users));

app.post('/api/users', (req, res) => {
    const { username, password, role } = req.body;
    if (users.find(u => u.username === username)) return res.status(400).json({error: 'Exists'});
    const newUser = { id: Date.now().toString(), username, password, role };
    users.push(newUser);
    res.json(newUser);
});

app.put('/api/users/:id', (req, res) => {
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({error: 'Not found'});
    users[idx] = { ...users[idx], ...req.body };
    res.json(users[idx]);
});

app.delete('/api/users/:id', (req, res) => {
    users = users.filter(u => u.id !== req.params.id);
    res.json({status: 'deleted'});
});

export default app;
  `.trim();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mt-8 font-sans pb-20">
      
      {/* Title / Breadcrumb */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-xl font-medium text-white tracking-wide">
          <span className="font-bold text-orange-500">TrueMoney</span>
          <span className="mx-3 text-gray-500">/</span>
          <span className="text-gray-300">Transaction Monitor</span>
        </h1>

        {/* Tab Switcher - Only visible to Admin */}
        {isAdmin && (
            <div className="flex bg-[#1e293b] p-1 rounded-lg border border-gray-700">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    <LayoutDashboard size={16} /> Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('services')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all ${activeTab === 'services' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    <LayoutGrid size={16} /> Services
                </button>
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all ${activeTab === 'users' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    <Users size={16} /> Users
                </button>
                <button 
                    onClick={() => setActiveTab('code')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all ${activeTab === 'code' ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    <Code size={16} /> Backend Code
                </button>
            </div>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <>
            {/* Controls */}
            <div className="mb-6 bg-[#1a2234] border border-gray-700 p-4 rounded-lg shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    
                    {/* Source Toggle */}
                    <div className="flex items-center gap-3">
                         <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Data Source:</span>
                         <div className="flex bg-[#0f172a] p-1 rounded border border-gray-600">
                             {isAdmin ? (
                                <>
                                    <button 
                                        onClick={() => { setDataSource('mock'); setCurrentPage(1); }}
                                        className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-all ${dataSource === 'mock' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Database size={12} /> Local Mock
                                    </button>
                                    <button 
                                        onClick={() => { setDataSource('live'); setCurrentPage(1); }}
                                        className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-all ${dataSource === 'live' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Globe size={12} /> Live Server (API)
                                    </button>
                                </>
                             ) : (
                                 <div className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-green-900/40 text-green-400 border border-green-800/50">
                                     <Globe size={12} /> Live Server Active
                                 </div>
                             )}
                         </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 text-xs">
                        <div className="hidden md:flex items-center gap-1 text-gray-400">
                            <Clock size={12} /> 
                            <span>อัปเดต: {lastUpdated.toLocaleTimeString('th-TH')}</span>
                        </div>
                        <button 
                            onClick={toggleAutoRefresh}
                            className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${isAutoRefresh ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
                        >
                            <Power size={10} /> {isAutoRefresh ? 'Auto' : 'Off'}
                        </button>
                        <button 
                            onClick={handleManualRefresh}
                            className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors"
                            disabled={loading}
                        >
                            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> รีเฟรช
                        </button>
                        {isAdmin && (
                             <button 
                                onClick={handleClearData}
                                className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors ml-2"
                            >
                                <Trash2 size={12} /> ล้างค่า
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="mb-6">
                <div className="flex gap-[2px] md:gap-1 mb-[1px]">
                <div className="flex-1 border border-slate-600 bg-[#0f172a] py-3 text-center text-white font-bold text-sm md:text-base">
                    โอนจาก
                </div>
                <div className="flex-1 border border-slate-600 bg-[#0f172a] py-3 text-center text-white font-bold text-sm md:text-base">
                    จำนวนเงิน
                </div>
                <div className="flex-[1.5] border border-slate-600 bg-[#0f172a] py-3 text-center text-white font-bold text-sm md:text-base">
                    วันที่โอน
                </div>
                <div className="flex-1 border border-slate-600 bg-[#0f172a] py-3 text-center text-white font-bold text-sm md:text-base">
                    ข้อความ
                </div>
                </div>

                <div className="min-h-[300px] bg-[#1a2234]/30 border-t border-slate-700 relative">
                {loading && !isAutoRefresh ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1a2234]/50 z-10">
                    <RefreshCw className="animate-spin text-orange-500" />
                    </div>
                ) : null}
                
                {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                        <span className="mb-2">ไม่พบรายการ ({dataSource === 'mock' ? 'Mock Data' : 'Live Server'})</span>
                        {dataSource === 'live' && (
                            <span className="text-xs text-gray-600">
                                {isAdmin ? 'ตรวจสอบว่า Server ทำงานอยู่ หรือลองกดปุ่ม "จำลองเงินเข้า"' : 'ยังไม่มีรายการโอนเงินใหม่เข้ามา'}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-[1px]">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="flex gap-[2px] md:gap-1 group animate-in fade-in duration-300">
                            <div className="flex-1 bg-[#1e293b] border-x border-slate-700/50 p-3 text-center text-gray-300 text-sm group-hover:bg-[#2d3748] transition-colors flex items-center justify-center">
                            {tx.sender}
                            </div>
                            <div className="flex-1 bg-[#1e293b] border-x border-slate-700/50 p-3 text-center text-green-400 font-mono text-sm group-hover:bg-[#2d3748] transition-colors flex items-center justify-center font-bold">
                            {tx.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="flex-[1.5] bg-[#1e293b] border-x border-slate-700/50 p-3 text-center text-gray-400 text-xs md:text-sm group-hover:bg-[#2d3748] transition-colors flex items-center justify-center">
                            {formatDate(tx.date)}
                            </div>
                            <div className="flex-1 bg-[#1e293b] border-x border-slate-700/50 p-3 text-center text-gray-300 text-sm group-hover:bg-[#2d3748] transition-colors flex items-center justify-center">
                            {tx.message}
                            </div>
                        </div>
                    ))}
                    </div>
                )}
                </div>
            </div>

            {/* Pagination Buttons */}
            {dataSource === 'mock' && isAdmin && (
                <div className="flex justify-between items-center mb-8">
                    <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || loading}
                    className="bg-[#334155] hover:bg-[#475569] text-gray-300 px-4 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                    ก่อนหน้า
                    </button>
                    <div className="text-gray-500 text-xs">Page {currentPage}</div>
                    <button 
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={loading || transactions.length < ITEMS_PER_PAGE}
                    className="bg-[#334155] hover:bg-[#475569] text-white px-6 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                    ถัดไป
                    </button>
                </div>
            )}

            {/* Controls & Tools Section - ONLY FOR ADMIN */}
            {isAdmin && (
                <div className="border-t border-gray-700 pt-6 mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-5">
                    
                    {/* Left Column: Simulation & Connection */}
                    <div className="space-y-4">
                        {/* Simulation */}
                        <div className="bg-[#1e293b] p-4 rounded border border-gray-700">
                        <h3 className="text-gray-400 text-xs uppercase font-bold mb-3">
                            จำลองยอดเงินเข้า ({dataSource === 'live' ? 'ยิงเข้า API จริง' : 'บันทึกลง Mock Data'})
                        </h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSimulateWebhook}
                                className="flex-1 flex items-center gap-2 bg-gradient-to-r from-orange-700 to-orange-600 hover:from-orange-600 hover:to-orange-500 text-white text-xs px-3 py-2 rounded transition-colors justify-center"
                            >
                                <Play size={14} /> จำลองเงินเข้า (Random)
                            </button>
                        </div>
                        </div>

                        {/* Connection Info */}
                        <div className="bg-[#1e293b] p-4 rounded border border-gray-700 relative overflow-hidden">
                        {dataSource === 'mock' && (
                            <div className="absolute top-0 right-0 bg-yellow-600 text-white text-[10px] px-2 py-0.5 rounded-bl">Mock Mode</div>
                        )}
                        {dataSource === 'live' && (
                            <div className="absolute top-0 right-0 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-bl">Live Mode</div>
                        )}

                        <h3 className="text-gray-400 text-xs uppercase font-bold mb-3 flex items-center gap-2">
                            <Server size={14} /> ข้อมูลสำหรับติดตั้ง (Setup URL)
                        </h3>
                        <div className="space-y-2">
                            <div className="text-xs text-gray-400">Webhook Endpoint URL ที่ใช้งานอยู่:</div>
                            <div className="flex gap-2">
                            <code className={`flex-1 text-xs p-2 rounded border font-mono overflow-hidden whitespace-nowrap text-ellipsis ${dataSource === 'live' ? 'bg-green-900/20 text-green-400 border-green-800' : 'bg-[#0f172a] text-gray-400 border-gray-600'}`}>
                                {dataSource === 'live' ? `${currentOrigin}/api/webhook/truemoney` : 'เปลี่ยนเป็น Live Mode เพื่อดู URL จริง'}
                            </code>
                            <button 
                                onClick={handleCopyEndpoint}
                                disabled={dataSource === 'mock'}
                                className="bg-[#334155] hover:bg-[#475569] text-white p-2 rounded transition-colors disabled:opacity-50"
                                title="Copy URL"
                            >
                                {copied ? <Check size={14} className="text-green-400"/> : <Clipboard size={14} />}
                            </button>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2">
                            {dataSource === 'live' 
                                ? '* URL นี้คือ URL ของ Vercel จริงของคุณ นำไปใส่ในแอป TrueMoney ได้เลย'
                                : '* กรุณาเปลี่ยนโหมดเป็น "Live Server" เพื่อดู URL สำหรับนำไปใช้งานจริง'}
                            </p>
                        </div>
                        </div>
                    </div>

                    {/* Right Column: Payload Tester & AI */}
                    <div className="space-y-4">
                        {/* Payload Tester */}
                        <div className="bg-[#1e293b] p-4 rounded border border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2">
                            <Code size={14} /> ทดสอบ Token / Payload
                            </h3>
                            <span className="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                            {dataSource === 'live' ? 'ส่งเข้า Server จริง' : 'ทดสอบใน Browser'}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <textarea 
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder={'วาง Token (eyJ...) หรือ JSON ที่นี่'}
                                className="w-full bg-[#0f172a] border border-gray-600 text-gray-300 text-xs p-2 rounded h-24 focus:border-orange-500 focus:outline-none font-mono resize-none"
                            />
                            {jsonError && <p className="text-red-400 text-xs bg-red-900/20 p-1 rounded">{jsonError}</p>}
                            <button 
                            onClick={handlePayloadTest}
                            className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white text-xs px-3 py-2 rounded transition-colors w-full justify-center"
                            >
                            <Play size={14} /> ยิงข้อมูล ({dataSource === 'live' ? 'POST /api/webhook' : 'Local Function'})
                            </button>
                        </div>
                        </div>

                        {/* AI Summary */}
                        <div className="bg-[#1e293b] p-4 rounded border border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2">
                            <Sparkles size={12} className="text-purple-400"/> AI Analysis
                            </h3>
                            <button 
                            onClick={handleGeminiAnalysis}
                            disabled={analyzing}
                            className="text-xs text-purple-400 hover:text-purple-300 underline disabled:opacity-50"
                            >
                            {analyzing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ข้อมูล'}
                            </button>
                        </div>
                        
                        <div className="bg-[#0f172a] p-3 rounded min-h-[60px] text-xs text-gray-300 border border-gray-800 leading-relaxed">
                            {analysis ? analysis : "กดปุ่มเพื่อวิเคราะห์พฤติกรรมการโอน"}
                        </div>
                        </div>
                    </div>

                </div>
            )}
        </>
      )}

      {/* Services Tab - Mimicking App Screenshot */}
      {activeTab === 'services' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in">
            {/* Card 1: Webhook (Go to Dashboard) */}
            <div 
                className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 flex flex-col items-center text-center hover:border-orange-500 transition-colors cursor-pointer group"
                onClick={() => setActiveTab('dashboard')}
            >
                <div className="bg-orange-500/20 p-4 rounded-full mb-4 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                    <BellRing size={32} />
                </div>
                <h3 className="text-white font-semibold mb-2">แจ้งรับเงิน/เติมเงิน</h3>
                <p className="text-xs text-gray-400">ระบบ Webhook แจ้งเตือนยอดเงินเข้า (P2P)</p>
                <span className="mt-4 text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">Active</span>
            </div>
            
            {/* Card 2: Transaction Notify (Mock) */}
            <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 flex flex-col items-center text-center hover:border-blue-500 transition-colors cursor-pointer group">
                <div className="bg-blue-500/20 p-4 rounded-full mb-4 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <Smartphone size={32} />
                </div>
                <h3 className="text-white font-semibold mb-2">แจ้งการทำรายการ</h3>
                <p className="text-xs text-gray-400">แจ้งเตือนเมื่อมีการโอนออกหรือจ่ายบิล</p>
                <span className="mt-4 text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">Coming Soon</span>
            </div>

            {/* Card 3: Check Balance (Mock) */}
            <div 
                className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 flex flex-col items-center text-center hover:border-green-500 transition-colors cursor-pointer group"
                onClick={handleCheckBalance}
            >
                <div className="bg-green-500/20 p-4 rounded-full mb-4 text-green-500 group-hover:bg-green-500 group-hover:text-white transition-all">
                    <Wallet size={32} />
                </div>
                <h3 className="text-white font-semibold mb-2">ตรวจสอบยอดเงิน</h3>
                <p className="text-xs text-gray-400">ดูยอดเงินคงเหลือในกระเป๋า</p>
                <span className="mt-4 text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">Demo</span>
            </div>

            {/* Card 4: Last Transaction (Fetch) */}
            <div 
                className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 flex flex-col items-center text-center hover:border-purple-500 transition-colors cursor-pointer group"
                onClick={handleCheckLastTx}
            >
                <div className="bg-purple-500/20 p-4 rounded-full mb-4 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
                    <History size={32} />
                </div>
                <h3 className="text-white font-semibold mb-2">รายการล่าสุด</h3>
                <p className="text-xs text-gray-400">ดึงข้อมูลรายการล่าสุดทันที</p>
                <span className="mt-4 text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">API</span>
            </div>
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && (
          <div className="bg-[#1e293b] rounded-lg border border-gray-700 p-6 animate-in fade-in">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Users size={20} /> จัดการผู้ใช้งาน
                  </h2>
                  <button 
                    onClick={() => openUserModal()}
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded text-sm transition-colors"
                  >
                      <Plus size={16} /> เพิ่มผู้ใช้
                  </button>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-[#0f172a] text-gray-400 text-xs uppercase border-b border-gray-700">
                              <th className="p-4">Username</th>
                              <th className="p-4">Role</th>
                              <th className="p-4">Password</th>
                              <th className="p-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="text-sm text-gray-300 divide-y divide-gray-700">
                          {usersList.map(u => (
                              <tr key={u.id} className="hover:bg-[#2d3748]">
                                  <td className="p-4">{u.username}</td>
                                  <td className="p-4">
                                      <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-900/40 text-purple-300 border border-purple-800' : 'bg-blue-900/40 text-blue-300 border border-blue-800'}`}>
                                          {u.role}
                                      </span>
                                  </td>
                                  <td className="p-4 font-mono text-gray-500">{u.password}</td>
                                  <td className="p-4 flex justify-end gap-2">
                                      <button 
                                        onClick={() => openUserModal(u)}
                                        className="p-1.5 hover:bg-slate-600 rounded text-gray-400 hover:text-white"
                                      >
                                          <Edit size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteUser(u.id)}
                                        className="p-1.5 hover:bg-red-900/50 rounded text-red-400 hover:text-red-300"
                                        disabled={u.username === 'admin'}
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Backend Code Tab */}
      {activeTab === 'code' && (
        <div className="bg-[#1e293b] rounded-lg border border-gray-700 overflow-hidden animate-in fade-in">
             <div className="bg-[#0f172a] px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-400"/>
                    <span className="text-sm font-mono text-gray-300">api/index.js (Vercel Function)</span>
                </div>
                <button 
                    onClick={handleCopyBackendCode}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                >
                    {codeCopied ? <Check size={14}/> : <Clipboard size={14} />} Copy Code
                </button>
             </div>
             <div className="p-0 overflow-x-auto">
                 <pre className="text-xs md:text-sm font-mono text-gray-300 p-4 leading-relaxed whitespace-pre-wrap">
                    {backendCodeString}
                 </pre>
             </div>
             <div className="bg-[#0f172a] px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
                 * ไฟล์นี้จะถูกรันโดย Vercel โดยอัตโนมัติเมื่อวางไว้ในโฟลเดอร์ api/
             </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
              <div className="bg-[#1e293b] rounded-lg shadow-2xl border border-gray-700 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                      <h3 className="text-white font-semibold">{editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'}</h3>
                      <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-white">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
                      {userFormError && (
                          <div className="bg-red-900/30 text-red-300 text-sm p-2 rounded border border-red-800">
                              {userFormError}
                          </div>
                      )}
                      <div>
                          <label className="block text-gray-400 text-sm mb-1">Username</label>
                          <input 
                              type="text" 
                              required
                              value={userForm.username}
                              onChange={e => setUserForm({...userForm, username: e.target.value})}
                              className="w-full bg-[#0f172a] border border-gray-600 text-white px-3 py-2 rounded focus:outline-none focus:border-orange-500"
                          />
                      </div>
                      <div>
                          <label className="block text-gray-400 text-sm mb-1">Password</label>
                          <input 
                              type="text" 
                              required
                              value={userForm.password}
                              onChange={e => setUserForm({...userForm, password: e.target.value})}
                              className="w-full bg-[#0f172a] border border-gray-600 text-white px-3 py-2 rounded focus:outline-none focus:border-orange-500"
                          />
                      </div>
                      <div>
                          <label className="block text-gray-400 text-sm mb-1">Role</label>
                          <select 
                              value={userForm.role}
                              onChange={e => setUserForm({...userForm, role: e.target.value as 'admin'|'member'})}
                              className="w-full bg-[#0f172a] border border-gray-600 text-white px-3 py-2 rounded focus:outline-none focus:border-orange-500"
                          >
                              <option value="member">Staff (Member)</option>
                              <option value="admin">Admin</option>
                          </select>
                      </div>
                      <div className="pt-2 flex justify-end gap-2">
                          <button 
                            type="button" 
                            onClick={() => setIsUserModalOpen(false)}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                          >
                              ยกเลิก
                          </button>
                          <button 
                            type="submit" 
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm transition-colors"
                          >
                              บันทึก
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