// ─── Sharing defaults: cosa è di famiglia vs personale ──────────────────────
// Applicato silenziosamente ai profili esistenti (migration runtime)
// e usato come default quando si creano nuove categorie/fisse.
import type { UserProfile, BudgetCategory, FixedExpense } from '../types';

/** True = di default è una spesa/categoria familiare. */
const SHARED_BY_DEFAULT: Record<string, boolean> = {
  // ─── Base ───
  'Spesa alimentare': true,
  'Casa': true,
  'Trasporti': false,
  'Salute': false,
  'Svago': false,
  'Abbigliamento': false,
  // ─── Opzionali ───
  'Figli': true,
  'Animali': true,
  'Ristoranti e bar': true,
  'Viaggi': true,
  'Abbonamenti': true,
  'Sport': false,
  'Shopping': false,
  'Tabacco': false,
  // ─── Legacy (profili vecchi) ───
  'Caffè': true,
  'Aperitivi': true,
  'Delivery': true,
  'Streaming': true,
  'Carburante': false,
  'Veterinario': true,
  'Viaggi e Gite': true,
};

export const isCategorySharedByDefault = (name: string): boolean => {
  return SHARED_BY_DEFAULT[name] ?? false;
};

/**
 * Fissa in famiglia di default, tranne alcune chiaramente personali.
 * (es. "savings" = tesoretto mensile → famiglia, ma l'utente può rendere personale)
 */
const FIXED_PERSONAL_IDS = new Set<string>([
  // Nessuna per ora — tutte sono famiglia di default.
  // Se in futuro serve (es. "palestra", "abbonamento-lavoro"), aggiungere qui l'id.
]);

export const isFixedSharedByDefault = (fixed: FixedExpense): boolean => {
  return !FIXED_PERSONAL_IDS.has(fixed.id);
};

/**
 * Applica i flag `shared` alle categorie/fisse che non li hanno.
 * Torna `null` se non c'è nulla da migrare, altrimenti il nuovo profilo.
 */
export function migrateSharedFlags(profile: UserProfile): UserProfile | null {
  const needsCatsMigration = profile.categories?.some(c => c.shared === undefined);
  const needsFixedMigration = profile.fixedExpenses?.some(f => f.shared === undefined);
  if (!needsCatsMigration && !needsFixedMigration) return null;

  const migratedCategories: BudgetCategory[] = (profile.categories ?? []).map(c => ({
    ...c,
    shared: c.shared ?? isCategorySharedByDefault(c.name),
  }));

  const migratedFixed: FixedExpense[] = (profile.fixedExpenses ?? []).map(f => ({
    ...f,
    shared: f.shared ?? isFixedSharedByDefault(f),
  }));

  return {
    ...profile,
    categories: migratedCategories,
    fixedExpenses: migratedFixed,
  };
}
