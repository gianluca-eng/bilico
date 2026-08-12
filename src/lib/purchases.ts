// ─── Acquisti in-app: Bilico PRO ───────────────────────────────────────────
//
// L'abbonamento passa SEMPRE dal sistema di pagamento dello store (StoreKit
// su iOS, Play Billing su Android). È un requisito App Store — guideline
// 3.1.1: per sbloccare funzioni dell'app non si può usare un canale di
// pagamento esterno, né rimandare l'utente fuori dall'app per pagare.
//
// RevenueCat fa da wrapper sopra StoreKit/Billing ed è la fonte di verità
// per l'entitlement `pro`: valida le ricevute lato server e sa dire se
// l'utente è abbonato anche dopo reinstallazione o cambio dispositivo.
// L'appUserID è l'uid Firebase, quindi l'abbonamento segue l'account.
//
// Su web (build Vercel) gli acquisti non esistono: tutto degrada in modo
// pulito e la paywall spiega di usare l'app mobile.

import { Capacitor } from '@capacitor/core';
import {
  Purchases,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
} from '@revenuecat/purchases-capacitor';
import type {
  CustomerInfo,
  PurchasesError,
  PurchasesPackage,
} from '@revenuecat/purchases-capacitor';

/** Entitlement configurato nella dashboard RevenueCat. */
export const PRO_ENTITLEMENT = 'pro';

/**
 * EULA standard Apple. La paywall DEVE linkare termini e privacy
 * (guideline 3.1.2): se pubblichi termini tuoi, sostituisci questo URL.
 */
export const TERMS_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

function apiKey(): string | null {
  const platform = Capacitor.getPlatform();
  const key =
    platform === 'ios'
      ? (import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined)
      : platform === 'android'
        ? (import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined)
        : undefined;
  return key && key.length > 0 ? key : null;
}

/** true solo su device nativo con chiave RevenueCat configurata. */
export function purchasesAvailable(): boolean {
  return Capacitor.isNativePlatform() && apiKey() !== null;
}

// ─── Configurazione / identità ─────────────────────────────────────────────

let configured = false;
let currentAppUserId: string | null = null;

/**
 * Allinea l'utente RevenueCat a quello Firebase.
 * Idempotente: `configure` una volta sola, poi logIn/logOut sui cambi account.
 */
export async function syncPurchasesUser(uid: string | null): Promise<void> {
  const key = apiKey();
  if (!Capacitor.isNativePlatform() || !key) return;

  if (!uid) {
    if (configured && currentAppUserId) {
      try {
        await Purchases.logOut();
      } catch (err) {
        console.warn('[pro] logOut fallito:', err);
      }
      currentAppUserId = null;
    }
    return;
  }

  if (!configured) {
    await Purchases.setLogLevel({
      level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN,
    });
    await Purchases.configure({ apiKey: key, appUserID: uid });
    configured = true;
    currentAppUserId = uid;
    return;
  }

  if (currentAppUserId !== uid) {
    await Purchases.logIn({ appUserID: uid });
    currentAppUserId = uid;
  }
}

// ─── Offerte ───────────────────────────────────────────────────────────────

export interface ProPackage {
  /** Identificativo del package RevenueCat (es. "$rc_monthly"). */
  id: string;
  /** Product ID sullo store, utile per il debug. */
  productId: string;
  title: string;
  description: string;
  /** Prezzo già localizzato e con valuta dello store (es. "3,00 €"). */
  priceString: string;
  /** Durata in chiaro: "al mese", "all'anno"… */
  periodLabel: string;
  /** Prezzo mensile equivalente, se lo store lo espone (per i piani annuali). */
  perMonthLabel: string | null;
  isAnnual: boolean;
  raw: PurchasesPackage;
}

/** Durata leggibile da un periodo ISO 8601 (P1M, P1Y, P7D…). */
function periodFromIso(iso: string | null): string {
  if (!iso) return '';
  const m = /^P(\d+)([DWMY])$/.exec(iso);
  if (!m) return '';
  const n = Number(m[1]);
  switch (m[2]) {
    case 'D':
      return n === 1 ? 'al giorno' : `ogni ${n} giorni`;
    case 'W':
      return n === 1 ? 'a settimana' : `ogni ${n} settimane`;
    case 'M':
      return n === 1 ? 'al mese' : `ogni ${n} mesi`;
    default:
      return n === 1 ? "all'anno" : `ogni ${n} anni`;
  }
}

function periodLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.WEEKLY:
      return 'a settimana';
    case PACKAGE_TYPE.MONTHLY:
      return 'al mese';
    case PACKAGE_TYPE.TWO_MONTH:
      return 'ogni 2 mesi';
    case PACKAGE_TYPE.THREE_MONTH:
      return 'ogni 3 mesi';
    case PACKAGE_TYPE.SIX_MONTH:
      return 'ogni 6 mesi';
    case PACKAGE_TYPE.ANNUAL:
      return "all'anno";
    case PACKAGE_TYPE.LIFETIME:
      return 'una tantum';
    default:
      return periodFromIso(pkg.product.subscriptionPeriod);
  }
}

/** iOS restituisce titoli tipo "Bilico PRO (Bilico)": togliamo la coda. */
function cleanTitle(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function toProPackage(pkg: PurchasesPackage): ProPackage {
  const isAnnual = pkg.packageType === PACKAGE_TYPE.ANNUAL;
  return {
    id: pkg.identifier,
    productId: pkg.product.identifier,
    title: cleanTitle(pkg.product.title) || 'Bilico PRO',
    description: pkg.product.description,
    priceString: pkg.product.priceString,
    periodLabel: periodLabel(pkg),
    perMonthLabel: isAnnual ? pkg.product.pricePerMonthString : null,
    isAnnual,
    raw: pkg,
  };
}

/**
 * Legge i piani dall'offering `current` di RevenueCat.
 *
 * Ritorna array vuoto se non c'è nulla da vendere. Succede quando il Paid
 * Applications Agreement non è attivo su App Store Connect, o quando i
 * prodotti sono ancora in "Missing Metadata": in entrambi i casi lo store
 * non restituisce prodotti. È esattamente il caso in cui App Review vede
 * una paywall vuota, quindi il chiamante deve mostrare un messaggio chiaro.
 */
export async function fetchProPackages(): Promise<ProPackage[]> {
  if (!purchasesAvailable()) return [];
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current;
  if (!offering) return [];
  return offering.availablePackages.map(toProPackage);
}

// ─── Stato entitlement ─────────────────────────────────────────────────────

export function hasPro(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT] !== undefined;
}

export async function currentProStatus(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return hasPro(customerInfo);
}

/** URL di gestione abbonamento dello store (per chi è già abbonato). */
export async function proManagementUrl(): Promise<string | null> {
  if (!purchasesAvailable()) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.managementURL;
  } catch {
    return null;
  }
}

export async function addProStatusListener(
  cb: (isPro: boolean) => void,
): Promise<string | null> {
  if (!purchasesAvailable()) return null;
  return Purchases.addCustomerInfoUpdateListener((info) => cb(hasPro(info)));
}

export async function removeProStatusListener(id: string): Promise<void> {
  if (!purchasesAvailable()) return;
  try {
    await Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: id });
  } catch (err) {
    console.warn('[pro] rimozione listener fallita:', err);
  }
}

// ─── Acquisto e ripristino ─────────────────────────────────────────────────

export interface PurchaseOutcome {
  status: 'purchased' | 'cancelled' | 'error';
  isPro: boolean;
  message?: string;
}

function asPurchasesError(err: unknown): PurchasesError | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return err as PurchasesError;
  }
  return null;
}

function wasCancelled(err: unknown): boolean {
  const e = asPurchasesError(err);
  if (!e) return false;
  return (
    e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    e.userCancelled === true
  );
}

function readableError(err: unknown): string {
  const e = asPurchasesError(err);
  if (e?.message) return e.message;
  if (err instanceof Error) return err.message;
  return 'Qualcosa è andato storto. Riprova.';
}

export async function buyProPackage(p: ProPackage): Promise<PurchaseOutcome> {
  if (!purchasesAvailable()) {
    return {
      status: 'error',
      isPro: false,
      message: 'Gli acquisti sono disponibili solo nell’app per iPhone e Android.',
    };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: p.raw });
    return { status: 'purchased', isPro: hasPro(customerInfo) };
  } catch (err) {
    if (wasCancelled(err)) return { status: 'cancelled', isPro: false };
    console.warn('[pro] acquisto fallito:', err);
    return { status: 'error', isPro: false, message: readableError(err) };
  }
}

/**
 * Ripristino acquisti. Obbligatorio per App Review: senza un modo esplicito
 * di recuperare un abbonamento già pagato l'app viene respinta.
 */
export async function restoreProPurchases(): Promise<{
  isPro: boolean;
  error?: string;
}> {
  if (!purchasesAvailable()) {
    return {
      isPro: false,
      error: 'Il ripristino è disponibile solo nell’app per iPhone e Android.',
    };
  }
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return { isPro: hasPro(customerInfo) };
  } catch (err) {
    console.warn('[pro] ripristino fallito:', err);
    return { isPro: false, error: readableError(err) };
  }
}
