import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { afterBreak, usePhaseEvents } from "../lib/gameEvents";
import { useBestScore } from "../lib/useBestScore";
import { useSound } from "../../components/games/SoundContext";

type Suit = "spades" | "hearts" | "diamonds" | "clubs";
type Phase = "idle" | "playing" | "won" | "lost";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const IS_RED: Record<Suit, boolean> = {
  spades: false,
  hearts: true,
  diamonds: true,
  clubs: false,
};
const RANK_LABEL = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/*
 * Green card table, white cards, blue backs: the look most solitaire games share.
 * The table is drawn with fixed colors (like canvas constants) so it reads the same on the site and on portals.
 */
const C = {
  felt: "#16803f",
  feltLight: "#1f9a4f",
  feltDeep: "#0b5a2a",
  /* Slot marks, icons and labels on the felt. */
  brass: "#ffffff",
  ivory: "#ffffff",
  ivoryEdge: "#c9cdd3",
  red: "#d0152b",
  ink: "#16181d",
  back: "#1f5bc4",
  backDeep: "#163f8c",
  glow: "#ffd23f",
  panel: "rgba(8, 40, 22, 0.94)",
  slot: "rgba(0, 0, 0, 0.12)",
  slotLine: "rgba(255, 255, 255, 0.35)",
  button: "#ffd23f",
};
const SERIF = "Georgia, 'Times New Roman', 'Noto Serif', serif";
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
const FELT_BG = `${NOISE}, radial-gradient(ellipse 85% 75% at 50% 38%, ${C.feltLight} 0%, ${C.felt} 48%, ${C.feltDeep} 100%)`;

const MOVE_MS = 280;
const EASE = "cubic-bezier(0.2, 0.8, 0.25, 1)";
const DEAL_STEP = 42;
const WIN_DELAY = (n: number) => (n % 13) * 55 + Math.floor(n / 13) * 14;
const WAVE_MS = 2600;

interface Card {
  id: string;
  suit: Suit;
  rank: number;
  up: boolean;
}

interface Board {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
}

type Selection =
  | { zone: "waste" }
  | { zone: "foundation"; index: number }
  | { zone: "tableau"; col: number; index: number }
  | null;

type Target = { kind: "tableau"; col: number } | { kind: "foundation"; index: number };

type Loc =
  | { zone: "stock" }
  | { zone: "waste"; top: boolean }
  | { zone: "foundation"; index: number; top: boolean }
  | { zone: "tableau"; col: number; index: number };

interface Snapshot {
  board: Board;
  score: number;
  moves: number;
}

interface Game {
  board: Board;
  score: number;
  moves: number;
  phase: Phase;
  history: Snapshot[];
}

const EMPTY_BOARD: Board = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
};

function shuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, up: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = deck[i];
    deck[i] = deck[j];
    deck[j] = swap;
  }
  return deck;
}

function dealBoard(): Board {
  const deck = shuffledDeck();
  const tableau: Card[][] = [[], [], [], [], [], [], []];
  // Deal row by row, like a real deal, so the animation order matches the cards' order.
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) {
      const card = deck.pop() as Card;
      tableau[col].push({ ...card, up: row === col });
    }
  }
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau };
}

function cloneBoard(board: Board): Board {
  return {
    stock: board.stock.map((c) => ({ ...c })),
    waste: board.waste.map((c) => ({ ...c })),
    foundations: board.foundations.map((pile) => pile.map((c) => ({ ...c }))),
    tableau: board.tableau.map((pile) => pile.map((c) => ({ ...c }))),
  };
}

function fitsFoundation(card: Card, pile: Card[], suitIndex: number): boolean {
  return card.suit === SUITS[suitIndex] && card.rank === pile.length + 1;
}

function fitsTableau(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 13;
  const top = pile[pile.length - 1];
  if (!top.up) return false;
  return IS_RED[top.suit] !== IS_RED[card.suit] && card.rank === top.rank - 1;
}

function linked(upper: Card, lower: Card): boolean {
  return IS_RED[upper.suit] !== IS_RED[lower.suit] && lower.rank === upper.rank - 1;
}

function isRun(cards: Card[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].up) return false;
    if (i > 0 && !linked(cards[i - 1], cards[i])) return false;
  }
  return cards.length > 0;
}

function runStart(pile: Card[]): number | null {
  if (pile.length === 0) return null;
  let i = pile.length - 1;
  while (i > 0 && pile[i - 1].up && linked(pile[i - 1], pile[i])) i--;
  return pile[i].up ? i : null;
}

function collected(board: Board): number {
  return board.foundations.reduce((n, pile) => n + pile.length, 0);
}

function hasAnyMove(board: Board): boolean {
  const toFoundation = (card: Card) =>
    board.foundations.some((pile, i) => fitsFoundation(card, pile, i));
  const toTableau = (card: Card) => board.tableau.some((pile) => fitsTableau(card, pile));

  for (const card of board.waste.concat(board.stock)) {
    if (toFoundation(card) || toTableau(card)) return true;
  }

  for (let i = 0; i < board.tableau.length; i++) {
    const pile = board.tableau[i];
    if (pile.length === 0) continue;
    const top = pile[pile.length - 1];
    if (top.up && toFoundation(top)) return true;
    for (let k = 0; k < pile.length; k++) {
      if (!pile[k].up) continue;
      const run = pile.slice(k);
      if (!isRun(run)) continue;
      for (let j = 0; j < board.tableau.length; j++) {
        if (j === i) continue;
        const target = board.tableau[j];
        if (!fitsTableau(run[0], target)) continue;
        if (k === 0 && target.length === 0) continue;
        return true;
      }
    }
  }
  return false;
}

function selectedCards(board: Board, sel: Selection): Card[] | null {
  if (!sel) return null;
  if (sel.zone === "waste") {
    const top = board.waste[board.waste.length - 1];
    return top ? [top] : null;
  }
  if (sel.zone === "foundation") {
    const pile = board.foundations[sel.index];
    const top = pile[pile.length - 1];
    return top ? [top] : null;
  }
  const pile = board.tableau[sel.col];
  if (sel.index >= pile.length) return null;
  const run = pile.slice(sel.index);
  return isRun(run) ? run : null;
}

function canMove(board: Board, from: Selection, target: Target): boolean {
  const cards = selectedCards(board, from);
  if (!cards || !from) return false;
  if (target.kind === "foundation") {
    if (cards.length !== 1 || from.zone === "foundation") return false;
    return fitsFoundation(cards[0], board.foundations[target.index], target.index);
  }
  if (from.zone === "tableau" && from.col === target.col) return false;
  return fitsTableau(cards[0], board.tableau[target.col]);
}

function sameSpot(a: Selection, b: Selection): boolean {
  if (!a || !b || a.zone !== b.zone) return false;
  if (a.zone === "waste") return true;
  if (a.zone === "foundation" && b.zone === "foundation") return a.index === b.index;
  if (a.zone === "tableau" && b.zone === "tableau") return a.col === b.col && a.index === b.index;
  return false;
}

function advance(game: Game, board: Board, delta: number): Game {
  const history = game.history.slice(-50).concat({
    board: cloneBoard(game.board),
    score: game.score,
    moves: game.moves,
  });
  let phase: Phase = "playing";
  if (collected(board) === 52) phase = "won";
  else if (!hasAnyMove(board)) phase = "lost";
  return {
    board,
    score: Math.max(0, game.score + delta),
    moves: game.moves + 1,
    phase,
    history,
  };
}

function canAutoFinish(board: Board): boolean {
  return (
    board.stock.length === 0 &&
    board.waste.length === 0 &&
    board.tableau.every((pile) => pile.every((c) => c.up)) &&
    collected(board) < 52
  );
}

