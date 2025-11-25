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
    <header className="sticky top-0 z-50 bg-[#1E1F20] text-white shadow-md border-b border-[#444746]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        
        {/* Brand */}
        <div className="flex items-center gap-2">
            <div className="bg-orange-500/10 p-1.5 rounded-lg border border-orange-500/20">
                <ShieldCheck className="text-orange-500" size={20} />
            </div>
            <span className="text-white font-bold tracking-tight text-lg hidden sm:inline">
                TM <span className="text-orange-500">Dashboard</span>
            </span>
        </div>

        {/* User Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle */}
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-[#2A2B2C] border border-[#444746] hover:bg-[#3E3F40] text-slate-300 hover:text-white transition-colors text-xs font-medium"
          >
             <Languages size={14} />
             <span className="uppercase">{language}</span>
          </button>

          {user && (
            <div className="flex items-center bg-[#2A2B2C] rounded-full pl-3 pr-1 py-1 border border-[#444746]">
              <span className="text-slate-200 text-sm font-medium flex items-center gap-2 mr-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="hidden sm:inline">{user.username}</span>
              </span>
              
              <div className="flex items-center gap-1">
                {onChangePasswordClick && (
                    <button 
                        onClick={onChangePasswordClick}
                        className="p-2 rounded-full hover:bg-[#3E3F40] text-slate-400 hover:text-white transition-colors"
                        title={t('change_password')}
                    >
                        <KeyRound size={16} />
                    </button>
                )}
                <button 
                  onClick={onLogout}
                  className="p-2 rounded-full bg-[#3E3F40] hover:bg-[#4E4F50] text-slate-200 hover:text-white transition-all shadow-sm"
                  title={t('logout')}
                >
                  <LogOut size={16} />
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