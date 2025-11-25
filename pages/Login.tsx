import React, { useState } from 'react';
import { User } from '../types';
import { Lock } from 'lucide-react';
import { authenticateUser } from '../services/mockService';
import { loginApi } from '../services/apiService';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      setLoading(false);
      return;
    }

    // 1. Try Login via API (Real Server/DB)
    try {
        const user = await loginApi(username, password);
        onLogin(user);
        setLoading(false);
        return;
    } catch (e) {
        // API login failed, check if it was a network error or 401
        // For now, if API fails, we Fallback to Local Mock 
        // (Only useful if user is running locally without server or internet)
        console.log("API Login failed, trying local mock...");
    }

    // 2. Fallback to Mock Data (LocalStorage)
    const user = authenticateUser(username, password);
    
    if (user) {
        onLogin(user);
    } else {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
      <div className="bg-[#1e293b] p-8 rounded-lg shadow-xl border border-gray-700 w-full max-w-md">
        <div className="flex justify-center mb-6 text-orange-500">
           <Lock size={48} />
        </div>
        <h2 className="text-2xl font-semibold text-center text-white mb-6 font-sans">เข้าสู่ระบบสมาชิก</h2>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">ชื่อผู้ใช้งาน</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0f172a] border border-gray-600 text-white px-4 py-2 rounded focus:outline-none focus:border-orange-500 transition-colors"
              placeholder="กรอกชื่อผู้ใช้งาน"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">รหัสผ่าน</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0f172a] border border-gray-600 text-white px-4 py-2 rounded focus:outline-none focus:border-orange-500 transition-colors"
              placeholder="กรอกรหัสผ่าน"
              disabled={loading}
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold py-2 px-4 rounded transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;