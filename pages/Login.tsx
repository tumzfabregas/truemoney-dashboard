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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-slate-800/40 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-700/50 w-full max-w-sm relative z-10 mx-4">
        
        <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-4 rounded-2xl shadow-lg shadow-orange-900/30 mb-4 transform -rotate-6">
                <Wallet className="text-white" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{t('welcome_back')}</h2>
            <p className="text-slate-400 text-sm mt-1">{t('dashboard_title')}</p>
        </div>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Lock size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-bold uppercase ml-1">{t('username')}</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-600"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-400 text-xs font-bold uppercase ml-1">{t('password')}</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-600"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold py-3.5 rounded-xl transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/30 flex items-center justify-center gap-2 group mt-2"
          >
            {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
                <>{t('signin_btn')} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/></>
            )}
          </button>
        </form>
      </div>

      <p className="text-slate-500 text-xs mt-8">{t('secure_connection')}</p>
    </div>
  );
};

export default Login;