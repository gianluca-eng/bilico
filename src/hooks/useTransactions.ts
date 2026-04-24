import { useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import type { Transaction } from '../types';

export function useTransactions(userId: string | undefined, familyId?: string) {
  const { setTransactions } = useStore();

  useEffect(() => {
    if (!userId) return;

    // Se l'utente fa parte di un gruppo, carica le transazioni di tutto il gruppo
    const q = familyId
      ? query(
          collection(db, 'transactions'),
          where('familyId', '==', familyId),
          orderBy('createdAt', 'desc')
        )
      : query(
          collection(db, 'transactions'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Transaction[];
        setTransactions(txs);
      },
      (err) => {
        console.warn('Transactions sync unavailable:', err.code);
      }
    );

    return unsubscribe;
  }, [userId, familyId, setTransactions]);

  const addTransaction = async (
    data: Omit<Transaction, 'id' | 'createdAt'>,
    optimistic: (tx: Transaction) => void
  ) => {
    const optimisticTx: Transaction = {
      ...data,
      id: '_' + Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
    };
    optimistic(optimisticTx);

    try {
      await addDoc(collection(db, 'transactions'), {
        ...data,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore write failed, keeping optimistic tx:', err);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!id.startsWith('_')) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (err) {
        console.warn('Delete failed:', err);
      }
    }
    useStore.getState().removeTransaction(id);
  };

  /**
   * Aggiorna una transazione esistente.
   * `patch` contiene solo i campi modificati (amount, category, description).
   * L'update è ottimistico: lo store locale cambia subito,
   * Firestore viene aggiornato in background.
   */
  const updateTransaction = async (
    id: string,
    patch: Partial<Pick<Transaction, 'amount' | 'category' | 'description' | 'date' | 'type' | 'isPrivate'>>,
  ) => {
    // Ottimistico: aggiorna lo store
    useStore.setState(s => ({
      transactions: s.transactions.map(t =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    }));

    // Se è una transazione optimistic non ancora persistita, fermati qui
    if (id.startsWith('_')) return;

    try {
      await updateDoc(doc(db, 'transactions', id), patch);
    } catch (err) {
      console.warn('Update failed:', err);
    }
  };

  return { addTransaction, deleteTransaction, updateTransaction };
}
