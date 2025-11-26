import { Transaction, User } from '../types';

// API Service for communicating with the Real Backend (api/index.js)

export const fetchLiveTransactions = async (): Promise<Transaction[]> => {
  try {
    const response = await fetch('/api/transactions');
    if (!response.ok) {
      throw new Error('Failed to fetch from server');
    }
    return await response.json();
  } catch (error) {
    console.error("API Fetch Error:", error);
    return [];
  }
};

export const clearLiveTransactions = async (): Promise<void> => {
    await fetch('/api/transactions', { method: 'DELETE' });
};

// Helper to simulate webhook trigger VIA THE SERVER (for testing "Live" mode)
export const triggerLiveWebhook = async (payload: any) => {
    await fetch('/api/webhook/truemoney', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
};

// Update Transaction Status
export const updateTransactionStatusApi = async (id: string, status: string): Promise<Transaction> => {
    const response = await fetch(`/api/transactions/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update status');
    return await response.json();
};

// --- User Management API ---

export const loginApi = async (username: string, password: string): Promise<User> => {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) throw new Error('Login failed');
    return await response.json();
};

export const fetchUsersApi = async (): Promise<User[]> => {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Failed to fetch users');
    return await response.json();
};

export const addUserApi = async (user: Omit<User, 'id'>): Promise<User> => {
    const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add user');
    }
    return await response.json();
};

export const updateUserApi = async (id: string, updates: Partial<User>): Promise<User> => {
    const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update user');
    return await response.json();
};

export const deleteUserApi = async (id: string): Promise<void> => {
    const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!response.ok) {
         const err = await response.json();
         throw new Error(err.error || 'Failed to delete user');
    }
};