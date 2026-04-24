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

/** Call Google Cloud Vision TEXT_DETECTION on an image file. */
async function ocrImage(file: File): Promise<string> {
  const base64 = await fileToBase64(file);

  const body = {
    requests: [{
      image: { content: base64 },
      features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
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
  const annotations = data.responses?.[0]?.textAnnotations;
  return annotations?.[0]?.description ?? '';
}

/**
 * Parse the OCR text from an Italian receipt to extract the total.
 * Looks for patterns like "TOTALE  12,50" or "TOTALE EURO  8.90" etc.
 */
function parseReceipt(text: string): { total: number | null; merchant: string | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Extract merchant: usually the first non-empty line ──
  const merchant = lines[0] ?? null;

  // ── Extract total ──
  // Try patterns from most specific to least specific
  const patterns = [
    // "TOTALE EURO 12,50" or "TOTALE EUR 12.50"
    /totale\s*(?:euro?|eur)\s*[€]?\s*(\d+[.,]\d{2})/i,
    // "TOTALE  € 12,50" or "TOTALE €12.50"
    /totale\s*[€]\s*(\d+[.,]\d{2})/i,
    // "TOTALE  12,50"
    /totale\s+(\d+[.,]\d{2})/i,
    // "TOTALE COMPLESSIVO  12,50"
    /totale\s+complessivo\s*[€]?\s*(\d+[.,]\d{2})/i,
    // "TOTAL  12.50" (English receipts)
    /total\s*[€]?\s*(\d+[.,]\d{2})/i,
    // "DA PAGARE  12,50"
    /da\s*pagare\s*[€]?\s*(\d+[.,]\d{2})/i,
    // "IMPORTO  12,50"
    /importo\s*[€]?\s*(\d+[.,]\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (num > 0 && num < 100000) return { total: num, merchant };
    }
  }

  // Fallback 1: find the largest number that looks like a price on lines with "€"
  let maxAmount = 0;
  for (const line of lines) {
    if (/€/.test(line) || /eur/i.test(line)) {
      const amounts = line.match(/(\d+[.,]\d{2})/g);
      if (amounts) {
        for (const a of amounts) {
          const n = parseFloat(a.replace(',', '.'));
          if (n > maxAmount && n < 100000) maxAmount = n;
        }
      }
    }
  }

  if (maxAmount > 0) return { total: maxAmount, merchant };

  // Fallback 2: sum all prices found (for receipts without a total line)
  let sum = 0;
  let priceCount = 0;
  for (const line of lines) {
    const amounts = line.match(/(\d+)[.,](\d{2})\s*$/);
    if (amounts) {
      const n = parseFloat(amounts[1] + '.' + amounts[2]);
      if (n > 0 && n < 10000) {
        sum += n;
        priceCount++;
      }
    }
  }

  if (priceCount >= 2 && sum > 0) return { total: Math.round(sum * 100) / 100, merchant };

  // Fallback 3: find the single largest price anywhere
  let biggest = 0;
  for (const line of lines) {
    const allPrices = line.match(/(\d+)[.,](\d{2})/g);
    if (allPrices) {
      for (const p of allPrices) {
        const n = parseFloat(p.replace(',', '.'));
        if (n > biggest && n < 100000) biggest = n;
      }
    }
  }

  return { total: biggest > 0 ? biggest : null, merchant };
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
