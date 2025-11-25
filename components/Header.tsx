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
    <header className="sticky top-0 z-50 bg-[#454545] text-white shadow-lg border-b border-[#575757]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 p-2 rounded-xl border border-orange-500/30">
                <ShieldCheck className="text-orange-500" size={28} />
            </div>
            <div className="flex flex-col">
                <span className="text-white font-bold tracking-tight text-xl leading-none">
                    TM <span className="text-orange-500">Dashboard</span>
                </span>
                <span className="text-[10px] text-orange-200/60 uppercase tracking-widest font-medium">Secure Payment Monitor</span>
            </div>
        </div>

        {/* User Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Language Toggle */}
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#373737] border border-[#575757] hover:bg-[#505050] hover:border-orange-500/50 text-orange-100/80 hover:text-white transition-all text-xs font-semibold"
          >
             <Languages size={16} />
             <span className="uppercase">{language}</span>
          </button>

          {user && (
            <div className="flex items-center bg-[#373737] rounded-full pl-4 pr-1.5 py-1.5 border border-[#575757] shadow-inner">
              <span className="text-orange-100 font-medium flex items-center gap-2 mr-3 text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                <span className="hidden sm:inline">{user.username}</span>
              </span>
              
              <div className="flex items-center gap-1">
                {onChangePasswordClick && (
                    <button 
                        onClick={onChangePasswordClick}
                        className="p-2 rounded-full hover:bg-[#505050] text-gray-400 hover:text-white transition-colors"
                        title={t('change_password')}
                    >
                        <KeyRound size={18} />
                    </button>
                )}
                <button 
                  onClick={onLogout}
                  className="p-2 rounded-full bg-[#505050] hover:bg-[#606060] text-white transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
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