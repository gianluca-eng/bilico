import { useEffect, useRef } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import type { Transaction } from '../types';

/**
 * Genera automaticamente le transazioni ricorrenti mancanti.
 * Si lancia ogni volta che cambia la lista transazioni: per ogni template
 * (tx con `recurring`), crea i cloni mensili dal mese successivo al template
 * fino al mese corrente (o a `endDate`), saltando quelli già presenti.
 *
 * È idempotente: se un clone per lo stesso (templateId, YM) esiste già,
 * non lo ricrea.
 */
export function useRecurring(userId: string | undefined) {
  const transactions = useStore(s => s.transactions);
  // Evita di processare lo stesso template due volte in parallelo
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || transactions.length === 0) return;

    // Templates = transazioni con config recurring (solo i MIEI)
    const templates = transactions.filter(
      t => t.recurring && t.userId === userId && !t.id.startsWith('_'),
    );
    if (templates.length === 0) return;

    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const tpl of templates) {
      if (inFlight.current.has(tpl.id)) continue;

      // Data base: quando è stato creato il template (usa il suo `date`)
      const [ty, tm, td] = tpl.date.split('-').map(Number);
      if (!ty || !tm || !td) continue;

      // Calcola tutti i mesi da generare: dal mese SUCCESSIVO al template
      // fino al mese corrente (inclusivo), rispettando endDate
      const ymToGenerate: Array<{ ym: string; date: string }> = [];
      const cursor = new Date(ty, tm - 1, 1);
      cursor.setMonth(cursor.getMonth() + 1); // mese successivo

      while (true) {
        const cy = cursor.getFullYear();
        const cm = cursor.getMonth() + 1;
        const ym = `${cy}-${String(cm).padStart(2, '0')}`;

        if (ym > currentYM) break;

        // Calcola il giorno effettivo: stesso giorno del template,
        // clampato all'ultimo giorno del mese se il mese è più corto
        const daysInMonth = new Date(cy, cm, 0).getDate();
        const day = Math.min(td, daysInMonth);
        const date = `${cy}-${String(cm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Se c'è endDate e questa generazione la supera, stop
        if (tpl.recurring?.endDate && date > tpl.recurring.endDate) break;

        ymToGenerate.push({ ym, date });
        cursor.setMonth(cursor.getMonth() + 1);
      }

      // Filtra via quelli già esistenti (stesso sourceRecurringId e stesso YM)
      const missing = ymToGenerate.filter(({ ym }) =>
        !transactions.some(
          t => t.sourceRecurringId === tpl.id && t.date.startsWith(ym),
        ),
      );
      if (missing.length === 0) continue;

      inFlight.current.add(tpl.id);

      (async () => {
        try {
          for (const { date } of missing) {
            const clone: Omit<Transaction, 'id'> = {
              type: tpl.type,
              amount: tpl.amount,
              category: tpl.category,
              description: tpl.description,
              date,
              userId: tpl.userId,
              familyId: tpl.familyId,
              createdAt: new Date().toISOString(),
              isPrivate: tpl.isPrivate ?? false,
              sourceRecurringId: tpl.id,
            };
            await addDoc(collection(db, 'transactions'), clone);
          }
          // Lo store si aggiornerà automaticamente via onSnapshot
        } catch (err) {
          console.warn('[recurring] generation failed for', tpl.id, err);
        } finally {
          inFlight.current.delete(tpl.id);
        }
      })();
    }
  }, [transactions, userId]);
}
