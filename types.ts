export interface Transaction {
  id: string;
  sender: string;
  amount: number;
  date: string; // ISO string
  message: string;
  type: 'INCOME' | 'EXPENSE';
  rawPayload?: any;
}

export interface User {
  id: string;
  username: string;
  password?: string; // Optional for display, required for logic
  role: 'dev' | 'admin' | 'staff';
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
}