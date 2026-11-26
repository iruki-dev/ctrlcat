import { useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "../../i18n/react";
import { common } from "../lib/messages";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

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

const CARD_W = 40;
const CARD_H = 57;
const GAP = 5;
const UP_STEP = 16;
const DOWN_STEP = 7;
const BOARD_W = CARD_W * 7 + GAP * 6;

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
  const tableau: Card[][] = [];
  for (let col = 0; col < 7; col++) {
    const pile: Card[] = [];
    for (let i = 0; i <= col; i++) {
      const card = deck.pop() as Card;
      pile.push({ ...card, up: i === col });
    }
    tableau.push(pile);
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

function Pip({ suit, className }: { suit: Suit; className: string }) {
  if (suit === "hearts") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 21C8.3 18.1 4 14.6 4 10.5A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 8 2.9C20 14.6 15.7 18.1 12 21Z" />
      </svg>
    );
  }
  if (suit === "diamonds") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 2.5 20 12l-8 9.5L4 12Z" />
      </svg>
    );
  }
  if (suit === "spades") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 2.5C8.4 6.2 4 9.2 4 13a4.3 4.3 0 0 0 7.1 3.2c-.2 2.1-1.1 3.7-2.6 4.3h7c-1.5-.6-2.4-2.2-2.6-4.3A4.3 4.3 0 0 0 20 13c0-3.8-4.4-6.8-8-10.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="12" cy="7" r="4.1" />
      <circle cx="6.8" cy="13.8" r="4.1" />
      <circle cx="17.2" cy="13.8" r="4.1" />
      <path d="M12 13.5c0 3.1-.9 5.6-2.7 7.1h5.4C12.9 19.1 12 16.6 12 13.5Z" />
    </svg>
  );
}

type FlashKey =
  | "recycled" | "empty" | "sent" | "nothingHome" | "noUndo" | "undone" | "faceDown"
  | "kingOnly" | "badRun" | "wrongSuit" | "noFit" | "emptyColumn" | "nowhere";
type Flash = { key: FlashKey; n?: number } | null;

const messages = {
  en: {
    ...common.en,
    suits: { spades: "spades", hearts: "hearts", diamonds: "diamonds", clubs: "clubs" } as Record<Suit, string>,
    card: (rank: string, suit: string) => `${rank} of ${suit}`,
    faceDownCard: "Face down card",
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
    intro:
      "Build the four suit piles from ace to king. Move cards between the seven columns in descending order, alternating red and black, and turn the deck when you run out of plays.",
    introKeys:
      "Click a card, then click where it goes. Keys 1-7 pick a column, D draws, F sends a card home, A collects everything it can, U takes back a move.",
    cardsHome: "Cards home",
    won: "Every suit is complete. You cleared the board.",
    lost: "No legal moves are left. This deal is blocked.",
    bestWin: (n: number) => `Best winning score: ${n}`,
    home: "Home",
    recycle: "Recycle the pile",
    emptyPile: "Empty pile",
    foundation: (suit: string) => `${suit} foundation`,
    emptyCol: (n: number) => `Empty column ${n}`,
    collect: "Collect",
    undo: "Undo",
    newDeal: "New deal",
    keys: "Keys: 1-7 columns, W pile, D draw, F send home, A collect, U undo, N new deal, Esc clears the selection.",
  },
  ko: {
    ...common.ko,
    suits: { spades: "스페이드", hearts: "하트", diamonds: "다이아몬드", clubs: "클럽" } as Record<Suit, string>,
    card: (rank: string, suit: string) => `${suit} ${rank}`,
    faceDownCard: "뒤집힌 카드",
    flash: {
      recycled: () => "덱을 다시 돌렸습니다. 20점이 깎입니다.",
      empty: () => "덱과 버림 더미가 모두 비었습니다.",
      sent: (n: number) => `카드 ${n}장을 기반 더미로 보냈습니다.`,
      nothingHome: () => "아직 기반 더미로 보낼 카드가 없습니다.",
      noUndo: () => "되돌릴 수가 없습니다.",
      undone: () => "한 수 되돌렸습니다.",
      faceDown: () => "아직 뒤집혀 있는 카드입니다.",
      kingOnly: () => "빈 열에는 킹만 놓을 수 있습니다.",
      badRun: () => "빨강과 검정이 번갈아 내려가는 줄을 집으세요.",
      wrongSuit: () => "이 기반 더미에 이어서 놓을 수 없는 카드입니다.",
      noFit: () => "그 자리에는 놓을 수 없습니다.",
      emptyColumn: () => "빈 열입니다.",
      nowhere: () => "그 카드는 아직 갈 곳이 없습니다.",
    } as Record<FlashKey, (n: number) => string>,
    intro:
      "네 가지 무늬별로 에이스부터 킹까지 기반 더미를 쌓으세요. 일곱 개 열 사이에서는 빨강과 검정을 번갈아 내림차순으로 옮기고, 더 둘 곳이 없으면 덱을 넘깁니다.",
    introKeys:
      "카드를 클릭한 뒤 옮길 곳을 클릭하세요. 1~7 키로 열 선택, D로 카드 넘기기, F로 기반 더미에 보내기, A로 보낼 수 있는 카드 모두 보내기, U로 되돌리기.",
    cardsHome: "모은 카드",
    won: "모든 무늬를 완성했습니다. 판을 모두 정리했습니다.",
    lost: "둘 수 있는 수가 없습니다. 이번 판은 막혔습니다.",
    bestWin: (n: number) => `승리 최고 점수: ${n}`,
    home: "모은 카드",
    recycle: "더미 다시 돌리기",
    emptyPile: "빈 더미",
    foundation: (suit: string) => `${suit} 기반 더미`,
    emptyCol: (n: number) => `${n}번 빈 열`,
    collect: "모두 보내기",
    undo: "되돌리기",
    newDeal: "새 판",
    keys: "키: 1~7 열, W 버림 더미, D 넘기기, F 보내기, A 모두 보내기, U 되돌리기, N 새 판, Esc 선택 해제.",
  },
};

