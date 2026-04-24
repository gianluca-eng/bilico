import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useStore } from '../lib/store';
import { useTransactions } from '../hooks/useTransactions';
import { useRecurring } from '../hooks/useRecurring';
import { useBadges } from '../hooks/useBadges';
import { scanReceipt } from '../lib/vision';
import type { Transaction } from '../types';
import { BalanceScale } from '../components/BalanceScale';
import { BigButton, ChipPill, Panel, IconBtn, CloseX, useEscapeKey } from '../components/Ui';
import { Trofei, BadgeToast } from '../components/Trofei';
import {
  H, B, SERIF,
  INK, CREAM, SAND, ORANGE, GREEN, LILAC, MINT, CORAL, INK_50, INK_70,
  OFFSET, OFFSET_SM, fmtN,
} from '../components/tokens';

// ─── Helpers ────────────────────────────────────────────────────────────────
const MONTH_LABEL_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const currentYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const prevYM = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const nextYM = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const ymLabel = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  const thisYear = new Date().getFullYear();
  const monthName = MONTH_LABEL_IT[m - 1];
  return y === thisYear ? monthName : `${monthName} ${y}`;
};

const initials = (name: string | null) =>
  (name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase();

const palette = [ORANGE, CORAL, MINT, LILAC, GREEN, SAND];
const colorFor = (key: string) => {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
};

const parseCategoryField = (field: string): { emoji: string; name: string } => {
  const parts = field.split(' ');
  const first = parts[0] ?? '';
  const hasLetter = /[A-Za-z]/.test(first);
  if (!hasLetter && parts.length > 1) {
    return { emoji: first, name: parts.slice(1).join(' ') };
  }
  return { emoji: '💸', name: field };
};

const timeLabel = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `oggi, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getDate()} ${MONTH_LABEL_IT[d.getMonth()].slice(0, 3).toLowerCase()}`;
};

// ─── Bottom Nav ─────────────────────────────────────────────────────────────
interface NavDotProps {
  active?: boolean;
  label: string;
  onClick?: () => void;
}

// ─── FilterChip per filtro membri in Storico ───────────────────────────────
interface FilterChipProps {
  active: boolean;
  label: string;
  onClick: () => void;
  color?: string;
}

function FilterChip({ active, label, onClick, color }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        ...H,
        padding: '7px 12px',
        borderRadius: 99,
        border: `2px solid ${INK}`,
        background: active ? (color ?? INK) : CREAM,
        color: active ? CREAM : INK,
        fontWeight: 700,
        fontSize: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: active ? OFFSET_SM() : 'none',
        transform: active ? 'translate(-1px,-1px)' : 'none',
        transition: 'transform 80ms ease',
      }}
    >
      {color && !active && (
        <span style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          border: `1.5px solid ${INK}`,
          flexShrink: 0,
        }} />
      )}
      {label}
    </button>
  );
}

