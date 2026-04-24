export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface RecurringConfig {
  /** Per ora supportiamo solo ricorrenza mensile. */
  frequency: 'monthly';
  /** Data fine inclusa (ISO YYYY-MM-DD). Se assente: ricorre indefinitamente. */
  endDate?: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  userId: string;
  familyId: string;
  createdAt: string;
  /** Se true: visibile solo a chi l'ha creata, anche in gruppo famiglia. */
  isPrivate?: boolean;
  /** Se presente: questa è un template ricorrente. Ogni mese genera una copia. */
  recurring?: RecurringConfig;
  /** Se presente: questa transazione è stata generata da un template ricorrente (punta all'id del template). */
  sourceRecurringId?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  spent: number;
  month: string; // YYYY-MM
  familyId: string;
}

export interface Family {
  id: string;
  name: string;
  members: string[]; // user UIDs
  createdAt: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  /**
   * Se true: spesa della famiglia (mutuo, bollette, Netflix).
   * Se false: spesa solo tua (palestra tua, abbonamento lavoro).
   * Se undefined: da migrare — il client applica default.
   */
  shared?: boolean;
}

export interface BudgetCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  percentage: number;
  budget: number; // computed: freeAmount * percentage / 100
  /**
   * Se true: budget condiviso con la famiglia (es. Spesa alimentare, Figli).
   * Se false: budget solo tuo (es. Abbigliamento, Sport).
   * Se undefined: da migrare — il client applica default.
   */
  shared?: boolean;
}

export type FinancialGoal =
  | 'survive'
  | 'travel'
  | 'purchase'
  | 'understand'
  | 'emergency'
  | 'control';

export interface FamilyMember {
  uid: string;
  name: string;
  color: string;
}

export interface Achievement {
  unlockedAt: string; // ISO date
  metadata?: Record<string, unknown>;
}

export interface UserProfile {
  goal: FinancialGoal;
  income: number;
  fixedExpenses: FixedExpense[];
  categories: BudgetCategory[];
  onboardingComplete: boolean;
  createdAt: string;
  familyId?: string;          // uid del creatore del gruppo
  familyMembers?: FamilyMember[]; // tutti i membri (compreso se stessi)
  isPremium?: boolean;         // true se abbonato PRO (scan scontrini)
  premiumSince?: string;       // data attivazione ISO
  achievements?: Record<string, Achievement>; // badgeId → data di sblocco
}
