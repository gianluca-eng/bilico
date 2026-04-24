# Bilico

**Il budget familiare in bilico.** Un'app progressiva multipiattaforma (web + Android + iOS) per gestire insieme le spese di coppia e famiglia senza fogli Excel e senza sensi di colpa.

Demo: https://quota-sigma.vercel.app

## ✨ Cosa fa

- **Onboarding** in 5 step (obiettivo, reddito, spese fisse, abitudini, tesoretto)
- **Dashboard** con bilancia animata speso/libero, 3 tab (Casa, Movimenti, Obiettivi)
- **Famiglia condivisa**: invito via link, quote 50/50, toggle *Io / Famiglia / Tutto*
- **Scan scontrini** via Google Cloud Vision con auto-categorizzazione
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

## 📁 Struttura

```
src/
  App.tsx                 routes
  components/             BalanceScale, Ui, tokens, Trofei
  hooks/                  useAuth, useTransactions, useBadges, useRecurring
  lib/                    firebase, store (zustand), vision (OCR), badges, sharing
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
