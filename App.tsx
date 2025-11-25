import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { User } from './types';
import { updateUser } from './services/mockService';
import { Lock, X } from 'lucide-react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

function AppContent() {
  const { t } = useLanguage();
  // Initialize user from LocalStorage for persistence
  const [user, setUser] = useState<User | null>(() => {
    try {
        const savedUser = localStorage.getItem('tm_user_session');
        return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
        return null;
    }
  });

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('tm_user_session', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('tm_user_session');
  };

  const handleChangePasswordClick = () => {
      setIsPasswordModalOpen(true);
      setNewPassword('');
      setPasswordError('');
  };

  const handleSubmitPasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (!newPassword.trim()) {
          setPasswordError(t('login_error_empty'));
          return;
      }

      try {
          // 1. Update Mock (Local)
          try {
             updateUser(user.id, { password: newPassword });
          } catch (e) { }

          // 2. Update Live (API) if possible
          try {
             const res = await fetch(`/api/users/${user.id}`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ password: newPassword })
             });
             if (!res.ok && res.status !== 404) {
                 console.error('Failed to update password on server');
             }
          } catch (e) { }

          // 3. Update Session
          const updatedUser = { ...user, password: newPassword };
          setUser(updatedUser);
          localStorage.setItem('tm_user_session', JSON.stringify(updatedUser));
          
          setIsPasswordModalOpen(false);
          alert(t('password_changed'));
      } catch (err: any) {
          setPasswordError('Error: ' + err.message);
      }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#111827]">
      <Header user={user} onLogout={handleLogout} onChangePasswordClick={handleChangePasswordClick} />
      
      <main className="flex-grow">
        {user ? (
          <Dashboard user={user} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </main>

      <Footer />

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
               <div className="bg-[#1e293b] rounded-lg shadow-2xl border border-gray-700 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                      <h3 className="text-white font-semibold flex items-center gap-2"><Lock size={16}/> {t('change_password')}</h3>
                      <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400 hover:text-white">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleSubmitPasswordChange} className="p-6 space-y-4">
                       {passwordError && (
                          <div className="bg-red-900/30 text-red-300 text-sm p-2 rounded border border-red-800">
                              {passwordError}
                          </div>
                      )}
                      <div>
                          <label className="block text-gray-400 text-sm mb-1">{t('new_password')}</label>
                          <input 
                              type="text" 
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full bg-[#0f172a] border border-gray-600 text-white px-3 py-2 rounded focus:outline-none focus:border-orange-500"
                              autoFocus
                          />
                      </div>
                      <div className="pt-2 flex justify-end gap-2">
                          <button 
                            type="button" 
                            onClick={() => setIsPasswordModalOpen(false)}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                          >
                              {t('cancel')}
                          </button>
                          <button 
                            type="submit" 
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm transition-colors"
                          >
                              {t('save')}
                          </button>
                      </div>
                  </form>
               </div>
          </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}