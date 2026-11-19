import { useCallback, useEffect, useRef, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";

type Phase = "work" | "break" | "longBreak";

const PHASE_LABEL: Record<Phase, string> = {
  work: "Focus",
  break: "Short break",
  longBreak: "Long break",
};

const PHASE_NOTICE: Record<Phase, string> = {
  work: "Break is over. Back to focus.",
  break: "Focus session done. Take a short break.",
  longBreak: "Set complete. Take a long break.",
};

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), max) : min;

const formatClock = (total: number) => {
  const safe = Math.max(0, total);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function PomodoroTimer() {
  const [workRaw, setWorkRaw] = useState("25");
  const [breakRaw, setBreakRaw] = useState("5");
  const [longBreakRaw, setLongBreakRaw] = useState("15");
  const [roundsRaw, setRoundsRaw] = useState("4");

  const workMin = clamp(parseInt(workRaw, 10), 1, 180);
  const breakMin = clamp(parseInt(breakRaw, 10), 1, 120);
  const longBreakMin = clamp(parseInt(longBreakRaw, 10), 1, 120);
  const roundsPerSet = clamp(parseInt(roundsRaw, 10), 1, 12);

  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [notice, setNotice] = useState("");

  const audioRef = useRef<AudioContext | null>(null);
  const baseTitleRef = useRef("");
  const noticeRef = useRef("");

  const phaseSeconds = useCallback(
    (target: Phase) => {
      if (target === "work") return workMin * 60;
      if (target === "break") return breakMin * 60;
      return longBreakMin * 60;
    },
    [workMin, breakMin, longBreakMin],
  );

  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    if (!audioRef.current) {
      try {
        audioRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    if (audioRef.current.state === "suspended") {
      void audioRef.current.resume();
    }
    return audioRef.current;
  }, []);

  const playAlert = useCallback(() => {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const start = ctx.currentTime + 0.02;
    [0, 0.32, 0.64].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const at = start + offset;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.22, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.26);
    });
  }, [ensureAudio, soundOn]);

  /* Tick once per second while the timer runs. */
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  /* Count elapsed focus time for the session total. */
  useEffect(() => {
    if (!running || phase !== "work") return;
    const id = window.setInterval(() => {
      setFocusSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, phase]);

  /* Advance to the next phase when the current one reaches zero. */
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    playAlert();
    if (phase === "work") {
      const done = completed + 1;
      const next: Phase = done % roundsPerSet === 0 ? "longBreak" : "break";
      setCompleted(done);
      setNotice(PHASE_NOTICE[next]);
      setPhase(next);
      setSecondsLeft(phaseSeconds(next));
    } else {
      setNotice(PHASE_NOTICE.work);
      setPhase("work");
      setSecondsLeft(phaseSeconds("work"));
    }
  }, [
    running,
    secondsLeft,
    phase,
    completed,
    roundsPerSet,
    phaseSeconds,
    playAlert,
  ]);

  /* Apply duration edits to the clock while the timer is stopped. */
  const durationKey = `${workMin}:${breakMin}:${longBreakMin}`;
  const durationKeyRef = useRef(durationKey);
  useEffect(() => {
    if (durationKeyRef.current === durationKey) return;
    durationKeyRef.current = durationKey;
    if (!running) setSecondsLeft(phaseSeconds(phase));
  }, [durationKey, running, phase, phaseSeconds]);

  /* Remember the page title so it can be restored on unmount. */
  useEffect(() => {
    baseTitleRef.current = document.title;
    return () => {
      document.title = baseTitleRef.current;
    };
  }, []);

  /* Mirror the countdown and the latest alert into the title bar. */
  noticeRef.current = notice;
  useEffect(() => {
    const base = baseTitleRef.current;
    if (!base) return;
    if (running) {
      document.title = `${formatClock(secondsLeft)} ${PHASE_LABEL[phase]} - ${base}`;
    } else if (noticeRef.current) {
      document.title = `Paused - ${base}`;
    } else {
      document.title = base;
    }
  }, [running, secondsLeft, phase]);

  const total = phaseSeconds(phase);
  const elapsed = Math.min(total, Math.max(0, total - secondsLeft));
  const progress = total > 0 ? Math.round((elapsed / total) * 100) : 0;
  const roundInSet = (completed % roundsPerSet) + 1;

  const start = () => {
    ensureAudio();
    setRunning(true);
  };

  const resetPhase = () => {
    setRunning(false);
    setSecondsLeft(phaseSeconds(phase));
  };

  const skipPhase = () => {
    if (phase === "work") {
      const done = completed + 1;
      const next: Phase = done % roundsPerSet === 0 ? "longBreak" : "break";
      setCompleted(done);
      setPhase(next);
      setSecondsLeft(phaseSeconds(next));
    } else {
      setPhase("work");
      setSecondsLeft(phaseSeconds("work"));
    }
    setNotice("");
  };

  const resetAll = () => {
    setRunning(false);
    setPhase("work");
    setSecondsLeft(workMin * 60);
    setCompleted(0);
    setFocusSeconds(0);
    setNotice("");
  };

  const normalize = (
    raw: string,
    setRaw: (value: string) => void,
    min: number,
    max: number,
  ) => setRaw(String(clamp(parseInt(raw, 10), min, max)));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="rounded-xl border border-tool-border bg-tool-surface p-6 flex flex-col items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-tool-accent">
          {PHASE_LABEL[phase]}
        </span>
        <span
          className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-tool-text"
          aria-live="off"
        >
          {formatClock(secondsLeft)}
        </span>
        <div
          className="w-full h-2 rounded-full bg-tool-surface-2 border border-tool-border overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-tool-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-tool-muted">
          Round {roundInSet} of {roundsPerSet} in this set
        </span>
      </div>

      {notice && (
        <p
          className="rounded-lg border border-tool-accent/40 bg-tool-accent/5 px-4 py-3 text-sm text-tool-accent"
          role="status"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {running ? (
          <ToolButton onClick={() => setRunning(false)}>Pause</ToolButton>
        ) : (
          <ToolButton onClick={start}>Start</ToolButton>
        )}
        <ToolButton variant="secondary" onClick={skipPhase}>
          Skip phase
        </ToolButton>
        <ToolButton variant="ghost" onClick={resetPhase}>
          Reset phase
        </ToolButton>
        <ToolButton variant="ghost" onClick={resetAll}>
          Reset all
        </ToolButton>
        <ToolButton
          variant="ghost"
          onClick={() => {
            if (!soundOn) ensureAudio();
            setSoundOn(!soundOn);
          }}
          aria-pressed={soundOn}
        >
          {soundOn ? "Sound on" : "Sound off"}
        </ToolButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Sessions done" value={completed} accent />
        <StatCard
          label="Focus time"
          value={formatClock(focusSeconds)}
          sub="counted while focusing"
        />
        <StatCard
          label="Status"
          value={running ? "Running" : "Stopped"}
          sub={PHASE_LABEL[phase]}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ToolInput
          label="Focus"
          type="number"
          min={1}
          max={180}
          suffix="min"
          value={workRaw}
          onChange={(event) => setWorkRaw(event.target.value)}
          onBlur={() => normalize(workRaw, setWorkRaw, 1, 180)}
        />
        <ToolInput
          label="Short break"
          type="number"
          min={1}
          max={120}
          suffix="min"
          value={breakRaw}
          onChange={(event) => setBreakRaw(event.target.value)}
          onBlur={() => normalize(breakRaw, setBreakRaw, 1, 120)}
        />
        <ToolInput
          label="Long break"
          type="number"
          min={1}
          max={120}
          suffix="min"
          value={longBreakRaw}
          onChange={(event) => setLongBreakRaw(event.target.value)}
          onBlur={() => normalize(longBreakRaw, setLongBreakRaw, 1, 120)}
        />
        <ToolInput
          label="Rounds per set"
          type="number"
          min={1}
          max={12}
          value={roundsRaw}
          onChange={(event) => setRoundsRaw(event.target.value)}
          onBlur={() => normalize(roundsRaw, setRoundsRaw, 1, 12)}
        />
      </div>

      <p className="text-xs text-tool-muted leading-relaxed">
        Duration changes apply to the clock while the timer is stopped, and to
        every later phase once it is running. Keep this tab open to hear the
        alert and to see the countdown in the title bar.
      </p>
    </div>
  );
}
