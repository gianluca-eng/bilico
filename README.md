# Bilico

**Il budget familiare in bilico.** Un'app progressiva multipiattaforma (web + Android + iOS) per gestire insieme le spese di coppia e famiglia senza fogli Excel e senza sensi di colpa.

Demo: https://bilico.vercel.app

## ✨ Cosa fa

- **Onboarding** in 5 step (obiettivo, reddito, spese fisse, abitudini, tesoretto)
- **Dashboard** con bilancia animata speso/libero, 3 tab (Casa, Movimenti, Obiettivi)
- **Famiglia condivisa**: invito via link, quote 50/50, toggle *Io / Famiglia / Tutto*
- **Scan scontrini** via Google Cloud Vision con auto-categorizzazione — funzione **PRO**, sbloccata dall'abbonamento in-app
- **Spese ricorrenti** mensili con generazione automatica + data fine opzionale
- **Privacy trasparente**: una spesa marcata privata appare comunque (importo, autore) ma con categoria/descrizione nascoste
- **Trofei** — 12 badge a tema finance/film (Zio Paperone, Wolf of Wall Street, Thanos "Perfectly balanced", …)
- **Modifica / cancella** transazioni con conferma doppia
- **Filtro per membro** nella tab Storico
- **Navigazione mesi** (mesi passati in sola lettura)
- **Menu profilo** con reset onboarding, famiglia, supporto

## 🧱 Stack

| Layer | Scelta |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| State | Zustand |
| Routing | React Router DOM v7 |
| Backend | Firebase Auth + Firestore |
| Mobile | Capacitor 8 (Android + iOS) |
| OCR | Google Cloud Vision REST API |
| Deploy | Vercel (auto-deploy da `main`) |
| Font | Bricolage Grotesque, Epilogue, Instrument Serif |

Design neo-brutalist: palette crema + accenti arancio/corallo, bordi 2.5 px INK, ombre hard offset `3px 3px 0 INK`.

## 🚀 Setup su una nuova macchina

```bash
# 1. Clona
git clone https://github.com/gianluca-eng/bilico.git
cd bilico

# 2. Dipendenze
npm install

# 3. Scarica google-services.json per Android (se fai build nativa)
npx -y firebase-tools apps:sdkconfig ANDROID \
  1:124241832106:android:6bad0be1b35badfe0bc8d3 \
  --project quota-app-d5505 \
  --out android/app/google-services.json

# 4. Dev server
npm run dev
```

## 📜 Script utili

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Dev server Vite su porta 5173 |
| `npm run build` | Type-check + build production in `dist/` |
| `npm run preview` | Serve il build di produzione localmente |
| `npm run lint` | ESLint su tutto il codice |
| `npm run cap:sync` | Build + sync asset nativi su `android/` e `ios/` |
| `npm run cap:android` | Sync + apri Android Studio |
| `npm run cap:ios` | Sync + apri Xcode |

## 💳 Abbonamento Bilico PRO (acquisti in-app)

La scansione scontrini è la funzione a pagamento. L'acquisto passa da
**StoreKit / Play Billing** tramite **RevenueCat** (`src/lib/purchases.ts`,
`src/hooks/usePro.ts`, `src/components/PaywallSheet.tsx`). Non esiste nessun
canale di pagamento alternativo: farsi pagare fuori dallo store per sbloccare
funzioni dell'app viola la guideline App Store 3.1.1.

L'`appUserID` di RevenueCat è l'uid Firebase, quindi l'abbonamento segue
l'account su qualsiasi dispositivo. `profile.isPremium` resta solo come
concessione manuale per gli utenti storici e non viene mai riscritto dal
flusso di acquisto.

### Configurazione, in ordine

1. **App Store Connect → Business**: l'Account Holder deve accettare il
   **Paid Applications Agreement**. Finché non è "in effetto" StoreKit
   restituisce **zero prodotti** e la paywall risulta vuota — è la causa
   numero uno del rifiuto per guideline 2.1(b).
2. **Crea l'abbonamento** in App Store Connect: gruppo di sottoscrizione,
   **localizzazione del gruppo**, nome e descrizione localizzati, prezzo per
   tutti i territori, screenshot di review. Se il prodotto resta in
   *Missing Metadata* non viene restituito allo store.
3. **Allega gli IAP alla versione** dell'app: alla prima submission vanno
   inviati insieme al binario, non separatamente.
4. **RevenueCat**: collega l'app, importa i prodotti, crea l'entitlement
   con identificativo **`pro`** e mettilo nell'offering `current`.
5. **Chiavi**: `VITE_REVENUECAT_IOS_KEY` e `VITE_REVENUECAT_ANDROID_KEY` in
   `.env.local` (e su Vercel se serve). Sono chiavi pubbliche SDK.
6. `npm run cap:sync` per registrare il plugin nativo, poi build.

### Test prima di risottomettere

Sandbox Apple ID su device reale (o TestFlight, che usa comunque la
sandbox). Da verificare: i piani compaiono, l'acquisto va a buon fine,
**Ripristina acquisti** funziona, e i link a termini e privacy nella paywall
si aprono davvero — sono tutti requisiti della guideline 3.1.2.

Su web gli acquisti sono disattivati per costruzione: la paywall spiega di
usare l'app mobile.

## 📁 Struttura

```
src/
  App.tsx                 routes
  components/             BalanceScale, Ui, tokens, Trofei, PaywallSheet
  hooks/                  useAuth, useTransactions, useBadges, useRecurring, usePro
  lib/                    firebase, store (zustand), vision (OCR), badges, sharing, purchases (RevenueCat)
  pages/                  Login, Onboarding, Dashboard, Family, Join
  types/                  tipi condivisi

android/                  progetto Capacitor Android
ios/                      progetto Capacitor iOS
public/                   icone PWA, manifest, service worker
firestore.rules           regole di sicurezza Firestore (versionate)
```

## 🔐 Sicurezza

- **API key Vision hardcoded** in `src/lib/vision.ts` — ok finché il repo è privato, da spostare in env var prima di eventuale apertura pubblica.
- **Regole Firestore** in `firestore.rules`, deployate via `firebase deploy --only firestore:rules`.
- **`google-services.json`** escluso dal repo per igiene.

## 🛤 Roadmap

- [ ] Quote personalizzabili per categoria (oggi default 50/50)
- [ ] Budget separati "Io vs Famiglia" nel view mode
- [ ] Onboarding corto per i partner (oggi fanno quello completo)
- [ ] Ruolo "figlio" con paghetta e UI ridotta
- [ ] Insights AI settimanali via Claude API
- [ ] Export CSV/PDF per commercialista e 730
- [ ] Alert intelligenti (sforamento categoria)
- [ ] Sfide attive ("mese senza delivery")

## 📄 License

Progetto personale. Tutti i diritti riservati.
