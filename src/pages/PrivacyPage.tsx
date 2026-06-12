import { useNavigate } from 'react-router-dom';
import { Wordmark } from '../components/BalanceScale';
import { IconBtn, ArrowLeft } from '../components/Ui';
import {
  H, B, INK, CREAM, INK_70, INK_50,
} from '../components/tokens';

const SUPPORT_EMAIL = 'bilico.app@gmail.com';
const UPDATED = '26 aprile 2026';

export default function PrivacyPage() {
  const navigate = useNavigate();

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{
        ...H, fontWeight: 800, fontSize: 17, color: INK,
        letterSpacing: '-0.3px', margin: '0 0 6px',
      }}>{title}</h2>
      <div style={{ ...B, fontSize: 14, color: INK_70, lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100svh',
      background: CREAM,
      padding: 'calc(40px + env(safe-area-inset-top, 0px)) 24px calc(40px + env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box',
      maxWidth: 560,
      margin: '0 auto',
      width: '100%',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 24,
      }}>
        <Wordmark />
        <IconBtn onClick={() => navigate(-1)} ariaLabel="Indietro">
          <ArrowLeft />
        </IconBtn>
      </div>

      <h1 style={{
        ...H, fontWeight: 800, fontSize: 30, color: INK,
        letterSpacing: '-1px', margin: '0 0 4px',
      }}>
        Privacy Policy
      </h1>
      <p style={{ ...B, fontSize: 12, color: INK_50, margin: '0 0 28px' }}>
        Ultimo aggiornamento: {UPDATED}
      </p>

      <Section title="Chi siamo">
        Bilico è un'applicazione per la gestione del budget familiare. Il
        titolare del trattamento è il gestore dell'app, contattabile
        all'indirizzo <strong style={{ color: INK }}>{SUPPORT_EMAIL}</strong>.
      </Section>

      <Section title="Quali dati raccogliamo">
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          <li><strong>Account</strong>: nome, indirizzo email e immagine del profilo
            forniti dal tuo account Google al momento dell'accesso.</li>
          <li><strong>Dati finanziari che inserisci tu</strong>: reddito mensile,
            spese fisse, categorie di budget, transazioni (importo, categoria,
            descrizione, data).</li>
          <li><strong>Famiglia</strong>: se condividi il budget, i membri vedono
            il nome e il colore del tuo profilo, e le transazioni che non marchi
            come private.</li>
        </ul>
      </Section>

      <Section title="Come usiamo i dati">
        Usiamo i dati esclusivamente per far funzionare l'app: calcolare il
        budget, mostrare le statistiche, sincronizzare le spese tra i membri
        della famiglia. <strong style={{ color: INK }}>Non vendiamo i tuoi
        dati e non li usiamo per pubblicità.</strong>
      </Section>

      <Section title="Scansione scontrini">
        Quando fotografi uno scontrino, l'immagine viene inviata al servizio
        Google Cloud Vision solo per estrarre il testo (importo, negozio).
        L'immagine <strong style={{ color: INK }}>non viene salvata</strong> da
        Bilico né su un server: resta sul tuo dispositivo e viene scartata dopo
        l'elaborazione.
      </Section>

      <Section title="Dove sono conservati i dati">
        I dati sono conservati su Google Firebase (Firestore), infrastruttura
        di Google. Le regole di sicurezza fanno sì che solo tu — e i membri
        della tua famiglia per le spese condivise — possiate leggere i tuoi
        dati. Nessun altro utente registrato può accedere al tuo reddito o
        alle tue transazioni.
      </Section>

      <Section title="I tuoi diritti (GDPR)">
        Puoi in qualsiasi momento accedere, correggere o cancellare i tuoi
        dati. Per cancellare l'account e tutti i dati associati, scrivi a{' '}
        <strong style={{ color: INK }}>{SUPPORT_EMAIL}</strong>: provvederemo
        entro 30 giorni.
      </Section>

      <Section title="Minori">
        Bilico non è destinata a minori di 16 anni. Non raccogliamo
        consapevolmente dati di minori.
      </Section>

      <Section title="Modifiche">
        Potremmo aggiornare questa policy. Le modifiche rilevanti saranno
        comunicate in app. L'uso continuato dell'app dopo un aggiornamento
        costituisce accettazione della policy aggiornata.
      </Section>

      <Section title="Contatti">
        Per qualsiasi domanda sulla privacy: {' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: INK, fontWeight: 700 }}>
          {SUPPORT_EMAIL}
        </a>
      </Section>
    </div>
  );
}
