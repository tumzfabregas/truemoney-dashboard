import { Transaction, User } from '../types';

const STORAGE_KEY = 'truemoney_transactions';
const USERS_STORAGE_KEY = 'truemoney_users';

// --- Transactions Logic ---

const getStoredData = (): Transaction[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to parse local storage", e);
  }

  const initialData: Transaction[] = [
    { id: 'TXN-001', sender: '081-234-1234', amount: 500.00, date: new Date(Date.now() - 1000 * 60 * 5).toISOString(), message: 'ค่าบริการ', type: 'INCOME', status: 'normal' },
    { id: 'TXN-002', sender: '089-876-5678', amount: 120.50, date: new Date(Date.now() - 1000 * 60 * 60).toISOString(), message: 'เติมเกม', type: 'INCOME', status: 'verified' },
  ];
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
};

const saveData = (data: Transaction[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const fetchTransactions = async (page: number, limit: number): Promise<{ data: Transaction[], total: number }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const allData = getStoredData();
      allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const start = (page - 1) * limit;
      const end = start + limit;
      resolve({
        data: allData.slice(start, end),
        total: allData.length
      });
    }, 300); 
  });
};

export const simulateIncomingWebhook = (amount: number, sender: string, message: string = 'Webhook Received', date?: string): Transaction => {
  const allData = getStoredData();
  
  const newTxn: Transaction = {
    id: `TXN-${Date.now()}`,
    sender: sender,
    amount: amount,
    date: date || new Date().toISOString(),
    message: message,
    type: 'INCOME',
    status: 'normal'
  };

  allData.unshift(newTxn); 
  saveData(allData);

  return newTxn;
};

export const updateTransactionStatusMock = (id: string, status: string) => {
    const allData = getStoredData();
    const idx = allData.findIndex(t => t.id === id);
    if (idx !== -1) {
        allData[idx] = { ...allData[idx], status: status as any };
        saveData(allData);
        return allData[idx];
    }
    throw new Error('Transaction not found');
};

export const deleteTransactionMock = (id: string) => {
    let allData = getStoredData();
    allData = allData.filter(t => t.id !== id);
    saveData(allData);
};

export const clearAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
}

// --- User Management Logic ---

const getStoredUsers = (): User[] => {
    try {
        const stored = localStorage.getItem(USERS_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) { console.error(e); }

    // Default Users (Dev, Owner, Staff_01) - Matching API Logic
    const defaultUsers: User[] = [
        { id: '1', username: 'dev', password: 'dev', role: 'dev' },
        { id: '2', username: 'owner', password: 'owner', role: 'admin' },
        { id: '3', username: 'staff_01', password: '1234', role: 'staff' }
    ];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
    return defaultUsers;
};

const saveUsers = (users: User[]) => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

export const getUsers = (): User[] => getStoredUsers();

export const addUser = (user: Omit<User, 'id'>) => {
    const users = getStoredUsers();
    if (users.find(u => u.username.toLowerCase() === user.username.toLowerCase())) {
        throw new Error('Username already exists');
    }
    const newUser = { ...user, id: Date.now().toString() };
    users.push(newUser);
    saveUsers(users);
    return newUser;
};

export const updateUser = (id: string, updates: Partial<User>) => {
    const users = getStoredUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    
    // Prevent changing username to existing one (Case Insensitive)
    if (updates.username && users.some(u => u.username.toLowerCase() === updates.username!.toLowerCase() && u.id !== id)) {
        throw new Error('Username already taken');
    }

    users[index] = { ...users[index], ...updates };
    saveUsers(users);
    return users[index];
};

export const deleteUser = (id: string) => {
    let users = getStoredUsers();
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete && (userToDelete.role === 'dev' || userToDelete.username.toLowerCase() === 'owner')) {
         throw new Error('Cannot delete dev/owner');
    }
    users = users.filter(u => u.id !== id);
    saveUsers(users);
};

export const authenticateUser = (username: string, password: string): User | null => {
    const users = getStoredUsers();
    // Case insensitive username match
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    return user || null;
};