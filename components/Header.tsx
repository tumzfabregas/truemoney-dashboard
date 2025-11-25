import React from 'react';
import { LogOut, User as UserIcon, KeyRound, ShieldCheck } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onChangePasswordClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onChangePasswordClick }) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        
        {/* Brand */}
        <div className="flex items-center gap-2">
            <div className="bg-orange-500/20 p-1.5 rounded-lg border border-orange-500/30">
                <ShieldCheck className="text-orange-500" size={20} />
            </div>
            <span className="text-white font-bold tracking-tight text-lg">
                TM <span className="text-orange-500">Connect</span>
            </span>
        </div>

        {/* User Controls */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center bg-slate-800/50 rounded-full pl-4 pr-1 py-1 border border-slate-700/50">
              <span className="text-slate-300 text-sm font-medium flex items-center gap-2 mr-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                {user.username}
              </span>
              
              <div className="flex items-center gap-1">
                {onChangePasswordClick && (
                    <button 
                        onClick={onChangePasswordClick}
                        className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Change Password"
                    >
                        <KeyRound size={16} />
                    </button>
                )}
                <button 
                  onClick={onLogout}
                  className="p-2 rounded-full bg-slate-700 hover:bg-red-600 text-slate-200 hover:text-white transition-all shadow-md"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          ) : (
            <span className="text-slate-500 text-sm">Not Logged In</span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;