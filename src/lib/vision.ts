// ─── Google Cloud Vision API — Receipt OCR ───────────────────────────────────
// La API key viene letta da `VITE_VISION_KEY` (env var al build time).
// - In locale: definita in `.env.local` (escluso da git)
// - Su Vercel: settata nelle Project Settings → Environment Variables
// - Cloud Vision API deve essere abilitata sul progetto Google Cloud
//
// Se l'env var non è settata, la funzione scanReceipt() lancia un errore
// esplicito invece di fare richieste anonime.

const API_KEY = import.meta.env.VITE_VISION_KEY as string | undefined;
const ENDPOINT = API_KEY
  ? `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`
  : '';

export interface ReceiptResult {
  total: number | null;
  rawText: string;
  merchant: string | null;
  /** Suggested category name (Italian, matches BASE_CATS names when possible). */
  categoryHint: string | null;
  /** Suggested short description for the expense (e.g. "Spesa", "Farmaci", merchant name). */
  descriptionHint: string | null;
}

// ─── Category detection from OCR text ────────────────────────────────────────
// Maps a category name (matching BASE_CATS in OnboardingPage) to keywords.
// Order matters: more specific categories first.
const CATEGORY_KEYWORDS: Array<{ name: string; desc: string; keywords: RegExp }> = [
  {
    name: 'Salute',
    desc: 'Farmaci',
    keywords: /\b(farmacia|parafarmacia|farmacista|tachipirina|aspirina|ibuprofene|paracetamol|antibiotic|sciroppo|compresse|ricetta|asl|ssn|ticket\s+sanitario|dottore|medico|ottico|dentista|laboratorio\s+analisi|fisioterap)\b/i,
  },
  {
    name: 'Trasporti',
    desc: 'Carburante',
    keywords: /\b(eni|agip|q8|esso|tamoil|ip\s|api\s|shell|repsol|erg\s|carburant|benzin|gasolio|diesel|metano|gpl|distributore|pompa|stazione\s+servizio|atac|atm\s|gtt\s|amt\s|autobus|metro|metropolitan|tram|taxi|uber\s|parcheggio|parking|autostrad|pedaggio|telepass)\b/i,
  },
  {
    name: 'Ristoranti e bar',
    desc: 'Ristorante',
    keywords: /\b(ristorante|trattoria|osteria|pizzeria|pizza|bar\s|caffe|caffè|cappuccino|brioche|cornetto|aperitivo|spritz|birra|cocktail|gelateria|gelato|paninoteca|tavola\s+calda|sushi|kebab|mcdonald|burger|coperto|menu|antipasto|primo|secondo|contorno|dolce)\b/i,
  },
  {
    name: 'Spesa alimentare',
    desc: 'Spesa',
    keywords: /\b(esselunga|coop|conad|carrefour|lidl|eurospin|pam|md\s|penny|iper|auchan|todis|bennet|despar|sigma|crai|simply|tigre|famila|in's|tuodi|supermerc|alimentari|panetteria|panificio|macelleria|salumeria|pescheria|fruttivendolo|ortofrutta|gastronomia|drogheria)\b/i,
  },
  {
    name: 'Abbigliamento',
    desc: 'Abbigliamento',
    keywords: /\b(zara|h&m|hm\s|bershka|pull\s*&\s*bear|stradivarius|mango|primark|uniqlo|ovs|piazza\s+italia|terranova|calzedonia|intimissimi|tezenis|decathlon|foot\s*locker|nike|adidas|abbigliamento|scarpe|calzature|boutique|moda)\b/i,
  },
  {
    name: 'Figli',
    desc: 'Figli',
    keywords: /\b(prenatal|chicco|imaginarium|toys|giocatto|pannolin|pampers|huggies|omogeneizzati|plasmon|mellin|biberon|asilo|scuola\s+materna|cartoleria|libri\s+scolastici|zaino\s+scuola|quaderni)\b/i,
  },
  {
    name: 'Animali',
    desc: 'Animali',
    keywords: /\b(veterinari|clinica\s+veterinaria|ambulatorio\s+veterinario|crocchette|cibo\s+per\s+(cane|gatto)|toelettatura|antiparassitar|animali|pet\s*shop|petshop|arcaplanet|maxi\s*zoo)\b/i,
  },
  {
    name: 'Tabacco',
    desc: 'Tabacchi',
    keywords: /\b(tabaccheria|tabacchi|sigarette|marlboro|camel|chesterfield|lucky\s+strike|trinciato|cartine|filtri|accendino)\b/i,
  },
  {
    name: 'Sport',
    desc: 'Sport',
    keywords: /\b(decathlon|cisalfa|intersport|palestra|piscina|tennis|calcetto|padel|crossfit|fitness)\b/i,
  },
  {
    name: 'Viaggi',
    desc: 'Viaggio',
    keywords: /\b(hotel\s|albergo|b&b|bnb|booking|airbnb|trenitalia|italo|treno|biglietto\s+treno|biglietto\s+aereo|ryanair|easyjet|alitalia|ita\s+airways|aeroport|noleggio\s+auto|hertz|avis|europcar)\b/i,
  },
  {
    name: 'Abbonamenti',
    desc: 'Abbonamento',
    keywords: /\b(netflix|spotify|disney\s*\+|prime\s+video|apple\s*(music|tv)|youtube\s+premium|audible|icloud|dropbox|linkedin|canale\s+5)\b/i,
  },
  {
    name: 'Svago',
    desc: 'Svago',
    keywords: /\b(cinema|teatro|concerto|museo|mostra|libreria|feltrinelli|mondadori|videogioco|playstation|xbox|nintendo|steam)\b/i,
  },
];

/** Detect a category hint and description hint from receipt OCR text. */
function detectCategory(text: string, merchant: string | null): { categoryHint: string | null; descriptionHint: string | null } {
  const haystack = (merchant ? merchant + '\n' : '') + text;
  for (const cat of CATEGORY_KEYWORDS) {
    if (cat.keywords.test(haystack)) {
      return { categoryHint: cat.name, descriptionHint: cat.desc };
    }
  }
  return { categoryHint: null, descriptionHint: merchant };
}

/** Convert a File/Blob to a base64 string (without the data: prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip "data:image/...;base64,"
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Call Google Cloud Vision DOCUMENT_TEXT_DETECTION on an image file.
 *  DOCUMENT è specificamente ottimizzato per documenti strutturati (scontrini)
 *  vs TEXT_DETECTION che è generico. Riconosce meglio l'allineamento colonne
 *  e i numeri vicino alle etichette.
 */
async function ocrImage(file: File): Promise<string> {
  const base64 = await fileToBase64(file);

  const body = {
    requests: [{
      image: { content: base64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      imageContext: {
        languageHints: ['it', 'en'],
      },
    }],
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vision API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  // fullTextAnnotation è preferibile su DOCUMENT_TEXT_DETECTION,
  // fallback su textAnnotations se non disponibile.
  const fullText = data.responses?.[0]?.fullTextAnnotation?.text;
  if (fullText) return fullText;
  const annotations = data.responses?.[0]?.textAnnotations;
  return annotations?.[0]?.description ?? '';
}

/**
 * Estrae un importo formato italiano o internazionale da una stringa.
 * Gestisce: 12,50 / 12.50 / 1.234,56 / 1,234.56 / €12,50 / 12,50€
 * Ritorna null se non trova un numero valido.
 */
function extractAmount(s: string): number | null {
  // Cerca pattern numerico con 2 decimali
  const m = s.match(/(\d{1,5}(?:[.,]\d{3})*[.,]\d{2})(?!\d)/);
  if (!m) return null;
  let raw = m[1];
  // Determina il separatore decimale dall'ultimo carattere prima delle 2 cifre finali
  if (/,\d{2}$/.test(raw)) {
    // Italian: punto = migliaia, virgola = decimale
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{2}$/.test(raw)) {
    // English: virgola = migliaia, punto = decimale
    raw = raw.replace(/,/g, '');
  }
  const n = parseFloat(raw);
  if (!isFinite(n) || n <= 0 || n >= 100000) return null;
  return n;
}

/**
 * Parse OCR text di uno scontrino italiano per estrarre il totale.
 *
 * Strategia (in ordine di priorità):
 *  1. Trova TUTTE le occorrenze di parole chiave totale + numero adiacente.
 *     Prende l'ULTIMA (gli scontrini hanno spesso "Subtotale" + "Totale" alla fine).
 *  2. Riconosce metodi di pagamento ("CONTANTI 12,50") che spesso sono il totale.
 *  3. Esclude esplicitamente parole che NON sono il totale: SUBTOTALE, RESTO, SCONTO, IVA, ...
 *  4. Fallback: numero più grande nell'ultimo terzo dello scontrino.
 *  5. Fallback estremo: somma di tutti i prezzi (per scontrini senza totale esplicito).
 */
function parseReceipt(text: string): { total: number | null; merchant: string | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Merchant: prima riga non vuota ──
  const merchant = lines[0] ?? null;

  // ── Setup keyword matching ──
  // Parole che indicano il TOTALE (priorità alta).
  // Ordinate dal più specifico al più generico.
  const TOTAL_KEYWORDS = [
    'totale complessivo',
    'totale generale',
    'totale finale',
    'totale euro',
    'totale eur',
    'totale €',
    'totale',
    'tot.',
    'tot ',
    'tot€',
    'totale dovuto',
    'da pagare',
    'importo dovuto',
    'totale pagamento',
    'pagamento',
  ];

  // Metodi di pagamento (priorità media): spesso seguiti dal totale
  const PAYMENT_KEYWORDS = [
    'contanti',
    'contante',
    'carta',
    'bancomat',
    'pos',
    'paypal',
    'satispay',
    'pagopa',
    'pagato',
  ];

  // Parole da ESCLUDERE: se la riga le contiene, non è il totale
  const EXCLUDE_KEYWORDS = [
    'subtotale',
    'sub-totale',
    'sub totale',
    'parziale',
    'resto',
    'cambio',
    'sconto',
    'iva',
    'imponibile',
    'di cui iva',
    'aliquota',
  ];

  const lineHasAny = (line: string, keywords: string[]) =>
    keywords.some(k => line.includes(k));

  // ── Step 1: cerca candidati totale ──
  type Candidate = { idx: number; value: number; priority: number };
  const candidates: Candidate[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();

    // Salta righe con parole escluse
    if (lineHasAny(lower, EXCLUDE_KEYWORDS)) continue;

    const hasTotal = lineHasAny(lower, TOTAL_KEYWORDS);
    const hasPayment = lineHasAny(lower, PAYMENT_KEYWORDS);

    if (!hasTotal && !hasPayment) continue;

    // Estrai importo: stessa riga prima
    let amount = extractAmount(lines[i]);
    let foundIdx = i;

    // Se non c'è sulla riga, prova le 2 righe successive
    if (amount === null) {
      for (let j = 1; j <= 2 && i + j < lines.length; j++) {
        const nextLower = lines[i + j].toLowerCase();
        // La riga successiva non deve essere un'altra label/exclusion
        if (lineHasAny(nextLower, EXCLUDE_KEYWORDS)) break;
        amount = extractAmount(lines[i + j]);
        if (amount !== null) {
          foundIdx = i + j;
          break;
        }
      }
    }

    if (amount !== null) {
      const priority = hasTotal ? 100 : 50;
      candidates.push({ idx: foundIdx, value: amount, priority });
    }
  }

  if (candidates.length > 0) {
    // Prendi i candidati con priority massima (totale > payment)
    const maxPrio = Math.max(...candidates.map(c => c.priority));
    const top = candidates.filter(c => c.priority === maxPrio);
    // Tra questi, l'ULTIMO (i totali finali sono in fondo allo scontrino)
    const last = top[top.length - 1];
    return { total: last.value, merchant };
  }

  // ── Step 2 (fallback): numero più grande nell'ultimo terzo dello scontrino ──
  // Gli scontrini hanno il totale verso la fine. Limitiamo la ricerca lì.
  const tailStart = Math.floor(lines.length * 2 / 3);
  let biggestTail = 0;
  for (let i = tailStart; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lineHasAny(lower, EXCLUDE_KEYWORDS)) continue;
    const amt = extractAmount(lines[i]);
    if (amt !== null && amt > biggestTail) biggestTail = amt;
  }
  if (biggestTail > 0) return { total: biggestTail, merchant };

  // ── Step 3 (fallback estremo): somma di tutti i prezzi end-of-line ──
  // Per scontrini molto basic con solo voci e prezzi
  let sum = 0;
  let priceCount = 0;
  for (const line of lines) {
    const eol = line.match(/(\d+[.,]\d{2})\s*$/);
    if (eol) {
      const n = extractAmount(eol[1]);
      if (n !== null && n < 10000) {
        sum += n;
        priceCount++;
      }
    }
  }
  if (priceCount >= 2 && sum > 0) {
    return { total: Math.round(sum * 100) / 100, merchant };
  }

  return { total: null, merchant };
}

/** Main entry: scan a receipt image and return the extracted data. */
export async function scanReceipt(file: File): Promise<ReceiptResult> {
  if (!API_KEY) {
    throw new Error(
      'Scan non configurato. Aggiungi VITE_VISION_KEY alle variabili d\'ambiente.',
    );
  }
  const rawText = await ocrImage(file);
  const { total, merchant } = parseReceipt(rawText);
  const { categoryHint, descriptionHint } = detectCategory(rawText, merchant);
  return { total, rawText, merchant, categoryHint, descriptionHint };
}
