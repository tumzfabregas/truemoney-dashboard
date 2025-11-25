import { Transaction } from '../types';

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
// In reality, TrueMoney server sends this, but we can mimic it by POSTing to our own endpoint.
export const triggerLiveWebhook = async (payload: any) => {
    await fetch('/api/webhook/truemoney', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
};