function formatTime(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}:${ss < 10 ? "0" : ""}${ss}`;
}

/* ── Layout ─────────────────────────────────────────────────────────────── */

interface Layout {
  w: number;
  h: number;
  cw: number;
  ch: number;
  gap: number;
  x0: number;
  topY: number;
  tabY: number;
  bottom: number;
  hudH: number;
  barH: number;
  padR: number;
  padL: number;
  actionsInHud: boolean;
  compact: boolean;
}

function computeLayout(w: number, h: number, portal: boolean): Layout {
  const actionsInHud = w >= 700;
  const hudH = portal ? 58 : 50;
  const barH = actionsInHud ? 0 : 66;
  const pad = w < 500 ? 6 : 16;
  const availW = w - pad * 2;
  const availH = h - hudH - barH - 10;
  const cw = Math.max(30, Math.floor(Math.min(availW / 7.5, availH / (1.4 * 3.9), 150)));
  const ch = Math.round(cw * 1.4);
  const gap = Math.max(3, Math.min(Math.floor((availW - 7 * cw) / 6), Math.round(cw * 0.16)));
  const boardW = cw * 7 + gap * 6;
  const x0 = Math.round((w - boardW) / 2);
  const topY = hudH + 2;
  const tabY = topY + ch + Math.round(ch * 0.13);
  return {
    w,
    h,
    cw,
    ch,
    gap,
    x0,
    topY,
    tabY,
    bottom: h - barH - 8,
    hudH,
    barH,
    padR: portal ? 116 : pad,
    padL: Math.max(pad, x0),
    actionsInHud,
    compact: cw < 72,
  };
}

const colX = (L: Layout, i: number) => L.x0 + i * (L.cw + L.gap);

function colOffsets(pile: Card[], L: Layout): number[] {
  const n = pile.length;
  if (n === 0) return [];
  let down = L.ch * 0.11;
  let up = L.ch * (L.compact ? 0.34 : 0.26);
  let nd = 0;
  let nu = 0;
  for (let i = 0; i < n - 1; i++) {
    if (pile[i].up) nu++;
    else nd++;
  }
  const avail = Math.max(0, L.bottom - L.tabY - L.ch);
  if (nd * down + nu * up > avail) {
    down = Math.max(L.ch * 0.05, Math.min(down, (avail - nu * up) / Math.max(nd, 1)));
    if (nd * down + nu * up > avail && nu > 0) up = Math.max(L.ch * 0.15, (avail - nd * down) / nu);
  }
  const out = [0];
  let y = 0;
  for (let i = 1; i < n; i++) {
    y += pile[i - 1].up ? up : down;
    out.push(Math.round(y));
  }
  return out;
}

interface Pos {
  x: number;
  y: number;
  z: number;
  rot: number;
  up: boolean;
  delay: number;
  flipDelay: number;
}

type Mode = "stacked" | "dealing" | "normal" | "won";

function computePositions(board: Board, L: Layout, mode: Mode): Record<string, Pos> {
  const out: Record<string, Pos> = {};
  const stockX = colX(L, 0);
  const put = (c: Card, x: number, y: number, z: number, extra?: Partial<Pos>) => {
    out[c.id] = { x, y, z, rot: 0, up: c.up, delay: 0, flipDelay: 0, ...extra };
  };

  if (mode === "won") {
    // An oval garland of all 52 cards around the table, suit by suit.
    const cx = L.w / 2;
    const cy = (L.hudH + L.bottom) / 2;
    let rx = Math.max(L.cw * 1.5, L.w / 2 - L.ch * 0.62);
    let ry = Math.max(L.ch * 1.2, (L.bottom - L.hudH) / 2 - L.ch * 0.6);
    rx = Math.min(rx, ry * 1.5);
    ry = Math.min(ry, rx * 1.7);
    board.foundations.forEach((pile, s) =>
      pile.forEach((c, i) => {
        const n = s * 13 + i;
        const a = (n / 52) * Math.PI * 2 - Math.PI / 2;
        const normal = Math.atan2(Math.sin(a) / ry, Math.cos(a) / rx);
        put(c, cx + rx * Math.cos(a) - L.cw / 2, cy + ry * Math.sin(a) - L.ch / 2, 10 + n, {
          rot: (normal * 180) / Math.PI + 90,
          up: true,
          delay: WIN_DELAY(n),
        });
      }),
    );
    return out;
  }

  const all = [...board.stock, ...board.waste, ...board.foundations.flat(), ...board.tableau.flat()];
  if (mode === "stacked") {
    all.forEach((c, i) => put(c, stockX, L.topY, i, { up: false }));
    return out;
  }

  board.stock.forEach((c, i) => {
    const lift = Math.floor(i / 8);
    put(c, stockX - lift, L.topY - lift, 10 + i);
  });

  const wn = board.waste.length;
  const fan = Math.round(L.cw * 0.22);
  board.waste.forEach((c, i) => {
    const slot = Math.max(0, i - (wn - 3));
    put(c, colX(L, 1) + slot * fan, L.topY, 100 + i);
  });

  board.foundations.forEach((pile, f) =>
    pile.forEach((c, i) => put(c, colX(L, 3 + f), L.topY, 200 + i)),
  );

  let k = 0;
  const order: Record<string, number> = {};
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) {
      const card = board.tableau[col][row];
      if (card) order[card.id] = k++;
    }
  }
  board.tableau.forEach((pile, col) => {
    const offs = colOffsets(pile, L);
    pile.forEach((c, i) => {
      const delay = mode === "dealing" ? (order[c.id] ?? 0) * DEAL_STEP : 0;
      put(c, colX(L, col), L.tabY + offs[i], 300 + i, {
        delay,
        flipDelay: mode === "dealing" ? delay + MOVE_MS - 60 : 0,
      });
    });
  });
  return out;
}

/* ── Card art ───────────────────────────────────────────────────────────── */

const SUIT_PATHS: Record<Suit, ReactNode> = {
  hearts: <path d="M12 21.2C8.1 18.2 3.6 14.6 3.6 10.2A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 8.4 2.8c0 4.4-4.5 8-8.4 11Z" />,
  diamonds: <path d="M12 2.2 19.6 12 12 21.8 4.4 12Z" />,
  spades: (
    <path d="M12 2.2C8.3 6.1 3.6 9.2 3.6 13.2a4.3 4.3 0 0 0 7.3 3.1c-.2 2.2-1.1 3.8-2.7 4.5h7.6c-1.6-.7-2.5-2.3-2.7-4.5a4.3 4.3 0 0 0 7.3-3.1c0-4-4.7-7.1-8.4-11Z" />
  ),
  clubs: (
    <>
      <circle cx="12" cy="7" r="4.3" />
      <circle cx="6.6" cy="13.6" r="4.3" />
      <circle cx="17.4" cy="13.6" r="4.3" />
      <path d="M12 12.5c0 3.4-1 6.1-3 7.9h6c-2-1.8-3-4.5-3-7.9Z" />
    </>
  ),
};

/** Shared SVG definitions: suit symbols and the card-back lattice. Rendered once per game. */
function ArtDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        {SUITS.map((s) => (
          <symbol key={s} id={`kl-${s}`} viewBox="0 0 24 24">
            {SUIT_PATHS[s]}
          </symbol>
        ))}
        <pattern id="kl-lattice" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill={C.back} />
          <path d="M0 0H10M0 0V10" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
        </pattern>
        <linearGradient id="kl-face-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={C.ivory} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SuitUse({ suit, x, y, size, rot }: { suit: Suit; x: number; y: number; size: number; rot?: boolean }) {
  return (
    <use
      href={`#kl-${suit}`}
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      transform={rot ? `rotate(180 ${x} ${y})` : undefined}
    />
  );
}

