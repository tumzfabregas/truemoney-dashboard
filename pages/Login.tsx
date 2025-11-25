import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Wallet, ArrowRight } from 'lucide-react';
import { authenticateUser } from '../services/mockService';
import { loginApi } from '../services/apiService';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError(t('login_error_empty'));
      setLoading(false);
      return;
    }

    try {
        const user = await loginApi(username, password);
        onLogin(user);
        setLoading(false);
        return;
    } catch (e) {
        console.log("API Login failed, trying local mock...");
    }

    const user = authenticateUser(username, password);
    if (user) {
        onLogin(user);
    } else {
        setError(t('login_error_invalid'));
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4 bg-[#353639]">
      
      <div className="bg-[#1E1F20] p-10 rounded-[2rem] shadow-2xl border border-[#444746] w-full max-w-md relative z-10 mx-4">
        
        <div className="flex flex-col items-center mb-10">
            <div className="bg-[#2b2d30] p-5 rounded-2xl shadow-inner border border-[#444746] mb-6 text-orange-500">
                <Wallet size={48} strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-bold text-gray-100 tracking-tight text-center">TrueMoney <span className="text-orange-500">Dashboard</span></h2>
            <p className="text-gray-400 mt-2 text-sm font-medium">Secure Admin Access</p>
        </div>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-4 rounded-xl mb-8 text-sm text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Lock size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-gray-400 text-xs font-bold uppercase ml-1 tracking-wider">{t('username')}</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#2b2d30] border border-[#444746] text-white text-lg px-5 py-4 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-gray-600 shadow-inner"
              disabled={loading}
              placeholder="Enter your username"
            />
          </div>
          <div className="space-y-2">
            <label className="text-gray-400 text-xs font-bold uppercase ml-1 tracking-wider">{t('password')}</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#2b2d30] border border-[#444746] text-white text-lg px-5 py-4 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-gray-600 shadow-inner"
              disabled={loading}
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg py-4 rounded-xl transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/40 flex items-center justify-center gap-3 group mt-6"
          >
            {loading ? (
                <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
                <>{t('signin_btn')} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/></>
            )}
          </button>
        </form>
      </div>

      <p className="text-gray-500 text-sm mt-8 font-medium">{t('secure_connection')}</p>
    </div>
  );
};

export default Login;