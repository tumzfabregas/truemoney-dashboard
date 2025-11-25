export interface Transaction {
  id: string;
  sender: string;
  amount: number;
  date: string; // ISO string
  message: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface User {
  id: string;
  username: string;
  password?: string; // Optional for display, required for logic
  role: 'admin' | 'member';
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
}