import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { User } from './types';

function App() {
  // Simple auth state management
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#111827]">
      <Header user={user} onLogout={handleLogout} />
      
      <main className="flex-grow">
        {user ? (
          <Dashboard user={user} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;