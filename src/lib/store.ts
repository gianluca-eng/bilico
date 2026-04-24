import { create } from 'zustand';
import type { User, Transaction, Budget, Family, UserProfile, FamilyMember } from '../types';

interface AppState {
  user: User | null;
  authLoading: boolean;
  profile: UserProfile | null;
  family: Family | null;
  familyMembers: FamilyMember[];
  transactions: Transaction[];
  budgets: Budget[];
  setUser: (user: User | null) => void;
  setAuthLoading: (authLoading: boolean) => void;
  setProfile: (profile: UserProfile | null) => void;
  setFamily: (family: Family | null) => void;
  setFamilyMembers: (members: FamilyMember[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setBudgets: (budgets: Budget[]) => void;
  addTransaction: (transaction: Transaction) => void;
  removeTransaction: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  authLoading: true,
  profile: null,
  family: null,
  familyMembers: [],
  transactions: [],
  budgets: [],
  setUser: (user) => set({ user }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setProfile: (profile) => set({ profile }),
  setFamily: (family) => set({ family }),
  setFamilyMembers: (familyMembers) => set({ familyMembers }),
  setTransactions: (transactions) => set({ transactions }),
  setBudgets: (budgets) => set({ budgets }),
  addTransaction: (transaction) =>
    set((state) => ({ transactions: [transaction, ...state.transactions] })),
  removeTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    })),
}));
