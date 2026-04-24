import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../lib/store';
import { isCategorySharedByDefault } from '../lib/sharing';
import type {
  UserProfile, BudgetCategory, FixedExpense, FinancialGoal,
} from '../types';
import { OnbShell, ChipPill } from '../components/Ui';
import {
  H, B, SERIF,
  INK, CREAM, ORANGE, GREEN, LILAC, MINT, CORAL, SAND, INK_50, INK_70,
  OFFSET,
} from '../components/tokens';

// ─── Goal mapping (UI goal → FinancialGoal interno) ──────────────────────────
type GoalId = 'serenita' | 'risparmio' | 'debito' | 'famiglia';

const GOAL_TO_FINANCIAL: Record<GoalId, FinancialGoal> = {
  serenita:  'survive',
  risparmio: 'travel',
  debito:    'emergency',
  famiglia:  'understand',
};

// ─── Categorie budget (struttura compatibile con Firestore) ──────────────────
// BASE: sempre presenti — le spese "universali" che praticamente tutti hanno.
// OPZIONALI: aggiunte via toggle nelle abitudini — dipendono dal tuo stile di vita.
interface CatDef { id: string; name: string; emoji: string; color: string; weight: number; }

const BASE_CATS: CatDef[] = [
  { id: 'groceries',  name: 'Spesa alimentare', emoji: '🛒', color: GREEN,  weight: 25 },
  { id: 'home',       name: 'Casa',             emoji: '🏠', color: LILAC,  weight: 8  },
  { id: 'transport',  name: 'Trasporti',        emoji: '🚗', color: ORANGE, weight: 10 },
  { id: 'health',     name: 'Salute',           emoji: '💊', color: MINT,   weight: 5  },
  { id: 'leisure',    name: 'Svago',            emoji: '🎭', color: SAND,   weight: 8  },
  { id: 'clothing',   name: 'Abbigliamento',    emoji: '👕', color: CORAL,  weight: 6  },
];

const HABIT_TO_CATS: Record<string, CatDef> = {
  kids:        { id: 'kids',        name: 'Figli',            emoji: '👶', color: MINT,   weight: 12 },
  pets:        { id: 'pets',        name: 'Animali',          emoji: '🐾', color: GREEN,  weight: 5  },
  sport:       { id: 'sport',       name: 'Sport',            emoji: '🏃', color: ORANGE, weight: 6  },
  restaurants: { id: 'restaurants', name: 'Ristoranti e bar', emoji: '🍽️', color: CORAL,  weight: 8  },
  travel:      { id: 'travel',      name: 'Viaggi',           emoji: '✈️', color: LILAC,  weight: 6  },
  shopping:    { id: 'shopping',    name: 'Shopping',         emoji: '🛍️', color: SAND,   weight: 6  },
  subscriptions:{ id: 'subscriptions', name: 'Abbonamenti',   emoji: '📺', color: GREEN,  weight: 4  },
  tobacco:     { id: 'tobacco',     name: 'Tabacco',          emoji: '🚬', color: ORANGE, weight: 4  },
};

interface Habit {
  id: string;
  label: string;
  color: string;
}

// Le "abitudini" sono domande yes/no: tutte neutre, senza giudizio.
// Chi spunta una voce, vede comparire la categoria corrispondente nel budget.
const HABITS: Habit[] = [
  { id: 'kids',          label: 'Figli',              color: MINT   },
  { id: 'pets',          label: 'Animali',            color: GREEN  },
  { id: 'sport',         label: 'Sport / palestra',   color: ORANGE },
  { id: 'restaurants',   label: 'Ristoranti e bar',   color: CORAL  },
  { id: 'travel',        label: 'Viaggi',             color: LILAC  },
  { id: 'shopping',      label: 'Shopping',           color: SAND   },
  { id: 'subscriptions', label: 'Abbonamenti',        color: GREEN  },
  { id: 'tobacco',       label: 'Tabacco',            color: ORANGE },
];

