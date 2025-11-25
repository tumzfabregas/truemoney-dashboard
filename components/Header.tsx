import React from 'react';
import { LogOut, KeyRound, ShieldCheck, Languages } from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onChangePasswordClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onChangePasswordClick }) => {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'th' ? 'en' : 'th');
  };

  return (
    <header className="sticky top-0 z-50 bg-[#1E1F20] text-gray-200 shadow-lg border-b border-[#444746]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 p-2 rounded-xl border border-orange-500/30">
                <ShieldCheck className="text-orange-500" size={28} />
            </div>
            <div className="flex flex-col">
                <span className="text-gray-100 font-bold tracking-tight text-xl leading-none">
                    TM <span className="text-orange-500">Dashboard</span>
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Secure Payment Monitor</span>
            </div>
        </div>

        {/* User Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Language Toggle */}
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2b2d30] border border-[#444746] hover:bg-[#383a3e] hover:border-orange-500/50 text-gray-300 hover:text-white transition-all text-xs font-semibold"
          >
             <Languages size={16} />
             <span className="uppercase">{language}</span>
          </button>

          {user && (
            <div className="flex items-center bg-[#2b2d30] rounded-full pl-4 pr-1.5 py-1.5 border border-[#444746] shadow-inner">
              <span className="text-gray-200 font-medium flex items-center gap-2 mr-3 text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                <span className="hidden sm:inline">{user.username}</span>
              </span>
              
              <div className="flex items-center gap-1">
                {onChangePasswordClick && (
                    <button 
                        onClick={onChangePasswordClick}
                        className="p-2 rounded-full hover:bg-[#383a3e] text-gray-400 hover:text-white transition-colors"
                        title={t('change_password')}
                    >
                        <KeyRound size={18} />
                    </button>
                )}
                <button 
                  onClick={onLogout}
                  className="p-2 rounded-full bg-[#444746] hover:bg-[#505356] text-white transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  title={t('logout')}
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;