function Slot({
  children,
  onClick,
  label,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ width: CARD_W, height: CARD_H }}
      className="flex items-center justify-center rounded-md border-2 border-dashed border-game-border bg-game-bg/40 transition-colors duration-200 hover:border-game-accent focus:outline-none focus:ring-2 focus:ring-game-accent"
    >
      {children}
    </button>
  );
}

function CardView({
  card,
  selected,
  marginTop,
  onClick,
  onDoubleClick,
}: {
  card: Card;
  selected: boolean;
  marginTop?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const m = useMessages(messages);
  const style = { width: CARD_W, height: CARD_H, marginTop };
  if (!card.up) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={m.faceDownCard}
        style={style}
        className="relative shrink-0 rounded-md border border-game-accent-dim bg-game-accent shadow-md-1 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-game-secondary"
      >
        <span className="absolute inset-1.5 rounded-sm border border-game-accent-light/40 bg-game-accent-dim" />
      </button>
    );
  }
  const tone = IS_RED[card.suit] ? "text-red-600 dark:text-red-400" : "text-game-text";
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-label={m.card(RANK_LABEL[card.rank], m.suits[card.suit])}
      style={style}
      className={`relative shrink-0 rounded-md border bg-game-surface shadow-md-1 transition-all duration-150 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-game-secondary ${
        selected
          ? "-translate-y-1 border-game-secondary ring-2 ring-game-secondary"
          : "border-game-border"
      }`}
    >
      <span className={`absolute left-1 top-0.5 text-[11px] font-black leading-tight ${tone}`}>
        {RANK_LABEL[card.rank]}
      </span>
      <Pip suit={card.suit} className={`absolute left-1 top-4 h-2.5 w-2.5 ${tone}`} />
      <Pip suit={card.suit} className={`absolute bottom-1 right-1 h-4 w-4 ${tone}`} />
    </button>
  );
}