interface FixedItem {
  id: string;
  label: string;
  color: string;
}

const FIXED_ITEMS: FixedItem[] = [
  { id: 'affitto',     label: 'Affitto / mutuo', color: ORANGE },
  { id: 'bollette',    label: 'Bollette',        color: LILAC  },
  { id: 'abbonamenti', label: 'Abbonamenti',     color: MINT   },
  { id: 'trasporti',   label: 'Trasporti',       color: GREEN  },
  { id: 'altro',       label: 'Altro fisso',     color: SAND   },
];

function computePercentages(cats: CatDef[]): Record<string, number> {
  const total = cats.reduce((s, c) => s + c.weight, 0);
  if (total === 0) return {};
  const result: Record<string, number> = {};
  let assigned = 0;
  cats.forEach((c, i) => {
    const isLast = i === cats.length - 1;
    const pct = isLast ? 100 - assigned : Math.round((c.weight / total) * 100);
    result[c.id] = pct;
    assigned += pct;
  });
  return result;
}

// ─── Component ──────────────────────────────────────────────────────────────
type StepId = 'intro' | 'income' | 'fixed' | 'lifestyle' | 'savings';

export default function OnboardingPage() {
  const { user, profile, setProfile } = useStore();
  const navigate = useNavigate();

  // Partner: chi è già in un gruppo famiglia creato da altri.
  // Per lui saltiamo intro (è già stato invitato) e gli step famiglia (eredita).
  const isPartner = !!profile?.familyId && profile.familyId !== user?.uid;

  const STEP_ORDER: StepId[] = isPartner
    ? ['income']
    : ['intro', 'income', 'fixed', 'lifestyle', 'savings'];
  const ONB_TOTAL = STEP_ORDER.length;

  const [step, setStep] = useState<StepId>(STEP_ORDER[0]);

  // Goal — default non mostrato, settato tecnicamente per compat con schema.
  const [goal] = useState<GoalId>('serenita');

  // Income — vuoto di default (niente nudging numerico)
  const [income, setIncome] = useState<string>('');

  // Fixed expenses — tutti vuoti di default
  const [fixed, setFixed] = useState<Record<string, string>>({
    affitto: '', bollette: '', abbonamenti: '', trasporti: '', altro: '',
  });

  // Lifestyle habits — nessuna preselezione
  const [habits, setHabits] = useState<string[]>([]);

  // Savings % — default 10% (equilibrato)
  const [pct, setPct] = useState(10);

  const [saving, setSaving] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.onboardingComplete) return <Navigate to="/dashboard" replace />;

  // ─── Derived ──────────────────────────────────────────────────────────────
  const incomeNum = Number(income) || 0;
  const fixedTotal = Object.values(fixed).reduce((s, v) => s + Number(v || 0), 0);
  const savingsTarget = Math.round(incomeNum * pct / 100);

  const stepIndex = STEP_ORDER.indexOf(step);

  const goNext = () => {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  };

  // ─── Save to Firestore ────────────────────────────────────────────────────
  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);

    const freeAmount = Math.max(0, incomeNum - fixedTotal - savingsTarget);

    // Build categories from base + selected habits
    const activeCats: CatDef[] = [
      ...BASE_CATS,
      ...habits.map(h => HABIT_TO_CATS[h]).filter(Boolean),
    ];
    const percentages = computePercentages(activeCats);

    const categories: BudgetCategory[] = activeCats.map(cat => ({
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji,
      color: cat.color,
      percentage: percentages[cat.id] ?? 0,
      budget: Math.round(freeAmount * (percentages[cat.id] ?? 0) / 100),
      shared: isCategorySharedByDefault(cat.name),
    }));

    // Build fixed expenses (tutte shared di default)
    const fixedExpenses: FixedExpense[] = FIXED_ITEMS
      .filter(it => Number(fixed[it.id]) > 0)
      .map(it => ({
        id: it.id,
        name: it.label,
        amount: Number(fixed[it.id]) || 0,
        shared: true,
      }));

    if (savingsTarget > 0) {
      fixedExpenses.push({
        id: 'savings',
        name: '💰 Risparmio mensile',
        amount: savingsTarget,
        shared: true,
      });
    }

    // Se l'utente era già in un gruppo famiglia (es. ha cliccato un link di invito
    // e si è unito prima dell'onboarding), PRESERVA familyId e familyMembers.
    // Solo se è "nuovo": crea un gruppo con se stesso.
    const existingFamilyId = profile?.familyId;
    const existingMembers = profile?.familyMembers;

    const savedProfile: UserProfile = {
      goal: GOAL_TO_FINANCIAL[goal],
      income: incomeNum,
      fixedExpenses,
      categories,
      onboardingComplete: true,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
      familyId: existingFamilyId ?? user.uid,
      familyMembers: existingMembers ?? [{
        uid: user.uid,
        name: user.displayName ?? 'Tu',
        color: ORANGE,
      }],
    };

    setProfile(savedProfile);
    try {
      await setDoc(doc(db, 'users', user.uid), savedProfile);
    } catch (err) {
      console.error('Firestore sync failed:', err);
    }
    navigate('/dashboard');
  };

  // ─── Renders per step ────────────────────────────────────────────────────

  if (step === 'intro') {
    const introCards = [
      { emoji: '📥', title: 'Il tuo reddito', text: 'Quanto entra ogni mese. Ci serve per capire cosa puoi spendere.', color: MINT },
      { emoji: '🏠', title: 'Le spese fisse', text: 'Mutuo, bollette, abbonamenti: cose che escono senza chiedere.', color: LILAC },
      { emoji: '⚖️', title: 'Il bilico', text: 'Quello che resta si divide per categorie, con un tesoretto da parte.', color: ORANGE },
    ];
    return (
      <OnbShell
        step={0}
        total={ONB_TOTAL}
        title={<>Prima di chiederti<br /><span style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, color: CORAL, fontSize: 34 }}>i numeri</span></>}
        subtitle="Novanta secondi. Tre semplici concetti, poi via."
        onNext={goNext}
        nextLabel="Iniziamo"
      >
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          {introCards.map((c, i) => (
            <div key={c.title} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: CREAM,
              border: `2.5px solid ${INK}`,
              borderRadius: 18,
              padding: '14px 16px',
              boxShadow: OFFSET(),
              position: 'relative',
            }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: c.color,
                border: `2px solid ${INK}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}>{c.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  ...H,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: INK_50,
                  fontWeight: 700,
                }}>
                  Step {i + 1}
                </div>
                <div style={{
                  ...H,
                  fontWeight: 800,
                  fontSize: 15,
                  color: INK,
                  letterSpacing: '-0.3px',
                  marginTop: 1,
                }}>
                  {c.title}
                </div>
                <div style={{
                  ...B,
                  fontSize: 12,
                  color: INK_70,
                  marginTop: 2,
                  lineHeight: 1.35,
                }}>
                  {c.text}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p style={{
          ...SERIF,
          fontStyle: 'italic',
          fontSize: 14,
          color: INK_50,
          textAlign: 'center',
          margin: '18px 0 0',
          lineHeight: 1.4,
        }}>
          I tuoi numeri restano sul tuo dispositivo e sul tuo Firebase personale.
        </p>
      </OnbShell>
    );
  }

  if (step === 'income') {
    const presets = [
      { label: '1.200', v: '1200' },
      { label: '1.800', v: '1800' },
      { label: '2.400', v: '2400' },
      { label: '3.000', v: '3000' },
      { label: 'Variabile', v: '0' },
    ];
    return (
      <OnbShell
        step={STEP_ORDER.indexOf('income')}
        total={ONB_TOTAL}
        title={<>{isPartner ? <>Il tuo<br /></> : <>Quanto entra,<br /></>}<span style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, color: CORAL, fontSize: 34 }}>{isPartner ? 'reddito personale' : 'in media?'}</span></>}
        subtitle={isPartner
          ? 'Ci serve solo il tuo. Il resto l\'ha già impostato chi ti ha invitato.'
          : 'Stipendio, partita IVA, pensione — tutto ciò che arriva ogni mese.'}
        onBack={STEP_ORDER.indexOf('income') > 0 ? goBack : undefined}
        onNext={isPartner ? handleComplete : goNext}
        nextLabel={isPartner ? 'Entra in Bilico' : 'Continua'}
        saving={saving}
      >
        <div style={{
          background: CREAM,
          border: `2.5px solid ${INK}`,
          borderRadius: 22,
          padding: '26px 20px',
          boxShadow: OFFSET(),
          marginTop: 8,
        }}>
          <div style={{
            ...H,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: INK_50,
            fontWeight: 700,
          }}>Reddito mensile netto</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <input
              value={income}
              onChange={e => setIncome(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              style={{
                ...H,
                fontWeight: 800,
                fontSize: 56,
                color: INK,
                letterSpacing: '-2px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '70%',
                padding: 0,
              }}
            />
            <span style={{ ...SERIF, fontStyle: 'italic', fontSize: 34, color: CORAL }}>€</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {presets.map(p => (
              <ChipPill
                key={p.label}
                active={income === p.v}
                color={MINT}
                onClick={() => setIncome(p.v)}
              >
                {p.label} {p.label !== 'Variabile' ? '€' : ''}
              </ChipPill>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div aria-hidden style={{
            width: 36, height: 36, borderRadius: 9,
            background: LILAC, border: `2px solid ${INK}`,
            transform: 'rotate(-8deg)',
          }} />
          <p style={{ ...B, fontSize: 13, color: 'rgba(14,14,14,0.72)', margin: 0, lineHeight: 1.4 }}>
            Tranquillə: resta sul tuo telefono.<br />Bilico non condivide mai i tuoi numeri.
          </p>
        </div>
      </OnbShell>
    );
  }

  if (step === 'fixed') {
    return (
      <OnbShell
        step={STEP_ORDER.indexOf('fixed')}
        total={ONB_TOTAL}
        title={<>Cosa esce<br /><span style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, color: CORAL, fontSize: 34 }}>senza chiedere?</span></>}
        subtitle="Le spese ricorrenti. Anche stime vanno benissimo."
        onBack={goBack}
        onNext={goNext}
      >
        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          {FIXED_ITEMS.map(it => (
            <div key={it.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: CREAM,
              border: `2px solid ${INK}`,
              borderRadius: 14,
              padding: '10px 14px',
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: it.color,
                border: `2px solid ${INK}`,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, ...H, fontWeight: 600, fontSize: 14, color: INK }}>{it.label}</div>
              <input
                value={fixed[it.id]}
                onChange={e => setFixed({ ...fixed, [it.id]: e.target.value.replace(/[^0-9]/g, '') })}
                inputMode="numeric"
                style={{
                  ...H,
                  fontWeight: 700,
                  fontSize: 18,
                  color: INK,
                  width: 70,
                  textAlign: 'right',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                }}
              />
              <span style={{ ...SERIF, fontStyle: 'italic', fontSize: 18, color: CORAL }}>€</span>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 16,
          background: INK,
          color: CREAM,
          borderRadius: 18,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: OFFSET(),
        }}>
          <span style={{
            ...H,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 1,
            textTransform: 'uppercase',
            opacity: 0.7,
          }}>Totale fisse</span>
          <span style={{
            ...H,
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: '-0.5px',
          }}>{fixedTotal.toLocaleString('it-IT')} €</span>
        </div>
      </OnbShell>
    );
  }

  if (step === 'lifestyle') {
    const toggle = (id: string) =>
      setHabits(habits.includes(id) ? habits.filter(h => h !== id) : [...habits, id]);

    const profile = habits.length === 0
      ? 'Sobrio come un lunedì mattina.'
      : habits.length <= 2
        ? 'Misurato, con qualche concessione.'
        : habits.length <= 4
          ? 'Vivi, non sopravvivi.'
          : 'Una vita piena — e Bilico ti tiene il conto.';

    return (
      <OnbShell
        step={STEP_ORDER.indexOf('lifestyle')}
        total={ONB_TOTAL}
        title={<>Le abitudini<br /><span style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, color: CORAL, fontSize: 34 }}>che pesano.</span></>}
        subtitle="Scegli quelle che vuoi tenere d'occhio. Senza giudizio."
        onBack={goBack}
        onNext={goNext}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {HABITS.map(h => (
            <ChipPill
              key={h.id}
              active={habits.includes(h.id)}
              color={h.color}
              onClick={() => toggle(h.id)}
            >
              {h.label}
            </ChipPill>
          ))}
        </div>
        <div style={{
          marginTop: 22,
          background: CREAM,
          border: `2.5px solid ${INK}`,
          borderRadius: 20,
          padding: 18,
          boxShadow: OFFSET(),
        }}>
          <div style={{
            ...H,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: INK_50,
            fontWeight: 700,
          }}>Il tuo profilo</div>
          <p style={{
            ...SERIF,
            fontStyle: 'italic',
            fontSize: 22,
            color: INK,
            margin: '6px 0 0',
            lineHeight: 1.25,
          }}>{profile}</p>
        </div>
      </OnbShell>
    );
  }

  // step === 'savings'
  const savingsTagline = pct < 5
    ? 'Un passo alla volta — va bene così.'
    : pct < 15
      ? 'Piccolo ma costante: il modo più onesto di iniziare.'
      : pct < 25
        ? 'Un ritmo sano, senza stringere la cintura.'
        : 'Ambiziosə. Bilico ti ricorderà di godertela lo stesso.';

  return (
    <OnbShell
      step={STEP_ORDER.indexOf('savings')}
      total={ONB_TOTAL}
      title={<>E il <span style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, color: CORAL, fontSize: 34 }}>tesoretto?</span></>}
      subtitle="Quanto vuoi mettere da parte ogni mese, a occhio?"
      onBack={goBack}
      onNext={handleComplete}
      nextLabel="Entra in Bilico"
      saving={saving}
    >
      <div style={{
        background: CREAM,
        border: `2.5px solid ${INK}`,
        borderRadius: 22,
        padding: '22px 20px',
        boxShadow: OFFSET(),
        marginTop: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              ...H,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: INK_50,
              fontWeight: 700,
            }}>Obiettivo mensile</div>
            <div style={{
              ...H,
              fontWeight: 800,
              fontSize: 44,
              color: INK,
              letterSpacing: '-1.5px',
              marginTop: 2,
            }}>
              {savingsTarget}{' '}
              <span style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, color: CORAL, fontSize: 36 }}>€</span>
            </div>
          </div>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: GREEN,
            border: `2.5px solid ${INK}`,
            boxShadow: OFFSET(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...H,
            fontWeight: 800,
            fontSize: 20,
            color: CREAM,
          }}>{pct}%</div>
        </div>
        <input
          type="range"
          min="0"
          max="40"
          value={pct}
          onChange={e => setPct(Number(e.target.value))}
          style={{ width: '100%', marginTop: 18, accentColor: INK }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          ...B,
          fontSize: 11,
          color: INK_50,
          marginTop: 4,
        }}>
          <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>40%</span>
        </div>
      </div>
      <p style={{
        ...SERIF,
        fontStyle: 'italic',
        fontSize: 18,
        color: INK,
        margin: '18px 0 0',
        lineHeight: 1.3,
        textAlign: 'center',
      }}>
        {savingsTagline}
      </p>
    </OnbShell>
  );
}
