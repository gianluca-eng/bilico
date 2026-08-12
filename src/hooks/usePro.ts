import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import {
  purchasesAvailable,
  syncPurchasesUser,
  fetchProPackages,
  buyProPackage,
  restoreProPurchases,
  currentProStatus,
  addProStatusListener,
  removeProStatusListener,
  type ProPackage,
} from '../lib/purchases';

export interface ProState {
  /** true se l'utente ha accesso alle funzioni PRO. */
  isPro: boolean;
  /** false su web o se manca la chiave RevenueCat: niente acquisti. */
  available: boolean;
  packages: ProPackage[];
  loading: boolean;
  /** Errore bloccante: i piani non si sono caricati. */
  error: string | null;
  /** Messaggio non bloccante da mostrare dopo acquisto/ripristino. */
  notice: string | null;
  /** id del package in corso di acquisto, per lo stato del bottone. */
  purchasingId: string | null;
  restoring: boolean;
  reload: () => void;
  buy: (p: ProPackage) => Promise<void>;
  restore: () => Promise<void>;
  clearNotice: () => void;
}

/**
 * Stato dell'abbonamento Bilico PRO.
 *
 * La verità sull'abbonamento è RevenueCat, non Firestore: l'appUserID è
 * l'uid Firebase, quindi l'entitlement segue l'account su qualsiasi device
 * senza bisogno di specchiarlo nel profilo.
 *
 * `profile.isPremium` resta come concessione manuale (utenti storici a cui
 * il PRO è stato attivato a mano) e viene messo in OR con l'entitlement.
 * Di proposito non lo riscriviamo mai da qui: un ritorno a false da parte
 * dello store cancellerebbe una concessione fatta a mano.
 */
export function usePro(): ProState {
  const { user, profile } = useStore();
  const uid = user?.uid ?? null;
  const legacyGrant = profile?.isPremium === true;

  const [entitled, setEntitled] = useState(false);
  const [packages, setPackages] = useState<ProPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // Evita setState dopo unmount / cambio utente.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const available = purchasesAvailable();

  // ── Identità RevenueCat + stato entitlement + listener ──
  useEffect(() => {
    let listenerId: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        await syncPurchasesUser(uid);
      } catch (err) {
        console.warn('[pro] sync utente fallito:', err);
      }
      if (cancelled) return;

      if (!uid || !purchasesAvailable()) {
        setEntitled(false);
        return;
      }

      try {
        const pro = await currentProStatus();
        if (!cancelled) setEntitled(pro);
      } catch (err) {
        console.warn('[pro] stato iniziale non leggibile:', err);
      }

      if (cancelled) return;
      listenerId = await addProStatusListener((pro) => {
        if (!cancelled) setEntitled(pro);
      });
    })();

    return () => {
      cancelled = true;
      if (listenerId) void removeProStatusListener(listenerId);
    };
  }, [uid]);

  // ── Caricamento piani ──
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!uid) return;
      if (!purchasesAvailable()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // I piani arrivano dopo configure/logIn, gestiti dall'effetto sopra.
        await syncPurchasesUser(uid);
        const list = await fetchProPackages();
        if (cancelled) return;
        setPackages(list);
        if (list.length === 0) {
          setError(
            'Non riusciamo a caricare i piani dallo store in questo momento. Riprova tra poco.',
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[pro] offerte non caricate:', err);
        setPackages([]);
        setError(
          'Non riusciamo a caricare i piani dallo store in questo momento. Riprova tra poco.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, reloadTick]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const buy = useCallback(async (p: ProPackage) => {
    setNotice(null);
    setPurchasingId(p.id);
    const outcome = await buyProPackage(p);
    if (!aliveRef.current) return;
    setPurchasingId(null);

    if (outcome.status === 'purchased') {
      setEntitled(outcome.isPro);
      setNotice(
        outcome.isPro
          ? 'Bilico PRO attivo. Buone scansioni.'
          // Pagamento andato a buon fine ma entitlement non attivo: di solito
          // il prodotto non è agganciato all'entitlement `pro` su RevenueCat.
          : 'Acquisto registrato, ma non riusciamo ad attivare il PRO. Prova "Ripristina acquisti" o scrivici.',
      );
      return;
    }
    // L'annullamento è una scelta dell'utente: nessun errore da mostrare.
    if (outcome.status === 'cancelled') return;
    setNotice(outcome.message ?? 'Acquisto non riuscito. Riprova.');
  }, []);

  const restore = useCallback(async () => {
    setNotice(null);
    setRestoring(true);
    const result = await restoreProPurchases();
    if (!aliveRef.current) return;
    setRestoring(false);

    if (result.error) {
      setNotice(result.error);
      return;
    }
    setEntitled(result.isPro);
    setNotice(
      result.isPro
        ? 'Abbonamento ripristinato.'
        : 'Nessun abbonamento da ripristinare su questo account.',
    );
  }, []);

  return {
    isPro: entitled || legacyGrant,
    available,
    packages,
    loading,
    error,
    notice,
    purchasingId,
    restoring,
    reload,
    buy,
    restore,
    clearNotice,
  };
}
