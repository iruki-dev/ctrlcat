import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "../../components/games/ui/Button";
import { ScoreDisplay } from "../../components/games/ui/ScoreDisplay";
import { GameMessage } from "../../components/games/ui/GameMessage";

type Suit = "spades" | "hearts" | "diamonds" | "clubs";
type Card = { id: string; suit: Suit; rank: number };
type Phase = "idle" | "bet" | "player" | "dealer" | "reveal" | "result" | "won" | "lost";
type Outcome = "blackjack" | "win" | "dealer-bust" | "push" | "lose" | "bust";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const START_CHIPS = 100;
const TARGET_CHIPS = 500;
const BET_STEP = 5;
const MIN_BET = 5;
const DEALER_STANDS_ON = 17;

const IS_RED: Record<Suit, boolean> = {
  spades: false,
  clubs: false,
  hearts: true,
  diamonds: true,
};

const PIP_PATH: Record<Suit, string> = {
  hearts:
    "M12 21s-7.4-4.6-9.1-8.9A5.1 5.1 0 0 1 12 6.6a5.1 5.1 0 0 1 9.1 5.5C19.4 16.4 12 21 12 21z",
  diamonds: "M12 2l7 10-7 10-7-10z",
  spades:
    "M12 3c3 3.6 8 6.2 8 10a4 4 0 0 1-6.8 2.8c.2 2 .8 3.4 1.8 4.2H9c1-.8 1.6-2.2 1.8-4.2A4 4 0 0 1 4 13c0-3.8 5-6.4 8-10z",
  clubs:
    "M12 2.8a3.6 3.6 0 0 1 2.9 5.7 3.7 3.7 0 1 1 1.6 6.9 3.6 3.6 0 0 1-3.2-2c.1 2.2.7 3.8 1.8 4.6H8.9c1.1-.8 1.7-2.4 1.8-4.6a3.6 3.6 0 0 1-3.2 2 3.7 3.7 0 1 1 1.6-6.9A3.6 3.6 0 0 1 12 2.8z",
};