const PIPS: Record<number, [number, number][]> = {
  2: [[50, 42], [50, 98]],
  3: [[50, 42], [50, 70], [50, 98]],
  4: [[33, 42], [67, 42], [33, 98], [67, 98]],
  5: [[33, 42], [67, 42], [50, 70], [33, 98], [67, 98]],
  6: [[33, 42], [67, 42], [33, 70], [67, 70], [33, 98], [67, 98]],
  7: [[33, 42], [67, 42], [50, 56], [33, 70], [67, 70], [33, 98], [67, 98]],
  8: [[33, 42], [67, 42], [50, 56], [33, 70], [67, 70], [50, 84], [33, 98], [67, 98]],
  9: [[33, 42], [67, 42], [33, 61], [67, 61], [50, 70], [33, 79], [67, 79], [33, 98], [67, 98]],
  10: [[33, 42], [67, 42], [50, 52], [33, 61], [67, 61], [33, 79], [67, 79], [50, 88], [33, 98], [67, 98]],
};

const CardFace = memo(function CardFace({ suit, rank, compact }: { suit: Suit; rank: number; compact: boolean }) {
  const color = IS_RED[suit] ? C.red : C.ink;
  const label = RANK_LABEL[rank];
  const isCourt = rank > 10;
  const tint = IS_RED[suit] ? "rgba(192,38,58,0.07)" : "rgba(26,33,48,0.06)";
  return (
    <svg viewBox="0 0 100 140" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
      <rect x="0.8" y="0.8" width="98.4" height="138.4" rx="8" fill="url(#kl-face-sheen)" stroke={C.ivoryEdge} strokeWidth="1.6" />
      <g fill={color}>
        {compact ? (
          <>
            <text x="6" y="35" fontFamily={SERIF} fontWeight="700" fontSize="37" letterSpacing={label === "10" ? -4 : 0}>
              {label}
            </text>
            <SuitUse suit={suit} x={78} y={20} size={30} />
            {isCourt ? (
              <text x="50" y="118" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="62">
                {label}
              </text>
            ) : (
              <SuitUse suit={suit} x={50} y={92} size={rank === 1 ? 64 : 54} />
            )}
          </>
        ) : (
          <>
            <text x="7" y="27" fontFamily={SERIF} fontWeight="700" fontSize="27" letterSpacing={label === "10" ? -3 : 0}>
              {label}
            </text>
            <SuitUse suit={suit} x={83} y={16} size={19} />
            <g transform="rotate(180 50 70)">
              <text x="7" y="27" fontFamily={SERIF} fontWeight="700" fontSize="27" letterSpacing={label === "10" ? -3 : 0}>
                {label}
              </text>
              <SuitUse suit={suit} x={83} y={16} size={19} />
            </g>
            {rank === 1 && <SuitUse suit={suit} x={50} y={70} size={40} />}
            {rank > 1 && rank <= 10 &&
              PIPS[rank].map(([x, y], i) => <SuitUse key={i} suit={suit} x={x} y={y} size={17} rot={y > 70} />)}
            {isCourt && (
              <>
                <rect x="17" y="33" width="66" height="74" rx="3" fill={tint} stroke={color} strokeOpacity="0.5" strokeWidth="1.2" />
                <text x="50" y="84" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="44">
                  {label}
                </text>
                <SuitUse suit={suit} x={50} y={95} size={13} />
              </>
            )}
          </>
        )}
      </g>
    </svg>
  );
});

const CardBack = memo(function CardBack() {
  return (
    <svg viewBox="0 0 100 140" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
      <rect x="0.8" y="0.8" width="98.4" height="138.4" rx="8" fill="#ffffff" stroke={C.ivoryEdge} strokeWidth="1.6" />
      <rect x="7" y="7" width="86" height="126" rx="4" fill="url(#kl-lattice)" />
      <rect x="7" y="7" width="86" height="126" rx="4" fill="none" stroke={C.backDeep} strokeWidth="1.5" />
    </svg>
  );
});

/* ── Strings ────────────────────────────────────────────────────────────── */

type FlashKey =
  | "recycled" | "empty" | "sent" | "nothingHome" | "noUndo" | "undone" | "faceDown"
  | "kingOnly" | "badRun" | "wrongSuit" | "noFit" | "emptyColumn" | "nowhere";
type Flash = { key: FlashKey; n?: number } | null;
/* Rule errors are not spelled out on screen: the card returns to where it was, as in other solitaire games. Screen readers still hear them. */
const SILENT = new Set<FlashKey>(["faceDown", "kingOnly", "badRun", "wrongSuit", "noFit", "emptyColumn", "nowhere", "sent", "undone"]);

const messages = {
  en: {
    ...common.en,
    suits: { spades: "spades", hearts: "hearts", diamonds: "diamonds", clubs: "clubs" } as Record<Suit, string>,
    card: (rank: string, suit: string) => `${rank} of ${suit}`,
    faceDownCard: "Face down card",
    deck: (n: number) => `Deck, ${n} cards. Draw a card`,
    flash: {
      recycled: () => "Deck recycled. That costs 20 points.",
      empty: () => "The deck and the pile are both empty.",
      sent: (n: number) => `Sent ${n} card${n > 1 ? "s" : ""} home.`,
      nothingHome: () => "Nothing can go home yet.",
      noUndo: () => "No move to take back.",
      undone: () => "Move taken back.",
      faceDown: () => "That card is still face down.",
      kingOnly: () => "Only a king can start an empty column.",
      badRun: () => "Pick up a run that goes down in alternating colors.",
      wrongSuit: () => "That card does not follow this suit pile.",
      noFit: () => "That move does not fit there.",
      emptyColumn: () => "That column is empty.",
      nowhere: () => "That card has nowhere to go yet.",
    } as Record<FlashKey, (n: number) => string>,
    title: "Klondike Solitaire",
    play: "Play",
    hint: "Move all cards to the four piles, Ace to King by suit. Double-tap a card to send it up.",
    keys: "Keys: 1-7 columns, W waste, D draw, F send up, A collect, U undo, N new deal, Esc clears the selection.",
    cardsHome: "Cards home",
    wonTitle: "You win!",
    lostTitle: "No moves left",
    lost: "Undo a move or start a new deal.",
    bestWin: (n: number) => `Best: ${n}`,
    newBestWin: "New best!",
    recycle: "Recycle the pile",
    emptyPile: "Empty pile",
    foundation: (suit: string) => `${suit} foundation`,
    emptyCol: (n: number) => `Empty column ${n}`,
    collect: "Collect",
    finish: "Finish",
    undo: "Undo",
    newDeal: "New deal",
  },
  ko: {
    ...common.ko,
    suits: { spades: "스페이드", hearts: "하트", diamonds: "다이아몬드", clubs: "클럽" } as Record<Suit, string>,
    card: (rank: string, suit: string) => `${suit} ${rank}`,
    faceDownCard: "뒤집힌 카드",
    deck: (n: number) => `덱, ${n}장 남음. 누르면 한 장 넘깁니다`,
    flash: {
      recycled: () => "버린 카드를 다시 덱으로 돌렸습니다. 20점이 깎입니다.",
      empty: () => "덱에도 버린 자리에도 카드가 없습니다.",
      sent: (n: number) => `카드 ${n}장을 올렸습니다.`,
      nothingHome: () => "지금 올릴 수 있는 카드가 없습니다.",
      noUndo: () => "되돌릴 수가 없습니다.",
      undone: () => "한 수 되돌렸습니다.",
      faceDown: () => "아직 뒤집혀 있는 카드입니다.",
      kingOnly: () => "빈 열에는 킹만 놓을 수 있습니다.",
      badRun: () => "빨강과 검정이 번갈아 이어진 카드만 함께 옮길 수 있습니다.",
      wrongSuit: () => "여기에는 같은 무늬의 다음 숫자만 올릴 수 있습니다.",
      noFit: () => "그 자리에는 놓을 수 없습니다.",
      emptyColumn: () => "빈 열입니다.",
      nowhere: () => "그 카드는 아직 놓을 곳이 없습니다.",
    } as Record<FlashKey, (n: number) => string>,
    title: "클론다이크 솔리테어",
    play: "시작",
    hint: "모든 카드를 무늬별로 A부터 K까지 네 자리에 올리세요. 카드를 두 번 누르면 위로 올라갑니다.",
    keys: "키: 1~7 열, W 버린 카드, D 넘기기, F 올리기, A 모두 올리기, U 되돌리기, N 새 판, Esc 선택 해제.",
    cardsHome: "올린 카드",
    wonTitle: "승리!",
    lostTitle: "둘 곳이 없습니다",
    lost: "한 수 되돌리거나 새 판을 시작하세요.",
    bestWin: (n: number) => `최고 기록: ${n}`,
    newBestWin: "최고 기록!",
    recycle: "버린 카드 다시 쌓기",
    emptyPile: "빈 더미",
    foundation: (suit: string) => `${suit} 올리는 자리`,
    emptyCol: (n: number) => `${n}번 빈 열`,
    collect: "모두 올리기",
    finish: "마무리",
    undo: "되돌리기",
    newDeal: "새 판",
  },
};

