// ─── Trofei di Bilico — 12 badge a tema film / cartoon / finanza ───────────
import type { Transaction, UserProfile, FamilyMember } from '../types';

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  quote: string;
  source: string;
  description: string; // hint mostrato all'utente su come sbloccarlo
  check: (ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  transactions: Transaction[];
  profile: UserProfile | null;
  userUid: string;
  familyMembers: FamilyMember[];
  currentYM: string; // es. "2026-04"
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const getFreeBudget = (profile: UserProfile | null): number => {
  if (!profile) return 0;
  const fixed = profile.fixedExpenses.reduce((s, f) => s + f.amount, 0);
  return Math.max(0, profile.income - fixed);
};

/** Ritorna il totale speso (solo expense) per mese YYYY-MM. */
const sumByMonth = (txs: Transaction[]): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    const ym = t.date.slice(0, 7);
    map[ym] = (map[ym] ?? 0) + t.amount;
  }
  return map;
};

/** Mesi passati (escluso il corrente) con spesa, ordinati dal più vecchio. */
const pastMonths = (txs: Transaction[], currentYM: string): Array<[string, number]> => {
  const all = sumByMonth(txs);
  return Object.entries(all)
    .filter(([ym]) => ym < currentYM)
    .sort((a, b) => a[0].localeCompare(b[0]));
};

/** Risparmio cumulativo sui mesi passati (somma di max(0, freeBudget - spent)). */
const cumulativeSavings = (txs: Transaction[], profile: UserProfile | null, currentYM: string): number => {
  const freeBudget = getFreeBudget(profile);
  if (freeBudget === 0) return 0;
  return pastMonths(txs, currentYM)
    .reduce((s, [, spent]) => s + Math.max(0, freeBudget - spent), 0);
};

/** Ritorna il nome "pulito" della categoria (toglie emoji iniziale). */
const stripEmoji = (cat: string): string => {
  const parts = cat.split(' ');
  const hasEmoji = parts.length > 1 && !/[A-Za-z]/.test(parts[0] ?? '');
  return (hasEmoji ? parts.slice(1).join(' ') : cat).trim();
};

