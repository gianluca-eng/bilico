import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { BADGES, type BadgeDef } from '../lib/badges';

const currentYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export interface UnlockedBadge {
  def: BadgeDef;
  unlockedAt: string | null; // null = non ancora sbloccato
}

export function useBadges() {
  const { profile, transactions, user, familyMembers } = useStore();
  const [toastQueue, setToastQueue] = useState<BadgeDef[]>([]);
  const persistingRef = useRef<Set<string>>(new Set()); // evita race con update in volo

  // Lista achievements già sbloccati nel profilo
  const achievements = profile?.achievements ?? {};

  // Valuta ogni badge: [sbloccati-già + quelli sbloccabili ora]
  const { all, pending } = useMemo(() => {
    const all: UnlockedBadge[] = BADGES.map(b => ({
      def: b,
      unlockedAt: achievements[b.id]?.unlockedAt ?? null,
    }));
    const pending: BadgeDef[] = [];
    if (user && profile) {
      const ctx = {
        transactions,
        profile,
        userUid: user.uid,
        familyMembers,
        currentYM: currentYM(),
      };
      for (const b of BADGES) {
        if (!achievements[b.id] && !persistingRef.current.has(b.id) && b.check(ctx)) {
          pending.push(b);
        }
      }
    }
    return { all, pending };
  }, [profile, achievements, transactions, user, familyMembers]);

  // Persisti i nuovi sblocchi su Firestore + mostra toast
  useEffect(() => {
    if (!user || pending.length === 0) return;

    // Marca come "in corso" per evitare doppie scritture
    for (const b of pending) persistingRef.current.add(b.id);

    (async () => {
      const now = new Date().toISOString();
      const updates: Record<string, { unlockedAt: string }> = {};
      for (const b of pending) {
        updates[`achievements.${b.id}`] = { unlockedAt: now };
      }

      try {
        await updateDoc(doc(db, 'users', user.uid), updates);
        // Aggiorna profilo locale
        useStore.setState(s => ({
          profile: s.profile ? {
            ...s.profile,
            achievements: {
              ...(s.profile.achievements ?? {}),
              ...Object.fromEntries(pending.map(b => [b.id, { unlockedAt: now }])),
            },
          } : null,
        }));
        // Mostra toast (uno alla volta)
        setToastQueue(q => [...q, ...pending]);
      } catch (err) {
        console.warn('[badges] persist failed:', err);
        // Rilascia il lock così al prossimo re-render ritenta
        for (const b of pending) persistingRef.current.delete(b.id);
      }
    })();
  }, [pending, user]);

  const dismissToast = () => {
    setToastQueue(q => q.slice(1));
  };

  return {
    all,
    toast: toastQueue[0] ?? null,
    dismissToast,
  };
}