function rankLabel(rank: number): string {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

function buildShoe(): Card[] {
  const cards: Card[] = [];
  for (let pack = 0; pack < 2; pack++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        cards.push({ id: `${pack}-${suit}-${rank}`, suit, rank });
      }
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
  return cards;
}

function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 1) {
      aces += 1;
      total += 11;
    } else {
      total += Math.min(card.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

function Pip({ suit, className }: { suit: Suit; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={PIP_PATH[suit]} />
    </svg>
  );
}

function CardView({ card, facedown }: { card?: Card; facedown?: boolean }) {
  if (facedown || !card) {
    return (
      <div className="h-24 w-16 shrink-0 rounded-xl border-2 border-game-border bg-game-accent/15 flex items-center justify-center animate-slide-up">
        <div className="h-14 w-8 rounded-md border-2 border-game-accent/40 bg-game-accent/25" />
      </div>
    );
  }
  const tone = IS_RED[card.suit] ? "text-red-600 dark:text-red-400" : "text-game-text";
  return (
    <div
      className="relative h-24 w-16 shrink-0 rounded-xl border-2 border-game-border bg-game-surface shadow-sm animate-slide-up"
      aria-label={`${rankLabel(card.rank)} of ${card.suit}`}
    >
      <span className={`absolute left-1.5 top-1 text-sm font-black tabular-nums ${tone}`}>
        {rankLabel(card.rank)}
      </span>
      <Pip suit={card.suit} className={`absolute left-1.5 top-6 h-3 w-3 ${tone}`} />
      <Pip suit={card.suit} className={`absolute bottom-1.5 right-1.5 h-6 w-6 ${tone}`} />
    </div>
  );
}

function Hand({ cards, hideSecond }: { cards: Card[]; hideSecond: boolean }) {
  return (
    <div className="flex gap-2 min-h-[6rem]">
      {cards.map((card, index) => (
        <CardView key={card.id} card={card} facedown={hideSecond && index === 1} />
      ))}
    </div>
  );
}

export default function Blackjack() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [chips, setChipsState] = useState(START_CHIPS);
  const [best, setBest] = useState(START_CHIPS);
  const [bet, setBet] = useState(10);
  const [wager, setWager] = useState(10);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [hands, setHands] = useState(0);

  const chipsRef = useRef(START_CHIPS);
  const deckRef = useRef<Card[]>([]);

  const setChips = useCallback((next: number) => {
    chipsRef.current = next;
    setChipsState(next);
    setBest((current) => (next > current ? next : current));
  }, []);

  const draw = useCallback((): Card => {
    if (deckRef.current.length < 20) deckRef.current = buildShoe();
    return deckRef.current.pop() as Card;
  }, []);

  const resolve = useCallback(
    (playerCards: Card[], dealerCards: Card[], stake: number) => {
      const playerTotal = handValue(playerCards).total;
      const dealerTotal = handValue(dealerCards).total;
      const playerBJ = isBlackjack(playerCards);
      const dealerBJ = isBlackjack(dealerCards);

      let payout = 0;
      let result: Outcome;
      if (playerTotal > 21) {
        result = "bust";
      } else if (playerBJ && !dealerBJ) {
        payout = stake + Math.floor(stake * 1.5);
        result = "blackjack";
      } else if (dealerBJ && !playerBJ) {
        result = "lose";
      } else if (dealerTotal > 21) {
        payout = stake * 2;
        result = "dealer-bust";
      } else if (playerTotal > dealerTotal) {
        payout = stake * 2;
        result = "win";
      } else if (playerTotal < dealerTotal) {
        result = "lose";
      } else {
        payout = stake;
        result = "push";
      }

      const nextChips = chipsRef.current + payout;
      setChips(nextChips);
      setOutcome(result);
      setRevealed(true);
      setHands((count) => count + 1);
      if (nextChips < MIN_BET) setPhase("lost");
      else if (nextChips >= TARGET_CHIPS) setPhase("won");
      else setPhase("result");
    },
    [setChips],
  );

  const startGame = useCallback(() => {
    deckRef.current = buildShoe();
    setChips(START_CHIPS);
    setBest(START_CHIPS);
    setBet(10);
    setWager(10);
    setPlayer([]);
    setDealer([]);
    setRevealed(false);
    setOutcome(null);
    setHands(0);
    setPhase("bet");
  }, [setChips]);

  const adjustBet = useCallback(
    (delta: number) => {
      setBet((current) => {
        const max = Math.max(MIN_BET, chipsRef.current);
        const next = current + delta;
        if (next < MIN_BET) return MIN_BET;
        if (next > max) return max;
        return next;
      });
    },
    [],
  );

  const deal = useCallback(() => {
    const stake = Math.max(MIN_BET, Math.min(bet, chipsRef.current));
    setChips(chipsRef.current - stake);
    setWager(stake);
    const playerCards = [draw(), draw()];
    const dealerCards = [draw(), draw()];
    setPlayer(playerCards);
    setDealer(dealerCards);
    setOutcome(null);
    setRevealed(false);
    if (isBlackjack(playerCards) || isBlackjack(dealerCards)) setPhase("reveal");
    else setPhase("player");
  }, [bet, draw, setChips]);

  const hit = useCallback(() => {
    const next = [...player, draw()];
    setPlayer(next);
    const total = handValue(next).total;
    if (total > 21) setPhase("reveal");
    else if (total === 21) setPhase("dealer");
  }, [draw, player]);

  const stand = useCallback(() => {
    setPhase("dealer");
  }, []);

  const canDouble = phase === "player" && player.length === 2 && chipsRef.current >= wager;

  const double = useCallback(() => {
    if (player.length !== 2 || chipsRef.current < wager) return;
    setChips(chipsRef.current - wager);
    setWager(wager * 2);
    const next = [...player, draw()];
    setPlayer(next);
    setPhase(handValue(next).total > 21 ? "reveal" : "dealer");
  }, [draw, player, setChips, wager]);

  const nextHand = useCallback(() => {
    setPlayer([]);
    setDealer([]);
    setOutcome(null);
    setRevealed(false);
    setBet((current) => Math.max(MIN_BET, Math.min(current, chipsRef.current)));
    setPhase("bet");
  }, []);

  useEffect(() => {
    if (phase !== "reveal") return;
    setRevealed(true);
    const timer = window.setTimeout(() => resolve(player, dealer, wager), 700);
    return () => window.clearTimeout(timer);
  }, [dealer, phase, player, resolve, wager]);

  useEffect(() => {
    if (phase !== "dealer") return;
    setRevealed(true);
    if (handValue(dealer).total < DEALER_STANDS_ON) {
      const timer = window.setTimeout(() => {
        const card = draw();
        setDealer((current) => [...current, card]);
      }, 650);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => resolve(player, dealer, wager), 650);
    return () => window.clearTimeout(timer);
  }, [dealer, draw, phase, player, resolve, wager]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (phase === "bet") {
        if (key === "enter" || key === " ") {
          event.preventDefault();
          deal();
        } else if (key === "arrowup" || key === "arrowright") {
          event.preventDefault();
          adjustBet(BET_STEP);
        } else if (key === "arrowdown" || key === "arrowleft") {
          event.preventDefault();
          adjustBet(-BET_STEP);
        }
      } else if (phase === "player") {
        if (key === "h") hit();
        else if (key === "s") stand();
        else if (key === "d" && player.length === 2 && chipsRef.current >= wager) double();
      } else if (phase === "result") {
        if (key === "enter" || key === " ") {
          event.preventDefault();
          nextHand();
        }
      } else if (phase === "idle" || phase === "won" || phase === "lost") {
        if (key === "enter" || key === " ") {
          event.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjustBet, deal, double, hit, nextHand, phase, player.length, stand, startGame, wager]);

  const playerValue = handValue(player);
  const dealerValue = handValue(dealer);
  const dealerShown = dealer.length > 0 ? handValue([dealer[0]]).total : 0;

  const outcomeText: Record<Outcome, string> = {
    blackjack: `Blackjack. You win ${Math.floor(wager * 1.5)} chips.`,
    win: `Your ${playerValue.total} beats the dealer. You win ${wager} chips.`,
    "dealer-bust": `The dealer busts with ${dealerValue.total}. You win ${wager} chips.`,
    push: "A push. Your bet comes back.",
    lose: `The dealer wins with ${dealerValue.total}. You lose ${wager} chips.`,
    bust: `You bust with ${playerValue.total}. The bet goes to the dealer.`,
  };
  const outcomeTone: Record<Outcome, "success" | "error" | "info"> = {
    blackjack: "success",
    win: "success",
    "dealer-bust": "success",
    push: "info",
    lose: "error",
    bust: "error",
  };

  if (phase === "idle") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-8 py-8 animate-fade-in">
        <p className="text-game-text-dim">
          You start with {START_CHIPS} virtual chips. Bet a few, then get closer to 21 than the
          dealer without going over. Run your stack up to {TARGET_CHIPS} chips to win the night.
        </p>
        <p className="text-sm text-game-muted">
          Keys: H to hit, S to stand, D to double, Enter to deal.
        </p>
        <GameButton onClick={startGame} size="xl">
          Start Game
        </GameButton>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    return (
      <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6 py-8 animate-slide-up">
        <ScoreDisplay label="Chips" value={chips} size="lg" highlight />
        <div className="grid grid-cols-2 gap-3 w-full">
          <ScoreDisplay label="Best stack" value={best} size="sm" />
          <ScoreDisplay label="Hands played" value={hands} size="sm" />
        </div>
        <GameMessage type={phase === "won" ? "success" : "error"}>
          {phase === "won"
            ? `You reached ${TARGET_CHIPS} chips in ${hands} hands. The table is yours.`
            : "Your stack is gone. No chips left for another bet."}
        </GameMessage>
        <GameButton onClick={startGame} size="xl">
          Play again
        </GameButton>
      </div>
    );
  }

  const progress = Math.min(100, Math.round((chips / TARGET_CHIPS) * 100));

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-3">
        <ScoreDisplay label="Chips" value={chips} size="sm" highlight />
        <ScoreDisplay label="Bet" value={phase === "bet" ? bet : wager} size="sm" />
        <ScoreDisplay label="Best" value={best} size="sm" />
      </div>

      <div>
        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-game-muted mb-1">
          <span>Goal</span>
          <span className="tabular-nums">
            {chips} / {TARGET_CHIPS}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-game-surface-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-game-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <section className="rounded-2xl border-2 border-game-border bg-game-surface p-4 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-game-muted">Dealer</span>
          <span className="text-lg font-black tabular-nums text-game-text">
            {dealer.length === 0 ? "—" : revealed ? dealerValue.total : `${dealerShown} +`}
          </span>
        </div>
        {dealer.length === 0 ? (
          <p className="text-sm text-game-text-dim min-h-[6rem] flex items-center">
            Waiting for your bet.
          </p>
        ) : (
          <Hand cards={dealer} hideSecond={!revealed} />
        )}
      </section>

      <section className="rounded-2xl border-2 border-game-accent/40 bg-game-accent/[.06] p-4 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-game-muted">You</span>
          <span className="text-lg font-black tabular-nums text-game-accent">
            {player.length === 0
              ? "—"
              : playerValue.soft && playerValue.total <= 21
                ? `${playerValue.total} soft`
                : playerValue.total}
          </span>
        </div>
        {player.length === 0 ? (
          <p className="text-sm text-game-text-dim min-h-[6rem] flex items-center">
            Pick a bet to be dealt in.
          </p>
        ) : (
          <Hand cards={player} hideSecond={false} />
        )}
      </section>

      {phase === "bet" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-3">
            <GameButton
              variant="secondary"
              size="sm"
              onClick={() => adjustBet(-BET_STEP)}
              disabled={bet <= MIN_BET}
              aria-label="Lower bet"
            >
              −
            </GameButton>
            <span className="min-w-[5rem] text-center text-2xl font-black tabular-nums text-game-text">
              {bet}
            </span>
            <GameButton
              variant="secondary"
              size="sm"
              onClick={() => adjustBet(BET_STEP)}
              disabled={bet >= chips}
              aria-label="Raise bet"
            >
              +
            </GameButton>
          </div>
          <div className="flex justify-center gap-2">
            {[5, 10, 25, 50].map((amount) => (
              <GameButton
                key={amount}
                variant="ghost"
                size="sm"
                disabled={amount > chips}
                onClick={() => setBet(amount)}
              >
                {amount}
              </GameButton>
            ))}
            <GameButton variant="ghost" size="sm" onClick={() => setBet(chips)}>
              All in
            </GameButton>
          </div>
          <GameButton onClick={deal} size="lg">
            Deal
          </GameButton>
        </div>
      )}

      {phase === "player" && (
        <div className="grid grid-cols-3 gap-2">
          <GameButton onClick={hit} size="lg">
            Hit
          </GameButton>
          <GameButton onClick={stand} variant="secondary" size="lg">
            Stand
          </GameButton>
          <GameButton onClick={double} variant="secondary" size="lg" disabled={!canDouble}>
            Double
          </GameButton>
        </div>
      )}

      {(phase === "dealer" || phase === "reveal") && (
        <GameMessage type="info">The dealer is playing out the hand.</GameMessage>
      )}

      {phase === "result" && outcome && (
        <div className="flex flex-col gap-3 animate-slide-up">
          <GameMessage type={outcomeTone[outcome]}>{outcomeText[outcome]}</GameMessage>
          <GameButton onClick={nextHand} size="lg">
            Next hand
          </GameButton>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-game-muted">
          Hands played: <span className="tabular-nums">{hands}</span>
        </span>
        <GameButton variant="ghost" size="sm" onClick={() => setPhase("idle")}>
          Quit
        </GameButton>
      </div>
    </div>
  );
}