export default function KlondikeSolitaire() {
  const m = useMessages(messages);
  const [game, setGame] = useState<Game>({
    board: EMPTY_BOARD,
    score: 0,
    moves: 0,
    phase: "idle",
    history: [],
  });
  const [sel, setSel] = useState<Selection>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [best, setBest] = useState<number | null>(null);

  const gameRef = useRef(game);
  const selRef = useRef(sel);
  gameRef.current = game;
  selRef.current = sel;

  const commit = useCallback((next: Game, message: Flash) => {
    gameRef.current = next;
    setGame(next);
    setFlash(message);
    if (next.phase === "won") {
      setBest((prev) => (prev === null || next.score > prev ? next.score : prev));
    }
  }, []);

  const startGame = useCallback(() => {
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
  }, []);

  const attemptMove = useCallback(
    (from: Selection, target: Target): boolean => {
      const current = gameRef.current;
      if (current.phase !== "playing" || !from) return false;
      const board = cloneBoard(current.board);
      const cards = selectedCards(board, from);
      if (!cards) return false;

      if (target.kind === "foundation") {
        if (cards.length !== 1 || from.zone === "foundation") return false;
        if (!fitsFoundation(cards[0], board.foundations[target.index], target.index)) return false;
      } else {
        if (from.zone === "tableau" && from.col === target.col) return false;
        if (!fitsTableau(cards[0], board.tableau[target.col])) return false;
      }

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
      return true;
    },
    [commit],
  );

  const sendToFoundation = useCallback(
    (from: Selection): boolean => {
      for (let i = 0; i < 4; i++) {
        if (attemptMove(from, { kind: "foundation", index: i })) return true;
      }
      return false;
    },
    [attemptMove],
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
      return;
    }
    if (board.waste.length > 0) {
      board.stock = board.waste.reverse().map((c) => ({ ...c, up: false }));
      board.waste = [];
      commit(advance(current, board, -20), { key: "recycled" });
      return;
    }
    setFlash({ key: "empty" });
  }, [commit]);

  const autoCollect = useCallback(() => {
    if (gameRef.current.phase !== "playing") return;
    let moved = 0;
    let progress = true;
    while (progress) {
      progress = false;
      if (sendToFoundation({ zone: "waste" })) {
        moved++;
        progress = true;
        continue;
      }
      for (let col = 0; col < 7; col++) {
        const pile = gameRef.current.board.tableau[col];
        if (pile.length === 0) continue;
        if (sendToFoundation({ zone: "tableau", col, index: pile.length - 1 })) {
          moved++;
          progress = true;
          break;
        }
      }
    }
    setFlash(moved > 0 ? { key: "sent", n: moved } : { key: "nothingHome" });
  }, [sendToFoundation]);

  const undo = useCallback(() => {
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      if (gameRef.current.phase === "idle" || gameRef.current.phase === "won" || gameRef.current.phase === "lost") {
        if (key === "Enter" || key === " " || key === "n") {
          event.preventDefault();
          startGame();
        }
        return;
      }
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

  if (phase === "idle") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-8 py-8 text-center animate-fade-in">
        <p className="text-game-text-dim">{m.intro}</p>
        <GameButton onClick={startGame} size="xl">
          {m.start}
        </GameButton>
        <p className="text-xs text-game-muted">{m.introKeys}</p>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8 text-center animate-slide-up">
        <ScoreDisplay label={m.score} value={score} size="lg" highlight />
        <div className="grid w-full grid-cols-2 gap-3">
          <ScoreDisplay label={m.moves} value={moves} size="sm" />
          <ScoreDisplay label={m.cardsHome} value={`${collected(board)} / 52`} size="sm" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? m.won
            : m.lost}
        </GameMessage>
        {best !== null && <p className="text-xs text-game-muted">{m.bestWin(best)}</p>}
        <GameButton onClick={startGame} size="xl">
          {m.playAgain}
        </GameButton>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-5 animate-fade-in">
      <div className="grid w-full max-w-md grid-cols-3 gap-3">
        <ScoreDisplay label={m.score} value={score} size="sm" highlight />
        <ScoreDisplay label={m.moves} value={moves} size="sm" />
        <ScoreDisplay label={m.home} value={`${collected(board)}/52`} size="sm" />
      </div>

      <div style={{ width: BOARD_W }} className="flex flex-col gap-4">
        <div className="flex items-start justify-between" style={{ gap: GAP }}>
          <div className="flex" style={{ gap: GAP }}>
            {board.stock.length > 0 ? (
              <CardView
                card={board.stock[board.stock.length - 1]}
                selected={false}
                onClick={draw}
              />
            ) : (
              <Slot onClick={draw} label={m.recycle}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  className="h-4 w-4 text-game-muted"
                  aria-hidden="true"
                >
                  <path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2" />
                  <path d="M18 3v3h-3M6 21v-3h3" />
                </svg>
              </Slot>
            )}
            {board.waste.length > 0 ? (
              <CardView
                card={board.waste[board.waste.length - 1]}
                selected={!!sel && sel.zone === "waste"}
                onClick={clickWaste}
                onDoubleClick={() => sendToFoundation({ zone: "waste" })}
              />
            ) : (
              <Slot label={m.emptyPile} />
            )}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {board.foundations.map((pile, index) => {
              const top = pile[pile.length - 1];
              return top ? (
                <CardView
                  key={SUITS[index]}
                  card={top}
                  selected={!!sel && sel.zone === "foundation" && sel.index === index}
                  onClick={() => clickFoundation(index)}
                />
              ) : (
                <Slot
                  key={SUITS[index]}
                  onClick={() => clickFoundation(index)}
                  label={m.foundation(m.suits[SUITS[index]])}
                >
                  <Pip suit={SUITS[index]} className="h-4 w-4 text-game-border" />
                </Slot>
              );
            })}
          </div>
        </div>

        <div className="flex items-start" style={{ gap: GAP }}>
          {board.tableau.map((pile, col) => (
            <div
              key={col}
              style={{ width: CARD_W, minHeight: CARD_H }}
              className="flex flex-col items-center"
            >
              {pile.length === 0 ? (
                <Slot onClick={() => clickTableau(col, 0)} label={m.emptyCol(col + 1)} />
              ) : (
                pile.map((card, index) => (
                  <CardView
                    key={card.id}
                    card={card}
                    selected={
                      !!sel && sel.zone === "tableau" && sel.col === col && index >= sel.index
                    }
                    marginTop={
                      index === 0 ? 0 : (pile[index - 1].up ? UP_STEP : DOWN_STEP) - CARD_H
                    }
                    onClick={() => clickTableau(col, index)}
                    onDoubleClick={() => sendToFoundation({ zone: "tableau", col, index })}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[2.5rem] w-full max-w-md">
        {flash && <GameMessage type="hint">{m.flash[flash.key](flash.n ?? 0)}</GameMessage>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <GameButton size="sm" onClick={autoCollect}>
          {m.collect}
        </GameButton>
        <GameButton size="sm" variant="secondary" onClick={undo} disabled={game.history.length === 0}>
          {m.undo}
        </GameButton>
        <GameButton size="sm" variant="ghost" onClick={startGame}>
          {m.newDeal}
        </GameButton>
      </div>

      <p className="max-w-md text-center text-xs text-game-muted">
        {m.keys}
      </p>
    </div>
  );
}