function NavDot({ active, label, onClick }: NavDotProps) {
  return (
    <button
      onClick={onClick}
      style={{
        ...H,
        padding: '8px 14px',
        borderRadius: 99,
        border: 'none',
        background: active ? INK : 'transparent',
        color: active ? CREAM : INK,
        fontWeight: 700,
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ─── Tx list ────────────────────────────────────────────────────────────────
interface TxListProps {
  tx: Transaction[];
  onEdit?: (tx: Transaction) => void;
}

function TxList({ tx, onEdit }: TxListProps) {
  const { familyMembers, user } = useStore();

  // Indice uid → membro
  const memberByUid: Record<string, { name: string; color: string; isMe: boolean }> = {};
  for (const m of familyMembers) {
    memberByUid[m.uid] = {
      name: m.name,
      color: m.color,
      isMe: m.uid === user?.uid,
    };
  }

  if (tx.length === 0) {
    return (
      <div style={{
        background: CREAM,
        border: `2px dashed ${INK}`,
        borderRadius: 14,
        padding: '22px 14px',
        textAlign: 'center',
        ...B,
        fontSize: 13,
        color: INK_50,
      }}>
        Nessun movimento ancora. Premi <strong style={{ color: INK }}>+</strong> per cominciare.
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {tx.map(t => {
        const cat = parseCategoryField(t.category);
        const merchant = t.description?.trim() || cat.name;
        const amtSigned = t.type === 'expense' ? -t.amount : t.amount;
        const color = colorFor(cat.name);
        const member = memberByUid[t.userId];
        const authorInitial = member
          ? member.name.charAt(0).toUpperCase()
          : null;
        const authorName = member
          ? (member.isMe ? 'Tu' : member.name.split(' ')[0])
          : null;
        const inFamily = familyMembers.length > 1;
        const showAuthorBadge = inFamily && !!member && !member.isMe;
        const canEdit = !!onEdit && (!member || member.isMe); // solo se è tua
        const isTemplate = !!t.recurring;
        const isFromTemplate = !!t.sourceRecurringId;
        // Se la tx è privata di UN ALTRO membro: oscura i dettagli (cosa/dove).
        const obscured = t.isPrivate && !!member && !member.isMe;
        const displayMerchant = obscured ? 'Spesa riservata' : merchant;
        const displayEmoji = obscured ? '🔒' : cat.emoji;
        const displayCategory = obscured ? '' : cat.name;
        return (
          <button
            key={t.id}
            onClick={canEdit ? () => onEdit!(t) : undefined}
            disabled={!canEdit}
            style={{
              ...H,
              textAlign: 'left',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: CREAM,
              border: `2px solid ${INK}`,
              borderRadius: 14,
              padding: '10px 14px',
              cursor: canEdit ? 'pointer' : 'default',
              font: 'inherit',
              transition: 'transform 80ms ease',
            }}
            onMouseDown={canEdit ? (e) => (e.currentTarget.style.transform = 'translate(1px,1px)') : undefined}
            onMouseUp={canEdit ? (e) => (e.currentTarget.style.transform = 'none') : undefined}
            onMouseLeave={canEdit ? (e) => (e.currentTarget.style.transform = 'none') : undefined}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: obscured ? INK + '18' : color,
              border: `2px solid ${INK}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
              position: 'relative',
            }}>
              {displayEmoji}
              {/* Mini avatar dell'autore in basso a destra */}
              {showAuthorBadge && member && (
                <div
                  title={`Pagato da ${member.name}`}
                  style={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: member.color,
                    border: `2px solid ${INK}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...H,
                    fontWeight: 800,
                    fontSize: 9,
                    color: CREAM,
                    lineHeight: 1,
                  }}
                >
                  {authorInitial}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                ...H,
                fontWeight: 700,
                fontSize: 14,
                color: obscured ? INK_50 : INK,
                fontStyle: obscured ? 'italic' : 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>{displayMerchant}</div>
              <div style={{
                ...B, fontSize: 11, color: INK_50,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {displayCategory && <>{displayCategory} · </>}
                {inFamily && authorName && <><strong style={{ color: INK_70, fontWeight: 600 }}>{authorName}</strong> · </>}
                {timeLabel(t.createdAt)}
                {(isTemplate || isFromTemplate) && (
                  <span
                    title={isTemplate ? 'Spesa ricorrente (template)' : 'Generata automaticamente'}
                    style={{ fontSize: 10, marginLeft: 2 }}
                  >🔄</span>
                )}
                {t.isPrivate && (
                  <span title={obscured ? 'Riservata dall\'autore' : 'Privata — solo tu la vedi'}
                    style={{ fontSize: 10, marginLeft: 2 }}>🔒</span>
                )}
              </div>
            </div>
            <div style={{
              ...H,
              fontWeight: 800,
              fontSize: 15,
              color: amtSigned < 0 ? INK : GREEN,
            }}>
              {amtSigned < 0 ? '−' : '+'}{Math.abs(amtSigned).toFixed(2)} €
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Obiettivi tab ──────────────────────────────────────────────────────────
interface ObiettiviTabProps {
  ym: string;
  badges: import('../hooks/useBadges').UnlockedBadge[];
}

function ObiettiviTab({ ym, badges }: ObiettiviTabProps) {
  const { profile, transactions, familyMembers, user } = useStore();

  const savingsItem = profile?.fixedExpenses.find(f => f.id === 'savings');
  const savingsTarget = savingsItem?.amount ?? 0;

  const freeBudget = useMemo(() => {
    const inc = profile?.income ?? 0;
    const fixed = (profile?.fixedExpenses ?? []).reduce((s, f) => s + f.amount, 0);
    return Math.max(0, inc - fixed);
  }, [profile]);

  const monthTxs = useMemo(
    () => transactions.filter(t =>
      t.type === 'expense' &&
      t.date.startsWith(ym) &&
      // Escludi private di altri: non voglio rivelare l'importo per categoria
      !(t.isPrivate && t.userId !== user?.uid)
    ),
    [transactions, ym, user],
  );

  const spentThisMonth = useMemo(
    () => monthTxs.reduce((s, t) => s + t.amount, 0),
    [monthTxs],
  );

  // Helper: estrae il nome "pulito" della categoria
  const stripEmoji = (cat: string) => {
    const parts = cat.split(' ');
    const hasEmoji = parts.length > 1 && !/[A-Za-z]/.test(parts[0] ?? '');
    return (hasEmoji ? parts.slice(1).join(' ') : cat).trim();
  };

  // Spesa per categoria
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of monthTxs) {
      const name = stripEmoji(tx.category);
      map[name] = (map[name] ?? 0) + tx.amount;
    }
    return map;
  }, [monthTxs]);

  // Spesa per categoria spezzata per membro
  const spentByCategoryByMember = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const tx of monthTxs) {
      const name = stripEmoji(tx.category);
      if (!map[name]) map[name] = {};
      map[name][tx.userId] = (map[name][tx.userId] ?? 0) + tx.amount;
    }
    return map;
  }, [monthTxs]);

  // Indice membri per colore/iniziali
  const memberByUid: Record<string, { name: string; color: string; isMe: boolean }> = {};
  for (const m of familyMembers) {
    memberByUid[m.uid] = { name: m.name, color: m.color, isMe: m.uid === user?.uid };
  }
  const showMemberSplit = familyMembers.length > 1;

  const categories = (profile?.categories ?? []).map(c => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
    budget: c.budget,
    percentage: c.percentage,
    spent: spentByCategory[c.name] ?? 0,
  }));

  const statusColor = (spent: number, max: number) => {
    if (max <= 0) return INK_50;
    const p = spent / max;
    if (p > 1) return CORAL;
    if (p >= 0.8) return ORANGE;
    return GREEN;
  };

  const savedEstimate = Math.max(0, freeBudget - spentThisMonth);

  const longGoals: Array<{ label: string; cur: number; tgt: number; color: string }> = [];
  if (savingsTarget > 0) {
    longGoals.push({
      label: 'Tesoretto del mese',
      cur: Math.min(savingsTarget, savedEstimate),
      tgt: savingsTarget,
      color: GREEN,
    });
  }
  longGoals.push({ label: 'Fondo emergenza', cur: 0, tgt: 3000, color: MINT });
  longGoals.push({ label: 'Prossimo viaggio', cur: 0, tgt: 1500, color: LILAC });

  return (
    <div style={{ display: 'grid', gap: 18, marginTop: 4 }}>
      {/* ─── Budget per categoria ─── */}
      <div>
        <div style={{
          ...H,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: INK_50,
          fontWeight: 700,
          marginBottom: 10,
        }}>Budget per categoria</div>

        {categories.length === 0 ? (
          <div style={{
            background: CREAM,
            border: `2px dashed ${INK}`,
            borderRadius: 14,
            padding: '22px 14px',
            textAlign: 'center',
            ...B,
            fontSize: 13,
            color: INK_50,
          }}>
            Imposta le categorie nell'onboarding per vedere l'avanzamento qui.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {categories.map(cat => {
              const sc = statusColor(cat.spent, cat.budget);
              const pct = cat.budget > 0 ? Math.min(100, Math.round(cat.spent / cat.budget * 100)) : 0;
              const over = cat.budget > 0 && cat.spent > cat.budget;
              return (
                <div
                  key={cat.id}
                  style={{
                    background: CREAM,
                    border: `2.5px solid ${INK}`,
                    borderRadius: 16,
                    padding: 14,
                    boxShadow: OFFSET(),
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 8,
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: cat.color,
                      border: `2px solid ${INK}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                    }}>{cat.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        ...H,
                        fontWeight: 700,
                        fontSize: 15,
                        color: INK,
                      }}>{cat.name}</div>
                      <div style={{ ...B, fontSize: 11, color: INK_50 }}>
                        {cat.percentage}% del budget libero
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...H, fontWeight: 800, fontSize: 16, color: sc }}>
                        {fmtN(cat.spent)}
                      </div>
                      <div style={{ ...B, fontSize: 11, color: INK_50 }}>
                        / {fmtN(cat.budget)}
                      </div>
                    </div>
                  </div>
                  {/* Barra avanzamento */}
                  <div style={{
                    height: 12,
                    background: CREAM,
                    border: `2px solid ${INK}`,
                    borderRadius: 99,
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: sc,
                      borderRight: pct < 100 ? `2px solid ${INK}` : 'none',
                      transition: 'width 300ms ease',
                    }} />
                  </div>

                  {/* Split per membro della famiglia */}
                  {showMemberSplit && cat.spent > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 8,
                    }}>
                      {Object.entries(spentByCategoryByMember[cat.name] ?? {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([uid, amt]) => {
                          const member = memberByUid[uid];
                          const memberName = member?.name ?? 'Anonimo';
                          const memberColor = member?.color ?? INK_50;
                          const initial = memberName.charAt(0).toUpperCase();
                          return (
                            <div key={uid} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              background: CREAM,
                              border: `2px solid ${INK}`,
                              borderRadius: 99,
                              padding: '3px 10px 3px 3px',
                            }}>
                              <div style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: memberColor,
                                border: `1.5px solid ${INK}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                ...H,
                                fontWeight: 800,
                                fontSize: 9,
                                color: CREAM,
                                lineHeight: 1,
                              }}>
                                {initial}
                              </div>
                              <span style={{
                                ...B,
                                fontSize: 12,
                                color: INK,
                                fontWeight: 600,
                              }}>
                                {member?.isMe ? 'Tu' : memberName.split(' ')[0]}: {fmtN(amt)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {over && (
                    <div style={{
                      ...SERIF,
                      fontStyle: 'italic',
                      fontSize: 13,
                      color: CORAL,
                      marginTop: 6,
                    }}>
                      Sforato di {fmtN(cat.spent - cat.budget)}.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Obiettivi a lungo termine ─── */}
      <div>
        <div style={{
          ...H,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: INK_50,
          fontWeight: 700,
          marginBottom: 10,
        }}>Obiettivi di risparmio</div>

        <div style={{ display: 'grid', gap: 10 }}>
          {longGoals.map(g => {
            const pct = g.tgt > 0 ? Math.min(100, Math.round(g.cur / g.tgt * 100)) : 0;
            return (
              <div key={g.label} style={{
                background: CREAM,
                border: `2.5px solid ${INK}`,
                borderRadius: 18,
                padding: 14,
                boxShadow: OFFSET(),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ ...H, fontWeight: 700, fontSize: 15, color: INK }}>{g.label}</div>
                  <div style={{ ...H, fontWeight: 800, fontSize: 13, color: INK_50 }}>{pct}%</div>
                </div>
                <div style={{
                  height: 14,
                  background: CREAM,
                  border: `2px solid ${INK}`,
                  borderRadius: 99,
                  marginTop: 8,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: g.color,
                    borderRight: pct < 100 ? `2px solid ${INK}` : 'none',
                  }} />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 6,
                  ...B,
                  fontSize: 12,
                  color: INK_70,
                }}>
                  <span>{Math.round(g.cur)} € messi</span>
                  <span>/ {g.tgt} €</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Trofei (badge) ─── */}
      <Trofei badges={badges} />
    </div>
  );
}

// ─── Add / Edit Expense Modal ───────────────────────────────────────────────
interface AddModalProps {
  onClose: () => void;
  categories: Array<{ id: string; name: string; emoji: string; color: string }>;
  onAdd: (tx: {
    description: string;
    amount: number;
    category: string;
    emoji: string;
    isPrivate: boolean;
    isRecurring: boolean;
    recurringEndDate?: string;
  }) => void;
  onScan: () => void;
  initialAmount?: string;
  initialDesc?: string;
  initialCategory?: string;
  initialIsPrivate?: boolean;
  initialIsRecurring?: boolean;
  initialRecurringEndDate?: string;
  /** Se valorizzata, il modale è in modalità "edit" */
  editingId?: string;
  /** Se true: questa transazione è stata generata da un template (nessun toggle ricorrente). */
  isGeneratedClone?: boolean;
  onDelete?: () => void;
  /** Se true: sei in un gruppo famiglia (mostra toggle privata) */
  showPrivacyToggle?: boolean;
}

function AddExpenseModal({
  onClose, categories, onAdd, onScan,
  initialAmount, initialDesc, initialCategory, initialIsPrivate,
  initialIsRecurring, initialRecurringEndDate,
  editingId, isGeneratedClone = false, onDelete, showPrivacyToggle = false,
}: AddModalProps) {
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [description, setDesc] = useState(initialDesc ?? '');
  const [categoryId, setCategoryId] = useState(
    (initialCategory && categories.find(c => c.name === initialCategory)?.id) ??
    categories[0]?.id ?? ''
  );
  const [isPrivate, setIsPrivate] = useState<boolean>(initialIsPrivate ?? false);
  const [isRecurring, setIsRecurring] = useState<boolean>(initialIsRecurring ?? false);
  const [recurringEndDate, setRecurringEndDate] = useState<string>(initialRecurringEndDate ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEscapeKey(onClose);

  const selectedCat = categories.find(c => c.id === categoryId);
  const valid = parseFloat(amount.replace(',', '.')) > 0;
  const isEditing = !!editingId;

  const handleSubmit = () => {
    if (!valid || !selectedCat) return;
    onAdd({
      description: description.trim() || selectedCat.name,
      amount: parseFloat(amount.replace(',', '.')),
      category: selectedCat.name,
      emoji: selectedCat.emoji,
      isPrivate,
      isRecurring,
      recurringEndDate: isRecurring && recurringEndDate ? recurringEndDate : undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete?.();
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14,14,14,0.4)',
        zIndex: 100, backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 420,
        background: CREAM,
        borderRadius: '26px 26px 0 0',
        border: `2.5px solid ${INK}`,
        borderBottom: 'none',
        padding: '16px 22px calc(26px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        zIndex: 110,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}>
          <div style={{ ...H, fontWeight: 800, fontSize: 18, color: INK }}>
            {isEditing ? 'Modifica spesa' : 'Nuova spesa'}
          </div>
          <IconBtn onClick={onClose} ariaLabel="Chiudi"><CloseX /></IconBtn>
        </div>

        {!isEditing && (
          <button
            onClick={() => { onClose(); onScan(); }}
            style={{
              ...B,
              width: '100%',
              padding: '11px 16px',
              borderRadius: 99,
              marginBottom: 14,
              border: `2px solid ${INK}`,
              background: LILAC,
              color: INK,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: OFFSET_SM(),
            }}
          >
            <span style={{ fontSize: 16 }}>📸</span>
            Scansiona scontrino
            <span style={{
              ...H,
              fontSize: 9,
              fontWeight: 800,
              background: INK,
              color: CREAM,
              padding: '2px 6px',
              borderRadius: 6,
              letterSpacing: '0.5px',
            }}>PRO</span>
          </button>
        )}

        <div style={{
          background: CREAM,
          border: `2.5px solid ${INK}`,
          borderRadius: 20,
          padding: '20px 16px',
          boxShadow: OFFSET(),
        }}>
          <div style={{
            ...H,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: INK_50,
            fontWeight: 700,
          }}>Importo</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ ...H, fontWeight: 800, fontSize: 54, color: INK, letterSpacing: '-1.5px' }}>−</span>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              autoFocus
              style={{
                ...H,
                fontWeight: 800,
                fontSize: 54,
                color: INK,
                letterSpacing: '-1.5px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '60%',
                padding: 0,
              }}
            />
            <span style={{ ...SERIF, fontStyle: 'italic', fontSize: 36, color: CORAL }}>€</span>
          </div>
        </div>

        <input
          type="text"
          placeholder="Descrizione (opzionale)"
          value={description}
          onChange={e => setDesc(e.target.value)}
          style={{
            ...B,
            width: '100%',
            boxSizing: 'border-box',
            background: CREAM,
            border: `2px solid ${INK}`,
            borderRadius: 14,
            padding: '11px 14px',
            fontSize: 14,
            color: INK,
            outline: 'none',
            marginTop: 14,
          }}
        />

        <div style={{
          ...H,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: INK_50,
          fontWeight: 700,
          margin: '16px 0 8px',
        }}>Categoria</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map(c => (
            <ChipPill
              key={c.id}
              active={categoryId === c.id}
              color={c.color}
              onClick={() => setCategoryId(c.id)}
            >
              <span style={{ marginRight: 6 }}>{c.emoji}</span>{c.name}
            </ChipPill>
          ))}
        </div>

        {showPrivacyToggle && (
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => setIsPrivate(v => !v)}
              style={{
                ...B,
                width: '100%',
                padding: '10px 14px',
                borderRadius: 14,
                border: `2px solid ${INK}`,
                background: isPrivate ? INK : CREAM,
                color: isPrivate ? CREAM : INK,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                transition: 'all 120ms ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{isPrivate ? '🔒' : '👁️'}</span>
                <span>
                  {isPrivate
                    ? 'Spesa privata: solo tu la vedi'
                    : 'Spesa visibile alla famiglia'}
                </span>
              </span>
              <span style={{
                width: 36, height: 20, borderRadius: 99,
                background: isPrivate ? CREAM : INK + '30',
                border: `1.5px solid ${isPrivate ? CREAM : INK}`,
                position: 'relative',
                transition: 'background 120ms ease',
                flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute',
                  top: 1,
                  left: isPrivate ? 16 : 1,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: isPrivate ? INK : CREAM,
                  transition: 'left 160ms cubic-bezier(0.34,1.56,0.64,1)',
                }} />
              </span>
            </button>
            {isPrivate && (
              <div style={{
                ...SERIF,
                fontStyle: 'italic',
                fontSize: 12,
                color: INK_50,
                marginTop: 8,
                padding: '0 4px',
                lineHeight: 1.4,
              }}>
                ⚠️ Sconsigliato. La famiglia vedrà comunque che c'è stata una spesa e l'importo — ma non cosa. Bilico è più utile quando siete trasparenti.
              </div>
            )}
          </div>
        )}

        {/* ─── Toggle "Ricorrente ogni mese" ─── */}
        {!isGeneratedClone && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setIsRecurring(v => !v)}
              style={{
                ...B,
                width: '100%',
                padding: '10px 14px',
                borderRadius: 14,
                border: `2px solid ${INK}`,
                background: isRecurring ? ORANGE : CREAM,
                color: isRecurring ? CREAM : INK,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                transition: 'all 120ms ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔄</span>
                <span>
                  {isRecurring
                    ? 'Ricorrente ogni mese'
                    : 'Spesa una tantum'}
                </span>
              </span>
              <span style={{
                width: 36, height: 20, borderRadius: 99,
                background: isRecurring ? CREAM : INK + '30',
                border: `1.5px solid ${isRecurring ? CREAM : INK}`,
                position: 'relative',
                transition: 'background 120ms ease',
                flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute',
                  top: 1,
                  left: isRecurring ? 16 : 1,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: isRecurring ? ORANGE : CREAM,
                  transition: 'left 160ms cubic-bezier(0.34,1.56,0.64,1)',
                }} />
              </span>
            </button>

            {/* Date picker "Fino a" (opzionale) */}
            {isRecurring && (
              <div style={{
                marginTop: 8,
                background: CREAM,
                border: `2px dashed ${INK}`,
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{
                  ...H,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: INK_50,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>Fino al</span>
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={e => setRecurringEndDate(e.target.value)}
                  style={{
                    ...B,
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 14,
                    color: INK,
                    fontWeight: 600,
                  }}
                />
                {recurringEndDate && (
                  <button
                    onClick={() => setRecurringEndDate('')}
                    style={{
                      ...B,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: INK_50,
                      fontSize: 12,
                      padding: '2px 6px',
                    }}
                  >
                    ✕
                  </button>
                )}
                {!recurringEndDate && (
                  <span style={{
                    ...SERIF,
                    fontStyle: 'italic',
                    fontSize: 12,
                    color: INK_50,
                  }}>(sempre)</span>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <BigButton variant="ink" onClick={handleSubmit} disabled={!valid}>
            {isEditing ? 'Salva modifiche' : 'Salva movimento'}
          </BigButton>
        </div>

        {isEditing && onDelete && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={handleDelete}
              style={{
                ...H,
                width: '100%',
                padding: '13px',
                borderRadius: 16,
                border: `2px solid ${confirmDelete ? CORAL : INK}`,
                background: confirmDelete ? CORAL : 'transparent',
                color: confirmDelete ? CREAM : CORAL,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              {confirmDelete ? 'Tocca di nuovo per confermare' : 'Elimina movimento'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Scan Receipt Modal ─────────────────────────────────────────────────────
interface ScanModalProps {
  onClose: () => void;
  onResult: (amount: number, description: string, categoryHint: string | null) => void;
}

function ScanReceiptModal({ onClose, onResult }: ScanModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

  useEscapeKey(onClose);

  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{
    total: number | null;
    merchant: string | null;
    categoryHint: string | null;
    descriptionHint: string | null;
  } | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setScanning(true);
    setPreview(URL.createObjectURL(file));
    try {
      const data = await scanReceipt(file);
      setResult({
        total: data.total,
        merchant: data.merchant,
        categoryHint: data.categoryHint,
        descriptionHint: data.descriptionHint,
      });
      setEditAmount(data.total ? String(data.total) : '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante la scansione');
    } finally {
      setScanning(false);
    }
  };

  const handleConfirm = () => {
    const amount = parseFloat(editAmount.replace(',', '.'));
    if (amount > 0) {
      onResult(amount, result?.descriptionHint ?? result?.merchant ?? '', result?.categoryHint ?? null);
      onClose();
    }
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14,14,14,0.4)',
        zIndex: 100, backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 420,
        background: CREAM,
        borderRadius: '26px 26px 0 0',
        border: `2.5px solid ${INK}`,
        borderBottom: 'none',
        padding: '16px 22px calc(26px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        zIndex: 110,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{ ...H, fontWeight: 800, fontSize: 18, color: INK }}>📸 Scansiona scontrino</div>
          <IconBtn onClick={onClose} ariaLabel="Chiudi"><CloseX /></IconBtn>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {!preview && !scanning && (
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              ...H,
              width: '100%',
              padding: '40px 20px',
              borderRadius: 20,
              border: `2.5px dashed ${INK}`,
              background: CREAM,
              color: INK,
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: ORANGE,
              border: `2.5px solid ${INK}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              boxShadow: OFFSET(),
            }}>📷</div>
            Scatta foto o scegli dalla galleria
            <span style={{ ...B, fontSize: 12, color: INK_50, fontWeight: 500 }}>
              Inquadra bene il totale dello scontrino
            </span>
          </button>
        )}

        {scanning && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <style>{`
              @keyframes bilico-right { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(4deg); } }
              @keyframes bilico-left  { 0%,100% { transform: rotate(-10deg) translateY(0); } 30% { transform: rotate(-2deg) translateY(-2px); } 60% { transform: rotate(-16deg) translateY(1px); } }
            `}</style>
            <svg width="48" height="48" viewBox="0 0 28 28" fill="none" style={{ margin: '0 auto 20px', display: 'block' }} aria-hidden>
              <rect x="16" y="3" width="6" height="23" rx="2.5" fill={INK} style={{ transformOrigin: '19px 26px', animation: 'bilico-right 1.2s ease-in-out infinite' }} />
              <rect x="4" y="5" width="6" height="21" rx="2.5" fill={INK} style={{ transformOrigin: '7px 26px', animation: 'bilico-left 1.2s ease-in-out infinite' }} />
            </svg>
            <p style={{ ...H, fontSize: 16, color: INK, fontWeight: 700, marginBottom: 4 }}>Analizzo lo scontrino…</p>
            <p style={{ ...B, fontSize: 13, color: INK_50, fontWeight: 500 }}>Cerco il totale</p>
          </div>
        )}

        {preview && !scanning && result && (
          <div>
            <div style={{
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 16,
              maxHeight: 160,
              border: `2px solid ${INK}`,
            }}>
              <img src={preview} alt="Scontrino" style={{ width: '100%', objectFit: 'cover', maxHeight: 160, display: 'block' }} />
            </div>
            <div style={{
              background: CREAM,
              border: `2.5px solid ${INK}`,
              borderRadius: 18,
              padding: '16px',
              boxShadow: OFFSET(),
              marginBottom: 12,
            }}>
              <div style={{
                ...H,
                fontSize: 10,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: INK_50,
                fontWeight: 700,
              }}>Totale rilevato</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ ...H, fontWeight: 800, fontSize: 40, color: INK, letterSpacing: '-1px' }}>−</span>
                <input
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                  inputMode="decimal"
                  style={{
                    ...H,
                    fontWeight: 800,
                    fontSize: 40,
                    color: INK,
                    letterSpacing: '-1px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    width: '60%',
                    padding: 0,
                  }}
                />
                <span style={{ ...SERIF, fontStyle: 'italic', fontSize: 28, color: CORAL }}>€</span>
              </div>
            </div>
            {result.merchant && (
              <p style={{ ...B, fontSize: 13, color: INK_70, margin: '0 0 6px' }}>
                Negozio: <strong>{result.merchant}</strong>
              </p>
            )}
            {result.categoryHint && (
              <p style={{ ...B, fontSize: 13, color: ORANGE, margin: '0 0 12px', fontWeight: 600 }}>
                Categoria suggerita: <strong>{result.categoryHint}</strong>
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <BigButton
                variant="cream"
                onClick={() => { setPreview(null); setResult(null); setEditAmount(''); }}
                style={{ flex: 1 }}
              >
                Riprova
              </BigButton>
              <BigButton variant="ink" onClick={handleConfirm} style={{ flex: 1 }}>
                Conferma
              </BigButton>
            </div>
          </div>
        )}

        {error && (
          <p style={{ ...B, fontSize: 13, color: CORAL, marginTop: 12, textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </>
  );
}

// ─── Profile Sheet ──────────────────────────────────────────────────────────
interface ProfileSheetProps {
  onClose: () => void;
  onLogout: () => void;
  onFamily: () => void;
  onResetOnboarding: () => void;
  userName: string | null;
  userEmail: string | null;
  isPremium?: boolean;
}

function ProfileSheet({
  onClose, onLogout, onFamily, onResetOnboarding,
  userName, userEmail, isPremium,
}: ProfileSheetProps) {
  useEscapeKey(onClose);
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14,14,14,0.4)',
        zIndex: 100, backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 420,
        background: CREAM,
        borderRadius: '26px 26px 0 0',
        border: `2.5px solid ${INK}`,
        borderBottom: 'none',
        padding: '16px 22px calc(26px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        zIndex: 110,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{ ...H, fontWeight: 800, fontSize: 18, color: INK }}>
            Profilo
          </div>
          <IconBtn onClick={onClose} ariaLabel="Chiudi"><CloseX /></IconBtn>
        </div>

        {/* User card */}
        <div style={{
          background: LILAC,
          border: `2.5px solid ${INK}`,
          borderRadius: 20,
          padding: '16px 18px',
          boxShadow: OFFSET(),
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: CREAM,
            border: `2.5px solid ${INK}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...H,
            fontWeight: 800,
            fontSize: 18,
            color: INK,
            flexShrink: 0,
          }}>
            {(userName?.split(' ').map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              ...H,
              fontWeight: 800,
              fontSize: 16,
              color: INK,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{userName ?? 'Tu'}</div>
            <div style={{
              ...B,
              fontSize: 12,
              color: INK_70,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{userEmail ?? ''}</div>
          </div>
          {isPremium && (
            <span style={{
              ...H,
              fontSize: 10,
              fontWeight: 800,
              background: INK,
              color: CREAM,
              padding: '4px 8px',
              borderRadius: 6,
              letterSpacing: '0.5px',
            }}>PRO</span>
          )}
        </div>

        {/* Menu items */}
        <div style={{ display: 'grid', gap: 8 }}>
          <ProfileRow
            label="Famiglia"
            hint="Invita il partner"
            onClick={onFamily}
            color={MINT}
            emoji="👥"
          />
          <ProfileRow
            label="Bilico PRO"
            hint={isPremium ? 'Attivo' : 'Scansiona scontrini · 3€/mese'}
            onClick={() => window.open('mailto:bilico.app@gmail.com?subject=Attivazione%20Bilico%20PRO', '_blank')}
            color={ORANGE}
            emoji="📸"
          />
          <ProfileRow
            label="Rifai l'onboarding"
            hint="Modifica reddito, spese fisse, abitudini"
            onClick={onResetOnboarding}
            color={SAND}
            emoji="🔁"
          />
          <ProfileRow
            label="Supporto"
            hint="Scrivici"
            onClick={() => window.open('mailto:bilico.app@gmail.com?subject=Supporto%20Bilico', '_blank')}
            color={CREAM}
            emoji="✉️"
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <BigButton variant="cream" onClick={onLogout}>
            Esci da Bilico
          </BigButton>
        </div>
      </div>
    </>
  );
}

function ProfileRow({
  label, hint, onClick, color, emoji,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  color: string;
  emoji: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: CREAM,
        border: `2px solid ${INK}`,
        borderRadius: 14,
        padding: '11px 14px',
        cursor: 'pointer',
        ...H,
      }}
    >
      <div style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: color,
        border: `2px solid ${INK}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ ...H, fontWeight: 700, fontSize: 14, color: INK }}>{label}</div>
        <div style={{ ...B, fontSize: 11, color: INK_50 }}>{hint}</div>
      </div>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path d="M3.5 1L8 5L3.5 9" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ─── Main Shell ─────────────────────────────────────────────────────────────
type Tab = 'casa' | 'movimenti' | 'obiettivi';
type ViewMode = 'all' | 'me' | 'family';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { addTransaction: addToStore, profile, transactions, familyMembers } = useStore();
  const { addTransaction, updateTransaction, deleteTransaction } = useTransactions(user?.uid, profile?.familyId);
  useRecurring(user?.uid);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('casa');
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [scanSeed, setScanSeed] = useState<{ amount: number; desc: string; category: string | null } | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYM());
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [storicoFilter, setStoricoFilter] = useState<string>('all'); // 'all' o uid di un membro

  const isFamilyUser = familyMembers.length > 1;
  // Se non sei in famiglia, la vista famiglia non ha senso: forza "all"
  const effectiveView: ViewMode = isFamilyUser ? viewMode : 'all';

  // Trofei / badge (auto-detect + toast)
  const { all: allBadges, toast: badgeToast, dismissToast } = useBadges();

  const ym = selectedMonth;
  const monthLabel = ymLabel(selectedMonth);
  const isCurrentMonth = selectedMonth === currentYM();

  const firstName = user?.displayName?.split(' ')[0] ?? 'tu';

  // Mappa: nome categoria → shared?
  const sharedByCategoryName = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of profile?.categories ?? []) {
      map[c.name] = c.shared ?? false;
    }
    return map;
  }, [profile]);

  // Transazioni del mese — lista VISIBILE (include le private altrui ma oscurate).
  // Nel view "Famiglia" le private sono escluse perché sono per definizione personali.
  const monthTxsList = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date.startsWith(ym)) return false;

      if (effectiveView === 'me') {
        return t.userId === user?.uid;
      }
      if (effectiveView === 'family') {
        if (t.isPrivate) return false;
        const parts = t.category.split(' ');
        const hasEmoji = parts.length > 1 && !/[A-Za-z]/.test(parts[0] ?? '');
        const name = (hasEmoji ? parts.slice(1).join(' ') : t.category).trim();
        return sharedByCategoryName[name] === true;
      }
      // 'all' — include private di altri (rendering le oscura)
      return true;
    });
  }, [transactions, ym, effectiveView, user, sharedByCategoryName]);

  // Transazioni per CALCOLI (speso, libero, barre) — escludono le private altrui
  // perché non voglio rivelarne l'importo nei breakdown di categoria.
  const monthTxs = useMemo(
    () => monthTxsList.filter(t => !(t.isPrivate && t.userId !== user?.uid)),
    [monthTxsList, user],
  );

  const spent = useMemo(
    () => monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthTxs],
  );

  const freeBudget = useMemo(() => {
    const inc = profile?.income ?? 0;
    const fixed = (profile?.fixedExpenses ?? []).reduce((s, f) => s + f.amount, 0);
    return Math.max(0, inc - fixed);
  }, [profile]);

  const free = Math.max(0, freeBudget - spent);
  const tiltBy = freeBudget > 0
    ? Math.max(-18, Math.min(18, (spent / freeBudget - 0.5) * 20))
    : 0;

  const weeklySpent = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    return monthTxs
      .filter(t => t.type === 'expense' && new Date(t.createdAt) >= since)
      .reduce((s, t) => s + t.amount, 0);
  }, [monthTxs]);

  // Speso per membro (per la Nota della settimana in famiglia)
  const spentByMember = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTxs) {
      if (t.type !== 'expense') continue;
      map[t.userId] = (map[t.userId] ?? 0) + t.amount;
    }
    return map;
  }, [monthTxs]);

  const isFamily = familyMembers.length > 1;
  // Membro che ha speso di più questo mese
  const topSpenderEntry = Object.entries(spentByMember).sort((a, b) => b[1] - a[1])[0];
  const topSpender = topSpenderEntry
    ? familyMembers.find(m => m.uid === topSpenderEntry[0])
    : undefined;
  const topSpenderName = topSpender
    ? (topSpender.uid === user?.uid ? 'Tu' : topSpender.name.split(' ')[0])
    : null;
  const topSpenderPct = topSpenderEntry && spent > 0
    ? Math.round(topSpenderEntry[1] / spent * 100)
    : 0;

  const categories = useMemo(
    () => (profile?.categories ?? []).map(c => ({
      id: c.id, name: c.name, emoji: c.emoji, color: c.color,
    })),
    [profile],
  );

  const handleAdd = (tx: {
    description: string;
    amount: number;
    category: string;
    emoji: string;
    isPrivate: boolean;
    isRecurring: boolean;
    recurringEndDate?: string;
  }) => {
    if (!user) return;
    const data: Omit<Transaction, 'id' | 'createdAt'> = {
      type: 'expense' as const,
      amount: tx.amount,
      category: tx.emoji + ' ' + tx.category,
      description: tx.description,
      date: new Date().toISOString().slice(0, 10),
      userId: user.uid,
      familyId: profile?.familyId ?? user.uid,
      isPrivate: tx.isPrivate || false,
    };
    if (tx.isRecurring) {
      data.recurring = {
        frequency: 'monthly',
        ...(tx.recurringEndDate ? { endDate: tx.recurringEndDate } : {}),
      };
    }
    addTransaction(data, addToStore);
    setScanSeed(null);
  };

  const openAdd = () => {
    setScanSeed(null);
    setShowAdd(true);
  };

  const handleEditSave = (tx: {
    description: string;
    amount: number;
    category: string;
    emoji: string;
    isPrivate: boolean;
    isRecurring: boolean;
    recurringEndDate?: string;
  }) => {
    if (!editingTx) return;
    const patch: Partial<Pick<Transaction, 'amount' | 'category' | 'description' | 'isPrivate' | 'recurring'>> = {
      amount: tx.amount,
      category: tx.emoji + ' ' + tx.category,
      description: tx.description,
      isPrivate: tx.isPrivate || false,
    };
    // Ricorrenza: solo se non è un clone generato (editing sul template).
    if (!editingTx.sourceRecurringId) {
      if (tx.isRecurring) {
        patch.recurring = {
          frequency: 'monthly',
          ...(tx.recurringEndDate ? { endDate: tx.recurringEndDate } : {}),
        };
      } else if (editingTx.recurring) {
        // Disattivazione: esplicitamente tolta — Firestore non supporta undefined,
        // quindi il `field delete` sarebbe la via pulita; per MVP sovrascrivo con un oggetto "stop"
        patch.recurring = { frequency: 'monthly', endDate: editingTx.date };
      }
    }
    updateTransaction(editingTx.id, patch);
    setEditingTx(null);
  };

  const handleEditDelete = () => {
    if (!editingTx) return;
    deleteTransaction(editingTx.id);
    setEditingTx(null);
  };

  const handleResetOnboarding = async () => {
    if (!user) return;
    if (!confirm('Vuoi rifare l\'onboarding? Le tue categorie e impostazioni verranno ricreate. Le transazioni restano intatte.')) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { onboardingComplete: false });
      // Aggiorna lo store locale per innescare il redirect
      useStore.setState({ profile: profile ? { ...profile, onboardingComplete: false } : null });
      setShowProfile(false);
      navigate('/onboarding');
    } catch (err) {
      console.error('Reset onboarding failed:', err);
      alert('Non è stato possibile ripartire l\'onboarding. Riprova.');
    }
  };

  const bottomRowStyle: CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 420,
    padding: '10px 22px calc(22px + env(safe-area-inset-bottom, 0px))',
    background: 'linear-gradient(to top, rgba(250,242,227,1) 70%, rgba(250,242,227,0))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 50,
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100svh',
      background: CREAM,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 110,
      }}>
        {/* ── Header ── */}
        <div style={{ padding: 'calc(36px + env(safe-area-inset-top, 0px)) 22px 14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              {/* Navigatore mese */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: CREAM,
                border: `2px solid ${INK}`,
                borderRadius: 99,
                padding: '2px 4px',
                boxShadow: OFFSET_SM(),
              }}>
                <button
                  onClick={() => setSelectedMonth(prevYM(selectedMonth))}
                  aria-label="Mese precedente"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'transparent',
                    color: INK,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M6.5 1L2 5L6.5 9" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span style={{
                  ...H,
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: INK,
                  fontWeight: 700,
                  padding: '0 4px',
                  minWidth: 64,
                  textAlign: 'center',
                }}>{monthLabel}</span>
                <button
                  onClick={() => { if (!isCurrentMonth) setSelectedMonth(nextYM(selectedMonth)); }}
                  aria-label="Mese successivo"
                  disabled={isCurrentMonth}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'transparent',
                    color: isCurrentMonth ? INK_50 : INK,
                    cursor: isCurrentMonth ? 'default' : 'pointer',
                    padding: 0,
                    opacity: isCurrentMonth ? 0.3 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M3.5 1L8 5L3.5 9" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <h1 style={{
                ...H,
                fontWeight: 800,
                fontSize: 28,
                color: INK,
                letterSpacing: '-1px',
                margin: '6px 0 0',
              }}>
                Ciao,{' '}
                <span style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, color: CORAL, fontSize: 30 }}>
                  {firstName}
                </span>
              </h1>
            </div>
            <IconBtn
              onClick={() => setShowProfile(true)}
              ariaLabel="Profilo"
              style={{ background: LILAC }}
            >
              <span style={{ ...H, fontWeight: 800, fontSize: 14, color: INK }}>
                {initials(user?.displayName ?? null)}
              </span>
            </IconBtn>
          </div>
        </div>

        {/* ── Toggle vista Io / Famiglia / Tutto (solo in famiglia) ── */}
        {isFamilyUser && (
          <div style={{ padding: '0 22px 10px', display: 'flex' }}>
            <div style={{
              display: 'flex',
              gap: 2,
              background: CREAM,
              border: `2px solid ${INK}`,
              borderRadius: 99,
              padding: 3,
              boxShadow: OFFSET_SM(),
            }}>
              {([
                { id: 'me' as ViewMode,     label: 'Io' },
                { id: 'family' as ViewMode, label: 'Famiglia' },
                { id: 'all' as ViewMode,    label: 'Tutto' },
              ]).map(v => {
                const active = effectiveView === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setViewMode(v.id)}
                    style={{
                      ...H,
                      padding: '6px 14px',
                      borderRadius: 99,
                      border: 'none',
                      background: active ? INK : 'transparent',
                      color: active ? CREAM : INK,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      letterSpacing: 0.3,
                    }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ padding: '0 22px', display: 'flex', gap: 8, marginBottom: 10 }}>
          {([
            { id: 'casa',      label: 'Casa' },
            { id: 'movimenti', label: 'Movimenti' },
            { id: 'obiettivi', label: 'Obiettivi' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                ...H,
                padding: '8px 14px',
                borderRadius: 99,
                border: `2px solid ${INK}`,
                background: tab === t.id ? INK : 'transparent',
                color: tab === t.id ? CREAM : INK,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, padding: '6px 22px 0' }}>
          {tab === 'casa' && (
            <>
              <div style={{
                background: CREAM,
                border: `2.5px solid ${INK}`,
                borderRadius: 24,
                padding: 16,
                boxShadow: OFFSET(),
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div aria-hidden style={{
                  position: 'absolute',
                  top: -12,
                  right: -12,
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: MINT,
                  border: `2.5px solid ${INK}`,
                }} />
                <BalanceScale
                  spent={spent}
                  free={free}
                  tiltBy={tiltBy}
                  size="md"
                  showDecoration={false}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 6,
                  padding: '0 6px',
                }}>
                  <div>
                    <div style={{
                      ...H,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      color: ORANGE,
                      fontWeight: 700,
                    }}>Speso</div>
                    <div style={{ ...H, fontWeight: 800, fontSize: 22, color: INK, letterSpacing: '-0.5px' }}>
                      {fmtN(spent)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      ...H,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      color: GREEN,
                      fontWeight: 700,
                    }}>Libero</div>
                    <div style={{ ...H, fontWeight: 800, fontSize: 22, color: INK, letterSpacing: '-0.5px' }}>
                      {fmtN(free)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Panel color={ORANGE} style={{ padding: 14 }}>
                  <div style={{
                    ...H,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: CREAM,
                    fontWeight: 700,
                    opacity: 0.9,
                  }}>Questa settimana</div>
                  <div style={{
                    ...H,
                    fontWeight: 800,
                    fontSize: 26,
                    color: CREAM,
                    letterSpacing: '-0.5px',
                    marginTop: 2,
                  }}>
                    {fmtN(weeklySpent)}
                  </div>
                </Panel>
                <Panel color={GREEN} style={{ padding: 14 }}>
                  <div style={{
                    ...H,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: CREAM,
                    fontWeight: 700,
                    opacity: 0.9,
                  }}>Tesoretto</div>
                  <div style={{
                    ...H,
                    fontWeight: 800,
                    fontSize: 26,
                    color: CREAM,
                    letterSpacing: '-0.5px',
                    marginTop: 2,
                  }}>
                    +{fmtN(free)}
                  </div>
                </Panel>
              </div>

              <div style={{
                marginTop: 14,
                background: SAND,
                border: `2.5px solid ${INK}`,
                borderRadius: 20,
                padding: 18,
              }}>
                <div style={{
                  ...H,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: INK_50,
                  fontWeight: 700,
                }}>Nota della settimana</div>
                <p style={{
                  ...SERIF,
                  fontStyle: 'italic',
                  fontSize: 22,
                  color: INK,
                  lineHeight: 1.25,
                  margin: '6px 0 0',
                }}>
                  {monthTxs.length === 0 ? (
                    <>Primo movimento in arrivo? <span style={{ color: CORAL }}>Premi il +.</span></>
                  ) : spent > freeBudget ? (
                    <>Avete sforato di <span style={{ color: CORAL }}>{fmtN(spent - freeBudget)}</span>. Niente drammi — respirate.</>
                  ) : isFamily && topSpenderName && topSpenderPct >= 55 ? (
                    <>{topSpenderName === 'Tu' ? 'Tu hai' : `${topSpenderName} ha`} contribuito al <span style={{ color: CORAL }}>{topSpenderPct}%</span> della spesa del mese.</>
                  ) : (
                    <>{isFamily ? 'Siete' : 'Sei'} a <span style={{ color: CORAL }}>{Math.round(spent / Math.max(1, freeBudget) * 100)}%</span> del budget. Continuate così.</>
                  )}
                </p>
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 8,
                }}>
                  <div style={{ ...H, fontWeight: 800, fontSize: 16, color: INK }}>Movimenti recenti</div>
                  {monthTxs.length > 3 && (
                    <button
                      onClick={() => setTab('movimenti')}
                      style={{
                        ...H,
                        fontWeight: 700,
                        fontSize: 12,
                        color: INK,
                        opacity: 0.6,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Vedi tutti →
                    </button>
                  )}
                </div>
                <TxList tx={monthTxsList.slice(0, 3)} onEdit={setEditingTx} />
              </div>
            </>
          )}

          {tab === 'movimenti' && (() => {
            const filteredList = storicoFilter === 'all'
              ? monthTxsList
              : monthTxsList.filter(t => t.userId === storicoFilter);
            return (
              <>
                {/* Filtro per membro (solo se in famiglia) */}
                {isFamilyUser && (
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    margin: '4px 0 10px',
                  }}>
                    <FilterChip
                      active={storicoFilter === 'all'}
                      onClick={() => setStoricoFilter('all')}
                      label="Tutti"
                    />
                    {familyMembers.map(m => {
                      const label = m.uid === user?.uid ? 'Tu' : m.name.split(' ')[0];
                      return (
                        <FilterChip
                          key={m.uid}
                          active={storicoFilter === m.uid}
                          onClick={() => setStoricoFilter(m.uid)}
                          label={label}
                          color={m.color}
                        />
                      );
                    })}
                  </div>
                )}

                <div style={{
                  ...H,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: INK_50,
                  fontWeight: 700,
                  margin: '4px 0 10px',
                }}>
                  {monthLabel} · {filteredList.length} {filteredList.length === 1 ? 'movimento' : 'movimenti'}
                </div>
                <TxList tx={filteredList} onEdit={setEditingTx} />
              </>
            );
          })()}

          {tab === 'obiettivi' && <ObiettiviTab ym={ym} badges={allBadges} />}
        </div>

        {/* ── Bottom nav + FAB ── */}
        <div style={bottomRowStyle}>
          <div style={{
            display: 'flex',
            gap: 6,
            background: CREAM,
            border: `2px solid ${INK}`,
            borderRadius: 99,
            padding: 4,
            boxShadow: OFFSET_SM(),
          }}>
            <NavDot active={tab !== 'movimenti'} label="Casa" onClick={() => setTab('casa')} />
            <NavDot label="Storico" onClick={() => setTab('movimenti')} />
            <NavDot label="Famiglia" onClick={() => navigate('/family')} />
          </div>
          <button
            onClick={openAdd}
            aria-label="Aggiungi spesa"
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: ORANGE,
              border: `2.5px solid ${INK}`,
              boxShadow: OFFSET(),
              cursor: 'pointer',
              ...H,
              fontWeight: 800,
              fontSize: 32,
              color: CREAM,
              lineHeight: 1,
              padding: 0,
            }}
          >+</button>
        </div>

        {showAdd && (
          <AddExpenseModal
            onClose={() => setShowAdd(false)}
            categories={categories.length > 0 ? categories : [
              { id: 'spesa', name: 'Spesa', emoji: '🛒', color: ORANGE },
              { id: 'altro', name: 'Altro', emoji: '💸', color: SAND },
            ]}
            onAdd={handleAdd}
            onScan={() => setShowScan(true)}
            initialAmount={scanSeed ? String(scanSeed.amount) : undefined}
            initialDesc={scanSeed?.desc || undefined}
            initialCategory={scanSeed?.category || undefined}
            showPrivacyToggle={familyMembers.length > 1}
          />
        )}

        {showScan && (
          <ScanReceiptModal
            onClose={() => setShowScan(false)}
            onResult={(amount, desc, categoryHint) => {
              const matched = categoryHint
                ? categories.find(c => c.name.toLowerCase() === categoryHint.toLowerCase())?.name ?? null
                : null;
              setScanSeed({ amount, desc, category: matched });
              setShowScan(false);
              setShowAdd(true);
            }}
          />
        )}

        {editingTx && (() => {
          const parts = editingTx.category.split(' ');
          const hasEmoji = parts.length > 1 && !/[A-Za-z]/.test(parts[0] ?? '');
          const catName = hasEmoji ? parts.slice(1).join(' ') : editingTx.category;
          return (
            <AddExpenseModal
              onClose={() => setEditingTx(null)}
              categories={categories.length > 0 ? categories : [
                { id: 'altro', name: 'Altro', emoji: '💸', color: SAND },
              ]}
              onAdd={handleEditSave}
              onScan={() => {}}
              initialAmount={String(editingTx.amount)}
              initialDesc={editingTx.description}
              initialCategory={catName}
              initialIsPrivate={!!editingTx.isPrivate}
              initialIsRecurring={!!editingTx.recurring}
              initialRecurringEndDate={editingTx.recurring?.endDate}
              editingId={editingTx.id}
              isGeneratedClone={!!editingTx.sourceRecurringId}
              onDelete={handleEditDelete}
              showPrivacyToggle={familyMembers.length > 1}
            />
          );
        })()}

        {showProfile && (
          <ProfileSheet
            onClose={() => setShowProfile(false)}
            userName={user?.displayName ?? null}
            userEmail={user?.email ?? null}
            isPremium={profile?.isPremium}
            onFamily={() => { setShowProfile(false); navigate('/family'); }}
            onResetOnboarding={handleResetOnboarding}
            onLogout={() => {
              setShowProfile(false);
              logout();
            }}
          />
        )}

        {/* ── Toast badge sbloccato ── */}
        {badgeToast && (
          <BadgeToast badge={badgeToast} onDismiss={dismissToast} />
        )}
      </div>
    </div>
  );
}