// ─── Le 12 definizioni ───────────────────────────────────────────────────
export const BADGES: BadgeDef[] = [
  {
    id: 'jerry_maguire',
    emoji: '💼',
    name: 'Show me the money!',
    quote: 'Show me the money!',
    source: 'Jerry Maguire',
    description: 'Aggiungi la prima spesa.',
    check: ({ transactions }) => transactions.length >= 1,
  },
  {
    id: 'scrooge_mcduck',
    emoji: '💰',
    name: 'Zio Paperone',
    quote: 'I miei soldini!',
    source: 'Disney',
    description: 'Chiudi un mese sotto budget.',
    check: ({ transactions, profile, currentYM }) => {
      const freeBudget = getFreeBudget(profile);
      if (freeBudget === 0) return false;
      return pastMonths(transactions, currentYM).some(([, spent]) => spent < freeBudget);
    },
  },
  {
    id: 'deposito',
    emoji: '🏦',
    name: 'Il Deposito',
    quote: 'Il mio deposito di monete!',
    source: 'Zio Paperone',
    description: 'Risparmia più del 20% del reddito in un mese.',
    check: ({ transactions, profile, currentYM }) => {
      const freeBudget = getFreeBudget(profile);
      const income = profile?.income ?? 0;
      if (freeBudget === 0 || income === 0) return false;
      return pastMonths(transactions, currentYM).some(
        ([, spent]) => ((freeBudget - spent) / income) > 0.2,
      );
    },
  },
  {
    id: 'the_wolf',
    emoji: '🐺',
    name: 'The Wolf',
    quote: 'Il nome del gioco è spostare i soldi dalla tasca del cliente alla tua.',
    source: 'Wolf of Wall Street',
    description: 'Chiudi 3 mesi consecutivi sotto budget.',
    check: ({ transactions, profile, currentYM }) => {
      const freeBudget = getFreeBudget(profile);
      if (freeBudget === 0) return false;
      const months = pastMonths(transactions, currentYM);
      // Conta max streak consecutivo di mesi sotto budget
      let streak = 0;
      let best = 0;
      let prev: string | null = null;
      for (const [ym, spent] of months) {
        if (spent >= freeBudget) { streak = 0; prev = ym; continue; }
        // Verifica continuità (mese precedente = ym - 1)
        if (prev) {
          const [y, m] = prev.split('-').map(Number);
          const [y2, m2] = ym.split('-').map(Number);
          const isAdjacent = (y === y2 && m2 === m + 1) || (y2 === y + 1 && m === 12 && m2 === 1);
          streak = isAdjacent ? streak + 1 : 1;
        } else {
          streak = 1;
        }
        if (streak > best) best = streak;
        prev = ym;
      }
      return best >= 3;
    },
  },
  {
    id: 'gordon_gekko',
    emoji: '🦎',
    name: 'Gordon Gekko',
    quote: 'Greed is good.',
    source: 'Wall Street',
    description: 'In famiglia: sei il top spender per 2 mesi consecutivi.',
    check: ({ transactions, userUid, familyMembers, currentYM }) => {
      if (familyMembers.length < 2) return false;
      // Per ogni mese passato, calcola chi ha speso di più
      const byMonthByUser: Record<string, Record<string, number>> = {};
      for (const t of transactions) {
        if (t.type !== 'expense') continue;
        const ym = t.date.slice(0, 7);
        if (ym >= currentYM) continue;
        if (!byMonthByUser[ym]) byMonthByUser[ym] = {};
        byMonthByUser[ym][t.userId] = (byMonthByUser[ym][t.userId] ?? 0) + t.amount;
      }
      const months = Object.keys(byMonthByUser).sort();
      let streak = 0;
      for (const ym of months) {
        const entries = Object.entries(byMonthByUser[ym]);
        if (entries.length === 0) { streak = 0; continue; }
        entries.sort((a, b) => b[1] - a[1]);
        if (entries[0][0] === userUid) streak += 1;
        else streak = 0;
        if (streak >= 2) return true;
      }
      return false;
    },
  },
  {
    id: 'tessoro',
    emoji: '💍',
    name: 'Mio Tessssoro',
    quote: 'Il mio tessssoro...',
    source: 'Il Signore degli Anelli',
    description: '3 mesi di fila con tesoretto positivo (avanzo).',
    check: ({ transactions, profile, currentYM }) => {
      const freeBudget = getFreeBudget(profile);
      if (freeBudget === 0) return false;
      const months = pastMonths(transactions, currentYM);
      let streak = 0;
      let prev: string | null = null;
      for (const [ym, spent] of months) {
        const saved = freeBudget - spent;
        if (saved <= 0) { streak = 0; prev = ym; continue; }
        if (prev) {
          const [y, m] = prev.split('-').map(Number);
          const [y2, m2] = ym.split('-').map(Number);
          const isAdjacent = (y === y2 && m2 === m + 1) || (y2 === y + 1 && m === 12 && m2 === 1);
          streak = isAdjacent ? streak + 1 : 1;
        } else {
          streak = 1;
        }
        if (streak >= 3) return true;
        prev = ym;
      }
      return false;
    },
  },
  {
    id: 'mr_krabs',
    emoji: '🦀',
    name: 'Mr. Krabs',
    quote: 'I like money.',
    source: 'SpongeBob',
    description: 'Accumula 500€ di risparmio totale.',
    check: (ctx) => cumulativeSavings(ctx.transactions, ctx.profile, ctx.currentYM) >= 500,
  },
  {
    id: 'mr_burns',
    emoji: '👴',
    name: 'Mr. Burns',
    quote: 'Excellent.',
    source: 'I Simpson',
    description: 'Accumula 1.000€ di risparmio totale.',
    check: (ctx) => cumulativeSavings(ctx.transactions, ctx.profile, ctx.currentYM) >= 1000,
  },
  {
    id: 'hakuna_matata',
    emoji: '🦁',
    name: 'Hakuna Matata',
    quote: 'Nessun pensiero, è il nostro motto.',
    source: 'Il Re Leone',
    description: 'Chiudi un mese senza sforare nessuna categoria.',
    check: ({ transactions, profile, currentYM }) => {
      if (!profile || profile.categories.length === 0) return false;
      // Per ogni mese passato, verifica che ogni categoria sia <= budget
      const byMonthByCat: Record<string, Record<string, number>> = {};
      for (const t of transactions) {
        if (t.type !== 'expense') continue;
        const ym = t.date.slice(0, 7);
        if (ym >= currentYM) continue;
        const cat = stripEmoji(t.category);
        if (!byMonthByCat[ym]) byMonthByCat[ym] = {};
        byMonthByCat[ym][cat] = (byMonthByCat[ym][cat] ?? 0) + t.amount;
      }
      const catBudgets: Record<string, number> = {};
      for (const c of profile.categories) catBudgets[c.name] = c.budget;
      return Object.entries(byMonthByCat).some(([, bycat]) =>
        Object.entries(bycat).every(([name, spent]) =>
          (catBudgets[name] ?? Infinity) >= spent,
        ),
      );
    },
  },
  {
    id: 'sherlock',
    emoji: '🔍',
    name: 'Sherlock',
    quote: 'Elementare, mio caro Watson.',
    source: 'Sherlock Holmes',
    description: 'Aggiungi 30 transazioni categorizzate.',
    check: ({ transactions }) => transactions.length >= 30,
  },
  {
    id: 'smaug',
    emoji: '🐉',
    name: 'Smaug',
    quote: 'Gold and gemstones beyond measure.',
    source: 'Lo Hobbit',
    description: 'Accumula 5.000€ di risparmio totale.',
    check: (ctx) => cumulativeSavings(ctx.transactions, ctx.profile, ctx.currentYM) >= 5000,
  },
  {
    id: 'thanos',
    emoji: '🪐',
    name: 'Thanos',
    quote: 'Perfectly balanced, as all things should be.',
    source: 'Avengers',
    description: 'Chiudi un mese in perfetto bilico (scarto <3% dal budget).',
    check: ({ transactions, profile, currentYM }) => {
      const freeBudget = getFreeBudget(profile);
      if (freeBudget === 0) return false;
      return pastMonths(transactions, currentYM).some(
        ([, spent]) => Math.abs(spent - freeBudget) / freeBudget < 0.03,
      );
    },
  },
];
