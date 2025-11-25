import React from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-[#1a2234] border-b border-gray-700 py-3 px-6 flex justify-between items-center text-sm font-light tracking-wide shadow-md">
      <div className="text-white font-medium">
        Welcome
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-gray-300 flex items-center gap-2">
              <UserIcon size={14} /> {user.username}
            </span>
            <button 
              onClick={onLogout}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              Logout <LogOut size={14} />
            </button>
          </>
        ) : (
          <span className="text-white">Login</span>
        )}
      </div>
    </header>
  );
};

export default Header;