/* ── Small UI pieces ────────────────────────────────────────────────────── */

function ActionIcon({ name }: { name: "undo" | "collect" | "deal" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      {name === "undo" && (
        <>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </>
      )}
      {name === "collect" && (
        <>
          <rect x="6" y="11" width="12" height="9" rx="1.5" />
          <path d="M12 3v6M9 6l3-3 3 3" />
        </>
      )}
      {name === "deal" && (
        <>
          <rect x="3" y="6" width="10" height="14" rx="1.5" />
          <path d="M16 4.5l4 1.2-3.2 11" />
          <path d="M13 3.5h3" />
        </>
      )}
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col leading-none">
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.75)" }}>
        {label}
      </span>
      <span className="mt-1 text-lg font-bold tabular-nums" style={{ color: C.ivory }}>
        {value}
      </span>
    </div>
  );
}

function BrassButton({ onClick, children, big }: { onClick: () => void; children: ReactNode; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md font-bold transition-[filter,transform] duration-100 hover:brightness-105 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 ${
        big ? "px-12 py-3.5 text-xl" : "px-7 py-2.5 text-base"
      }`}
      style={{ background: C.button, color: C.ink, boxShadow: "0 4px 0 #b8941a" }}
    >
      {children}
    </button>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-6 py-2.5 text-base font-semibold transition-colors duration-150 hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
      style={{ borderColor: C.slotLine, color: C.ivory }}
    >
      {children}
    </button>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/* ── Game ───────────────────────────────────────────────────────────────── */

interface DragState {
  from: Exclude<Selection, null>;
  ids: string[];
  dx: number;
  dy: number;
  hover: Target | null;
}

interface Press {
  id: string;
  loc: Loc;
  sx: number;
  sy: number;
  pointerId: number;
  dragging: boolean;
  from: Selection;
  ids: string[];
}

const targetKey = (t: Target) => (t.kind === "foundation" ? `f${t.index}` : `t${t.col}`);

export default function KlondikeSolitaire() {
  const m = useMessages(messages);
  const { play } = useSound();
  const reduced = usePrefersReducedMotion();
  const { best, record } = useBestScore("ctrlcat-klondike-solitaire-best");

  const [game, setGame] = useState<Game>({
    board: EMPTY_BOARD,
    score: 0,
    moves: 0,
    phase: "idle",
    history: [],
  });
  const [sel, setSel] = useState<Selection>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [newBest, setNewBest] = useState(false);
  const [dealStage, setDealStage] = useState<0 | 1 | 2>(2);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [flying, setFlying] = useState<Set<string>>(() => new Set());
  const [elapsed, setElapsed] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [portal, setPortal] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef(game);
  const selRef = useRef(sel);
  const dealRef = useRef(dealStage);
  const startRef = useRef(0);
  const collectTimer = useRef<number | null>(null);
  gameRef.current = game;
  selRef.current = sel;
  dealRef.current = dealStage;
  usePhaseEvents(game.phase, { score: game.score });


  /* Measure the stage. */
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setPortal(!!el.closest(".portal-stage"));
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = useMemo(() => computeLayout(size.w, size.h, portal), [size.w, size.h, portal]);
  const layoutRef = useRef(L);
  layoutRef.current = L;

  const stopCollect = () => {
    if (collectTimer.current !== null) {
      window.clearTimeout(collectTimer.current);
      collectTimer.current = null;
    }
  };

  const commit = useCallback((next: Game, message: Flash) => {
    gameRef.current = next;
    setGame(next);
    setFlash(message);
  }, []);

  const startGame = useCallback(() => {
    stopCollect();
    const next: Game = {
      board: dealBoard(),
      score: 0,
      moves: 0,
      phase: "playing",
      history: [],
    };
    gameRef.current = next;
    setGame(next);
    setSel(null);
    setFlash(null);
    setDrag(null);
    setNewBest(false);
    setElapsed(0);
    startRef.current = Date.now();
    setDealStage(reduced ? 2 : 0);
    dealRef.current = reduced ? 2 : 0;
  }, [reduced]);

  /* Deal animation: stacked on the deck, then fly out one by one. */
  useEffect(() => {
    if (dealStage === 0) {
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setDealStage(1));
      });
      play("draw");
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    if (dealStage === 1) {
      const t = window.setTimeout(() => {
        setDealStage(2);
        startRef.current = Date.now();
      }, 28 * DEAL_STEP + MOVE_MS + 200);
      return () => window.clearTimeout(t);
    }
  }, [dealStage, play]);

  /* Clock. */
  useEffect(() => {
    if (game.phase !== "playing" || dealStage !== 2) return;
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [game.phase, dealStage]);

  /* Round end effects. */
  const prevPhase = useRef(game.phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = game.phase;
    if (prev === game.phase) return;
    if (game.phase === "won") {
      stopCollect();
      setSel(null);
      setDrag(null);
      setNewBest(record(game.score));
      play("win");
    } else if (game.phase === "lost") {
      stopCollect();
      setSel(null);
      setDrag(null);
      play("lose");
    }
  }, [game.phase, game.score, play, record]);

  const attemptMove = useCallback(
    (from: Selection, target: Target, silent = false): boolean => {
      const current = gameRef.current;
      if (current.phase !== "playing" || !from) return false;
      if (!canMove(current.board, from, target)) return false;
      const board = cloneBoard(current.board);
      const cards = selectedCards(board, from) as Card[];

      let delta = 0;
      if (from.zone === "waste") {
        board.waste.pop();
        delta += target.kind === "foundation" ? 10 : 5;
      } else if (from.zone === "foundation") {
        board.foundations[from.index].pop();
        delta -= 15;
      } else {
        const pile = board.tableau[from.col];
        pile.splice(from.index);
        const revealed = pile[pile.length - 1];
        if (revealed && !revealed.up) {
          revealed.up = true;
          delta += 5;
        }
        if (target.kind === "foundation") delta += 10;
      }

      if (target.kind === "foundation") board.foundations[target.index].push(cards[0]);
      else board.tableau[target.col].push(...cards);

      commit(advance(current, board, delta), null);
      setSel(null);
      if (!silent) play(target.kind === "foundation" ? "correct" : "place");
      return true;
    },
    [commit, play],
  );

  const sendToFoundation = useCallback(
    (from: Selection, silent = false): boolean => {
      for (let i = 0; i < 4; i++) {
        if (attemptMove(from, { kind: "foundation", index: i }, silent)) return true;
      }
      return false;
    },
    [attemptMove],
  );

  /** Double-tap: send home if possible, otherwise to the first column that takes it. */
  const quickMove = useCallback(
    (from: Selection): boolean => {
      if (!from) return false;
      if (sendToFoundation(from)) return true;
      const board = gameRef.current.board;
      const order = [0, 1, 2, 3, 4, 5, 6].sort(
        (a, b) => Number(board.tableau[a].length === 0) - Number(board.tableau[b].length === 0),
      );
      for (const col of order) {
        if (from.zone === "tableau" && from.index === 0 && board.tableau[col].length === 0) continue;
        if (attemptMove(from, { kind: "tableau", col })) return true;
      }
      return false;
    },
    [attemptMove, sendToFoundation],
  );

  const draw = useCallback(() => {
    const current = gameRef.current;
    if (current.phase !== "playing") return;
    const board = cloneBoard(current.board);
    setSel(null);
    if (board.stock.length > 0) {
      const card = board.stock.pop() as Card;
      card.up = true;
      board.waste.push(card);
      commit(advance(current, board, 0), null);
      play("draw");
      return;
    }
    if (board.waste.length > 0) {
      board.stock = board.waste.reverse().map((c) => ({ ...c, up: false }));
      board.waste = [];
      commit(advance(current, board, -20), { key: "recycled" });
      play("place");
      return;
    }
    setFlash({ key: "empty" });
  }, [commit, play]);

  const collectStep = useCallback((): boolean => {
    if (gameRef.current.phase !== "playing") return false;
    if (sendToFoundation({ zone: "waste" }, true)) return true;
    for (let col = 0; col < 7; col++) {
      const pile = gameRef.current.board.tableau[col];
      if (pile.length === 0) continue;
      if (sendToFoundation({ zone: "tableau", col, index: pile.length - 1 }, true)) return true;
    }
    return false;
  }, [sendToFoundation]);

  const autoCollect = useCallback(() => {
    if (gameRef.current.phase !== "playing" || collectTimer.current !== null) return;
    if (reduced) {
      let moved = 0;
      while (collectStep()) moved++;
      if (moved) play("correct");
      if (gameRef.current.phase === "playing") setFlash(moved > 0 ? { key: "sent", n: moved } : { key: "nothingHome" });
      return;
    }
    let moved = 0;
    const tick = () => {
      collectTimer.current = null;
      if (collectStep()) {
        moved++;
        play("place");
        collectTimer.current = window.setTimeout(tick, 120);
        return;
      }
      if (gameRef.current.phase === "playing") setFlash(moved > 0 ? { key: "sent", n: moved } : { key: "nothingHome" });
    };
    tick();
  }, [collectStep, play, reduced]);

  const undo = useCallback(() => {
    stopCollect();
    const current = gameRef.current;
    const last = current.history[current.history.length - 1];
    if (!last) {
      setFlash({ key: "noUndo" });
      return;
    }
    const next: Game = {
      board: last.board,
      score: last.score,
      moves: last.moves,
      phase: "playing",
      history: current.history.slice(0, -1),
    };
    gameRef.current = next;
    setGame(next);
    setSel(null);
    setFlash({ key: "undone" });
  }, []);

  const clickTableau = useCallback(
    (col: number, index: number) => {
      const current = gameRef.current;
      if (current.phase !== "playing") return;
      const pile = current.board.tableau[col];
      const card = pile[index];
      const active = selRef.current;

      if (card && !card.up) {
        setFlash({ key: "faceDown" });
        return;
      }
      if (active && sameSpot(active, { zone: "tableau", col, index })) {
        setSel(null);
        return;
      }
      if (active && attemptMove(active, { kind: "tableau", col })) return;
      if (!card) {
        setFlash(active ? { key: "kingOnly" } : null);
        setSel(null);
        return;
      }
      const run = pile.slice(index);
      if (!isRun(run)) {
        setFlash({ key: "badRun" });
        return;
      }
      setSel({ zone: "tableau", col, index });
      setFlash(null);
    },
    [attemptMove],
  );

  const clickWaste = useCallback(() => {
    const current = gameRef.current;
    if (current.phase !== "playing") return;
    if (current.board.waste.length === 0) return;
    const active = selRef.current;
    if (active && active.zone === "waste") {
      setSel(null);
      return;
    }
    setSel({ zone: "waste" });
    setFlash(null);
  }, []);

  const clickFoundation = useCallback(
    (index: number) => {
      const current = gameRef.current;
      if (current.phase !== "playing") return;
      const active = selRef.current;
      if (active && !sameSpot(active, { zone: "foundation", index })) {
        if (attemptMove(active, { kind: "foundation", index })) return;
        setFlash({ key: "wrongSuit" });
        return;
      }
      if (active && active.zone === "foundation" && active.index === index) {
        setSel(null);
        return;
      }
      if (current.board.foundations[index].length === 0) return;
      setSel({ zone: "foundation", index });
      setFlash(null);
    },
    [attemptMove],
  );

  const selectColumnRun = useCallback(
    (col: number) => {
      const current = gameRef.current;
      if (current.phase !== "playing") return;
      const active = selRef.current;
      if (active && attemptMove(active, { kind: "tableau", col })) return;
      const pile = current.board.tableau[col];
      const start = runStart(pile);
      if (start === null) {
        setFlash(active ? { key: "noFit" } : { key: "emptyColumn" });
        return;
      }
      setSel({ zone: "tableau", col, index: start });
      setFlash(null);
    },
    [attemptMove],
  );

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 2600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => () => stopCollect(), []);

  /* Keyboard. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      const phase = gameRef.current.phase;
      if (phase === "idle" || phase === "won" || phase === "lost") {
        if (key === "Enter" || key === " " || key === "n") {
          event.preventDefault();
          if (phase === "idle") startGame();
          else afterBreak(startGame);
        } else if (key === "u" && phase === "lost") {
          event.preventDefault();
          undo();
        }
        return;
      }
      if (dealRef.current !== 2) return;
      if (key >= "1" && key <= "7") {
        event.preventDefault();
        selectColumnRun(Number(key) - 1);
        return;
      }
      switch (key) {
        case " ":
        case "d":
          event.preventDefault();
          draw();
          break;
        case "w":
          event.preventDefault();
          clickWaste();
          break;
        case "f":
          event.preventDefault();
          if (!sendToFoundation(selRef.current)) setFlash({ key: "nowhere" });
          break;
        case "a":
          event.preventDefault();
          autoCollect();
          break;
        case "u":
          event.preventDefault();
          undo();
          break;
        case "n":
          event.preventDefault();
          startGame();
          break;
        case "Escape":
          event.preventDefault();
          setSel(null);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoCollect, clickWaste, draw, selectColumnRun, sendToFoundation, startGame, undo]);

  const { board, score, moves, phase } = game;

  /* Where every card sits. */
  const mode: Mode = phase === "won" ? "won" : dealStage === 0 ? "stacked" : dealStage === 1 ? "dealing" : "normal";
  const positions = useMemo(() => computePositions(board, L, mode), [board, L, mode]);
  const posRef = useRef(positions);
  posRef.current = positions;

  const locs = useMemo(() => {
    const out: Record<string, Loc> = {};
    board.stock.forEach((c) => (out[c.id] = { zone: "stock" }));
    board.waste.forEach((c, i) => (out[c.id] = { zone: "waste", top: i === board.waste.length - 1 }));
    board.foundations.forEach((pile, f) =>
      pile.forEach((c, i) => (out[c.id] = { zone: "foundation", index: f, top: i === pile.length - 1 })),
    );
    board.tableau.forEach((pile, col) => pile.forEach((c, index) => (out[c.id] = { zone: "tableau", col, index })));
    return out;
  }, [board]);

  /* Cards that changed pile ride above the others while they travel. */
  const prevLocs = useRef<Record<string, string>>({});
  useLayoutEffect(() => {
    const now: Record<string, string> = {};
    const moved = new Set<string>();
    for (const id in locs) {
      const l = locs[id];
      const key = l.zone === "tableau" ? `t${l.col}` : l.zone === "foundation" ? `f${l.index}` : l.zone;
      now[id] = key;
      if (prevLocs.current[id] && prevLocs.current[id] !== key) moved.add(id);
    }
    prevLocs.current = now;
    if (moved.size === 0) return;
    setFlying(moved);
    const t = window.setTimeout(() => setFlying(new Set()), MOVE_MS + 120);
    return () => window.clearTimeout(t);
  }, [locs]);

  /* Win celebration: once the garland forms, a ripple keeps running around it. */
  useEffect(() => {
    if (phase !== "won" || reduced) return;
    const el = layerRef.current;
    if (!el) return;
    const anims: Animation[] = [];
    const inner = el.querySelectorAll<HTMLElement>("[data-ring]");
    inner.forEach((node) => {
      if (typeof node.animate !== "function") return;
      const n = Number(node.dataset.ring);
      anims.push(
        node.animate(
          [
            { transform: "translateY(0) scale(1)", offset: 0 },
            { transform: "translateY(-14%) scale(1.06)", offset: 0.1 },
            { transform: "translateY(0) scale(1)", offset: 0.22 },
            { transform: "translateY(0) scale(1)", offset: 1 },
          ],
          { duration: WAVE_MS, delay: WIN_DELAY(12) + MOVE_MS + 300 + (n * WAVE_MS) / 52, iterations: Infinity, easing: "ease-in-out" },
        ),
      );
    });
    return () => anims.forEach((a) => a.cancel());
  }, [phase, reduced]);

  /* Legal targets for the current selection or drag. */
  const activeFrom: Selection = drag ? drag.from : sel;
  const targets = useMemo(() => {
    if (!activeFrom || phase !== "playing") return [] as Target[];
    const out: Target[] = [];
    for (let i = 0; i < 4; i++) {
      const t: Target = { kind: "foundation", index: i };
      if (canMove(board, activeFrom, t)) out.push(t);
    }
    for (let col = 0; col < 7; col++) {
      const t: Target = { kind: "tableau", col };
      if (canMove(board, activeFrom, t)) out.push(t);
    }
    return out;
  }, [activeFrom, board, phase]);

  const targetRect = (t: Target) => {
    if (t.kind === "foundation") return { x: colX(L, 3 + t.index), y: L.topY };
    const pile = board.tableau[t.col];
    if (pile.length === 0) return { x: colX(L, t.col), y: L.tabY };
    const p = positions[pile[pile.length - 1].id];
    return { x: p.x, y: p.y };
  };

  /* Pointer: tap, double-tap and drag. */
  const pressRef = useRef<Press | null>(null);
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const dragRaf = useRef(0);
  const dragLatest = useRef<DragState | null>(null);

  const selectionFor = (loc: Loc): Selection => {
    const b = gameRef.current.board;
    if (loc.zone === "waste") return loc.top ? { zone: "waste" } : null;
    if (loc.zone === "foundation") return loc.top ? { zone: "foundation", index: loc.index } : null;
    if (loc.zone === "tableau") {
      const run = b.tableau[loc.col].slice(loc.index);
      return isRun(run) ? { zone: "tableau", col: loc.col, index: loc.index } : null;
    }
    return null;
  };

  const tap = (id: string, loc: Loc, allowDouble: boolean) => {
    if (gameRef.current.phase !== "playing" || dealRef.current !== 2) return;
    const now = performance.now();
    if (allowDouble && lastTap.current && lastTap.current.id === id && now - lastTap.current.t < 380) {
      lastTap.current = null;
      if (quickMove(selectionFor(loc))) return;
    }
    lastTap.current = { id, t: now };
    if (loc.zone === "stock") draw();
    else if (loc.zone === "waste") {
      if (loc.top) clickWaste();
    } else if (loc.zone === "foundation") clickFoundation(loc.index);
    else clickTableau(loc.col, loc.index);
  };

  const hitTarget = (d: DragState, legalOnly: boolean): { best: Target | null; overAny: boolean } => {
    const Lc = layoutRef.current;
    const b = gameRef.current.board;
    const lead = posRef.current[d.ids[0]];
    if (!lead) return { best: null, overAny: false };
    const rx = lead.x + d.dx;
    const ry = lead.y + d.dy;
    const overlap = (x: number, y: number, w: number, h: number) =>
      Math.max(0, Math.min(rx + Lc.cw, x + w) - Math.max(rx, x)) *
      Math.max(0, Math.min(ry + Lc.ch, y + h) - Math.max(ry, y));
    const cands: { t: Target; a: number }[] = [];
    for (let i = 0; i < 4; i++) cands.push({ t: { kind: "foundation", index: i }, a: overlap(colX(Lc, 3 + i), Lc.topY, Lc.cw, Lc.ch) });
    for (let col = 0; col < 7; col++) {
      if (d.from.zone === "tableau" && d.from.col === col) continue;
      const offs = colOffsets(b.tableau[col], Lc);
      const bottom = Lc.tabY + (offs[offs.length - 1] ?? 0) + Lc.ch;
      cands.push({ t: { kind: "tableau", col }, a: overlap(colX(Lc, col), Lc.tabY, Lc.cw, bottom - Lc.tabY) });
    }
    cands.sort((p, q) => q.a - p.a);
    const overAny = cands.some((c) => c.a > 0);
    for (const c of cands) {
      if (c.a <= 0) break;
      if (!legalOnly || canMove(b, d.from, c.t)) return { best: c.t, overAny };
    }
    return { best: null, overAny };
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || pressRef.current) return;
    if (gameRef.current.phase !== "playing" || dealRef.current !== 2) return;
    const loc = locs[id];
    if (!loc) return;
    const from = selectionFor(loc);
    let ids: string[] = [];
    if (from) {
      const cards = selectedCards(gameRef.current.board, from);
      ids = cards ? cards.map((c) => c.id) : [];
    }
    pressRef.current = { id, loc, sx: e.clientX, sy: e.clientY, pointerId: e.pointerId, dragging: false, from, ids };
    const threshold = e.pointerType === "mouse" ? 5 : 9;

    const move = (ev: PointerEvent) => {
      const p = pressRef.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      const dx = ev.clientX - p.sx;
      const dy = ev.clientY - p.sy;
      if (!p.dragging) {
        if (Math.hypot(dx, dy) < threshold || !p.from || p.ids.length === 0) return;
        p.dragging = true;
        stopCollect();
        setSel(null);
      }
      ev.preventDefault();
      const d: DragState = { from: p.from as Exclude<Selection, null>, ids: p.ids, dx, dy, hover: null };
      d.hover = hitTarget(d, true).best;
      dragLatest.current = d;
      if (!dragRaf.current) {
        dragRaf.current = requestAnimationFrame(() => {
          dragRaf.current = 0;
          setDrag(dragLatest.current);
        });
      }
    };
    const up = (ev: PointerEvent) => {
      const p = pressRef.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      pressRef.current = null;
      if (dragRaf.current) {
        cancelAnimationFrame(dragRaf.current);
        dragRaf.current = 0;
      }
      if (!p.dragging) {
        if (ev.type === "pointerup") tap(p.id, p.loc, true);
        return;
      }
      const d: DragState = {
        from: p.from as Exclude<Selection, null>,
        ids: p.ids,
        dx: ev.clientX - p.sx,
        dy: ev.clientY - p.sy,
        hover: null,
      };
      dragLatest.current = null;
      const hit = hitTarget(d, true);
      setDrag(null);
      if (ev.type === "pointerup" && hit.best && attemptMove(d.from, hit.best)) return;
      if (hit.overAny) {
        play("wrong");
        setFlash({ key: "noFit" });
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  const ready = size.w > 0 && size.h > 0;
  const dragIds = drag ? new Set(drag.ids) : null;
  const moveMs = reduced ? 0 : MOVE_MS;
  const radius = Math.round(L.cw * 0.08);
  const autoFinish = phase === "playing" && canAutoFinish(board);
  const inRound = phase === "playing" && dealStage === 2;

  const slotStyle = (x: number, y: number): CSSProperties => ({
    width: L.cw,
    height: L.ch,
    transform: `translate(${x}px, ${y}px)`,
    borderRadius: radius,
    background: C.slot,
    boxShadow: `inset 0 0 0 1.5px ${C.slotLine}`,
  });

  const actions = (
    <>
      <ActionButton icon="undo" label={m.undo} onClick={undo} disabled={!inRound || game.history.length === 0} inHud={L.actionsInHud} />
      <ActionButton icon="collect" label={autoFinish ? m.finish : m.collect} onClick={autoCollect} disabled={!inRound} inHud={L.actionsInHud} glow={autoFinish} />
      <ActionButton icon="deal" label={m.newDeal} onClick={startGame} disabled={phase !== "playing"} inHud={L.actionsInHud} />
    </>
  );

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-[360px] w-full select-none overflow-hidden font-game"
      style={{ background: FELT_BG, color: C.ivory, WebkitTapHighlightColor: "transparent" }}
    >
      <ArtDefs />

      {ready && phase === "idle" && <Intro w={L.w} h={L.h} onPlay={startGame} />}

      {ready && phase !== "idle" && (
        <>
          {/* HUD */}
          <div
            className="absolute left-0 right-0 top-0 z-[3000] flex items-center gap-5"
            style={{ height: L.hudH, paddingLeft: L.padL, paddingRight: L.padR }}
          >
            <Stat label={m.score} value={score} />
            <Stat label={m.moves} value={moves} />
            <Stat label={m.time} value={formatTime(elapsed)} />
            {L.actionsInHud && <div className="ml-auto flex items-center gap-2">{actions}</div>}
          </div>

          {/* Empty pile slots */}
          <div className="absolute inset-0" style={{ opacity: phase === "won" ? 0 : 1, transition: "opacity 400ms ease" }}>
            <button
              type="button"
              aria-label={board.stock.length ? m.deck(board.stock.length) : m.recycle}
              onClick={draw}
              disabled={!inRound}
              className="absolute left-0 top-0 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              style={slotStyle(colX(L, 0), L.topY)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={C.brass} strokeWidth="1.75" strokeLinecap="round" style={{ width: L.cw * 0.42, height: L.cw * 0.42, opacity: 0.8 }} aria-hidden="true">
                <path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2" />
                <path d="M18 3v3h-3M6 21v-3h3" />
              </svg>
            </button>
            <div aria-hidden="true" className="absolute left-0 top-0" style={slotStyle(colX(L, 1), L.topY)} />
            {SUITS.map((s, i) => (
              <button
                key={s}
                type="button"
                aria-label={m.foundation(m.suits[s])}
                onClick={() => clickFoundation(i)}
                className="absolute left-0 top-0 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={slotStyle(colX(L, 3 + i), L.topY)}
              >
                <svg viewBox="0 0 24 24" fill={C.brass} style={{ width: L.cw * 0.46, height: L.cw * 0.46, opacity: 0.35 }} aria-hidden="true">
                  {SUIT_PATHS[s]}
                </svg>
              </button>
            ))}
            {board.tableau.map((pile, col) => (
              <button
                key={col}
                type="button"
                aria-label={m.emptyCol(col + 1)}
                onClick={() => clickTableau(col, 0)}
                tabIndex={pile.length ? -1 : 0}
                className="absolute left-0 top-0 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={slotStyle(colX(L, col), L.tabY)}
              >
                <span style={{ fontFamily: SERIF, fontSize: L.cw * 0.42, color: C.brass, opacity: 0.3, fontWeight: 700 }} aria-hidden="true">
                  K
                </span>
              </button>
            ))}
          </div>

          {/* Cards */}
          <div ref={layerRef} className="absolute inset-0">
            {Object.keys(positions).map((id) => {
              const p = positions[id];
              const card = cardById(board, id);
              if (!card) return null;
              const loc = locs[id];
              const dragged = !!dragIds?.has(id);
              const selected =
                !!sel &&
                !!loc &&
                ((sel.zone === "waste" && loc.zone === "waste" && loc.top) ||
                  (sel.zone === "foundation" && loc.zone === "foundation" && loc.index === sel.index && loc.top) ||
                  (sel.zone === "tableau" && loc.zone === "tableau" && loc.col === sel.col && loc.index >= sel.index));
              let x = p.x;
              let y = p.y;
              let z = p.z;
              if (dragged && drag) {
                x += drag.dx;
                y += drag.dy;
                z = 5000 + p.z;
              } else if (flying.has(id)) z = 2000 + p.z;
              if (selected) y -= Math.max(2, Math.round(L.ch * 0.03));
              const lift = dragged ? " scale(1.05)" : "";
              const buried =
                (loc?.zone === "stock" && card !== board.stock[board.stock.length - 1]) ||
                (loc?.zone === "foundation" && !loc.top && phase !== "won") ||
                (loc?.zone === "waste" && board.waste.indexOf(card) < board.waste.length - 3);
              const shadow = dragged
                ? "0 18px 30px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.3)"
                : selected
                  ? `0 0 0 3px ${C.glow}, 0 6px 12px rgba(0,0,0,0.35)`
                  : buried && !flying.has(id)
                    ? "none"
                    : "0 1px 1.5px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.18)";
              const noAnim = dragged || mode === "stacked" || reduced;
              const label = card.up || p.up ? m.card(RANK_LABEL[card.rank], m.suits[card.suit]) : loc?.zone === "stock" ? m.deck(board.stock.length) : m.faceDownCard;
              const interactive = inRound && !(loc?.zone === "waste" && !loc.top) && !(loc?.zone === "foundation" && !loc.top);
              return (
                <button
                  key={id}
                  type="button"
                  tabIndex={interactive && (p.up || loc?.zone === "stock") ? 0 : -1}
                  aria-label={label}
                  aria-pressed={selected || undefined}
                  onPointerDown={(e) => onPointerDown(e, id)}
                  onClick={(e) => {
                    if (e.detail === 0 && loc) tap(id, loc, false);
                  }}
                  className="absolute left-0 top-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{
                    width: L.cw,
                    height: L.ch,
                    zIndex: z,
                    borderRadius: radius,
                    transform: `translate3d(${x}px, ${y}px, 0) rotate(${p.rot}deg)${lift}`,
                    transition: noAnim
                      ? "none"
                      : `transform ${moveMs}ms ${EASE} ${p.delay}ms, box-shadow 150ms ease`,
                    boxShadow: shadow,
                    touchAction: "none",
                    cursor: inRound ? (dragged ? "grabbing" : "pointer") : "default",
                    perspective: L.cw * 6,
                    pointerEvents: inRound ? "auto" : "none",
                  }}
                >
                  <div className="h-full w-full" data-ring={phase === "won" ? ringIndex(card) : undefined}>
                  <div
                    className="relative h-full w-full"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: p.up ? "rotateY(0deg)" : "rotateY(180deg)",
                      transition: noAnim && !dragged ? "none" : `transform ${reduced ? 0 : 340}ms ease ${p.flipDelay}ms`,
                    }}
                  >
                    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                      <CardFace suit={card.suit} rank={card.rank} compact={L.compact} />
                    </div>
                    <div
                      className="absolute inset-0"
                      style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                      <CardBack />
                    </div>
                  </div>
                  </div>
                </button>
              );
            })}

            {/* Valid drop targets */}
            {targets.map((t) => {
              const r = targetRect(t);
              const hot = !!drag?.hover && targetKey(drag.hover) === targetKey(t);
              return (
                <div
                  key={targetKey(t)}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0"
                  style={{
                    width: L.cw,
                    height: L.ch,
                    zIndex: 4000,
                    borderRadius: radius,
                    transform: `translate(${r.x}px, ${r.y}px)`,
                    boxShadow: hot
                      ? `0 0 0 3px ${C.glow}`
                      : `0 0 0 2px rgba(255,210,63,0.7)`,
                    background: hot ? "rgba(255,210,63,0.18)" : "transparent",
                    transition: "box-shadow 120ms ease, background 120ms ease",
                  }}
                />
              );
            })}
          </div>

          {/* Bottom action bar on narrow screens */}
          {!L.actionsInHud && (
            <div
              className="absolute bottom-0 left-0 right-0 z-[3000] flex items-stretch justify-center gap-2 px-3 pb-2 pt-1"
              style={{ height: L.barH }}
            >
              {actions}
            </div>
          )}

          {/* Toast */}
          <div
            className="pointer-events-none absolute left-0 right-0 z-[6000] flex justify-center px-4"
            style={{ bottom: L.barH + 14 }}
            role="status"
            aria-live="polite"
          >
            {flash && SILENT.has(flash.key) && <span className="sr-only">{m.flash[flash.key](flash.n ?? 0)}</span>}
            {flash && !SILENT.has(flash.key) && (
              <div
                key={`${flash.key}-${flash.n ?? 0}`}
                className="max-w-md rounded-md px-4 py-2 text-center text-sm font-medium animate-slide-up"
                style={{ background: "rgba(0,0,0,0.7)", color: C.ivory }}
              >
                {m.flash[flash.key](flash.n ?? 0)}
              </div>
            )}
          </div>

          {/* Round end */}
          {(phase === "won" || phase === "lost") && (
            <div
              className="absolute inset-0 z-[7000] flex items-center justify-center p-4"
              style={{ background: phase === "lost" ? "rgba(3,20,15,0.55)" : "transparent" }}
            >
              <div
                className="flex w-full max-w-[19rem] flex-col items-center gap-4 rounded-lg px-6 py-6 text-center animate-slide-up"
                style={{
                  background: C.panel,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
                  animationDelay: phase === "won" && !reduced ? "900ms" : undefined,
                  animationFillMode: "both",
                }}
              >
                <h2 className="text-4xl font-bold leading-none" style={{ color: C.ivory }}>
                  {phase === "won" ? m.wonTitle : m.lostTitle}
                </h2>
                {phase === "lost" && (
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {m.lost}
                  </p>
                )}
                <div className="grid w-full grid-cols-3 gap-2 rounded-md py-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="flex justify-center"><Stat label={m.score} value={score} /></div>
                  <div className="flex justify-center"><Stat label={m.moves} value={moves} /></div>
                  <div className="flex justify-center">
                    {phase === "won" ? <Stat label={m.time} value={formatTime(elapsed)} /> : <Stat label={m.cardsHome} value={collected(board)} />}
                  </div>
                </div>
                {phase === "won" && (newBest || best !== null) && (
                  <p className="text-xs font-semibold" style={{ color: C.glow }}>
                    {newBest ? m.newBestWin : m.bestWin(best ?? 0)}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {phase === "lost" && <GhostButton onClick={undo}>{m.undo}</GhostButton>}
                  <BrassButton onClick={() => afterBreak(startGame)}>{phase === "won" ? m.playAgain : m.newDeal}</BrassButton>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ringIndex(card: Card): number {
  return SUITS.indexOf(card.suit) * 13 + card.rank - 1;
}

function cardById(board: Board, id: string): Card | undefined {
  for (const pile of [board.stock, board.waste, ...board.foundations, ...board.tableau]) {
    for (const c of pile) if (c.id === id) return c;
  }
  return undefined;
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  inHud,
  glow,
}: {
  icon: "undo" | "collect" | "deal";
  label: string;
  onClick: () => void;
  disabled?: boolean;
  inHud: boolean;
  glow?: boolean;
}) {
  const style: CSSProperties = glow
    ? { background: C.button, color: C.ink }
    : { background: "rgba(0,0,0,0.25)", color: C.ivory };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex items-center justify-center font-semibold transition-all duration-150 hover:brightness-125 active:scale-95 disabled:opacity-40 disabled:hover:brightness-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        inHud ? "h-10 gap-2 rounded-md px-4 text-sm" : "max-w-[8.5rem] flex-1 flex-col gap-1 rounded-md text-xs"
      }`}
      style={style}
    >
      <ActionIcon name={icon} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/* ── Title screen ───────────────────────────────────────────────────────── */

const INTRO_FAN: { suit: Suit; rank: number }[] = [
  { suit: "clubs", rank: 11 },
  { suit: "diamonds", rank: 12 },
  { suit: "spades", rank: 1 },
  { suit: "hearts", rank: 13 },
];

function Intro({ w, h, onPlay }: { w: number; h: number; onPlay: () => void }) {
  const m = useMessages(messages);
  const reduced = usePrefersReducedMotion();
  const cw = Math.round(Math.max(58, Math.min(112, w * 0.17, h * 0.15)));
  const ch = Math.round(cw * 1.4);
  const fanRef = useRef<HTMLDivElement>(null);
  const titleSize = Math.round(Math.max(30, Math.min(60, w * 0.08, h * 0.09)));

  useEffect(() => {
    const el = fanRef.current;
    if (!el || reduced || typeof el.animate !== "function") return;
    const kids = Array.from(el.children) as HTMLElement[];
    const anims = kids.map((k, i) =>
      k.animate(
        [
          { transform: "translate(0px, 40px) rotate(0deg)", opacity: 0 },
          { transform: k.style.transform, opacity: 1 },
        ],
        { duration: 600, delay: 120 + i * 90, easing: "cubic-bezier(0.2, 0.8, 0.25, 1)", fill: "backwards" },
      ),
    );
    return () => anims.forEach((a) => a.cancel());
  }, [reduced]);

  const n = INTRO_FAN.length + 1;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 pb-4 pt-14 text-center animate-fade-in">
      <div ref={fanRef} className="relative" style={{ width: cw * 2.6, height: ch * 1.12 }}>
        {[...INTRO_FAN, null].map((c, i) => {
          const a = (i - (n - 1) / 2) * 13;
          const style: CSSProperties = {
            width: cw,
            height: ch,
            left: cw * 0.8,
            top: ch * 0.06,
            transformOrigin: "50% 120%",
            transform: `translate(${(i - (n - 1) / 2) * cw * 0.12}px, ${Math.abs(i - (n - 1) / 2) * 4}px) rotate(${a}deg)`,
            borderRadius: Math.round(cw * 0.08),
            boxShadow: "0 10px 24px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
          };
          return (
            <div key={i} className="absolute overflow-hidden" style={style}>
              {c ? <CardFace suit={c.suit} rank={c.rank} compact={false} /> : <CardBack />}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col items-center">
        <h1 className="font-bold leading-tight" style={{ fontSize: titleSize, color: C.ivory, textShadow: "0 2px 0 rgba(0,0,0,0.25)" }}>
          {m.title}
        </h1>
      </div>
      <BrassButton onClick={onPlay} big>
        {m.play}
      </BrassButton>
      <p className="max-w-sm text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)", wordBreak: "keep-all" }}>
        {m.hint}
      </p>
      {w >= 600 && (
        <p className="max-w-md text-xs" style={{ color: "rgba(255,255,255,0.6)", wordBreak: "keep-all" }}>
          {m.keys}
        </p>
      )}
    </div>
  );
}
