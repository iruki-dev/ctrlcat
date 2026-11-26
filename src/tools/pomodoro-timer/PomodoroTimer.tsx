import { useCallback, useEffect, useRef, useState } from "react";
import { ToolButton } from "../../components/tools/ui/Button";
import { ToolInput } from "../../components/tools/ui/Input";
import { StatCard } from "../../components/tools/ui/StatCard";
import { useMessages } from "../../i18n/react";

type Phase = "work" | "break" | "longBreak";
type Setting = "work" | "break" | "longBreak" | "rounds";

const LIMITS: Record<Setting, [number, number]> = { work: [1, 180], break: [1, 120], longBreak: [1, 120], rounds: [1, 12] };
const DEFAULTS: Record<Setting, string> = { work: "25", break: "5", longBreak: "15", rounds: "4" };

const messages = {
  en: {
    phases: { work: "Focus", break: "Short break", longBreak: "Long break" } as Record<Phase, string>,
    notices: {
      work: "Break is over. Back to focus.",
      break: "Focus session done. Take a short break.",
      longBreak: "Set complete. Take a long break.",
    } as Record<Phase, string>,
    settings: { work: "Focus", break: "Short break", longBreak: "Long break", rounds: "Rounds per set" } as Record<Setting, string>,
    round: (n: number, of: number) => `Round ${n} of ${of} in this set`,
    pause: "Pause",
    start: "Start",
    skip: "Skip phase",
    resetPhase: "Reset phase",
    resetAll: "Reset all",
    soundOn: "Sound on",
    soundOff: "Sound off",
    sessions: "Sessions done",
    focusTime: "Focus time",
    focusTimeSub: "counted while focusing",
    status: "Status",
    running: "Running",
    stopped: "Stopped",
    paused: "Paused",
    min: "min",
    footnote:
      "Duration changes apply to the clock while the timer is stopped, and to every later phase once it is running. Keep this tab open to hear the alert and to see the countdown in the title bar.",
  },
  ko: {
    phases: { work: "집중", break: "짧은 휴식", longBreak: "긴 휴식" } as Record<Phase, string>,
    notices: {
      work: "휴식이 끝났습니다. 다시 집중하세요.",
      break: "집중 시간이 끝났습니다. 잠깐 쉬세요.",
      longBreak: "한 세트를 마쳤습니다. 길게 쉬세요.",
    } as Record<Phase, string>,
    settings: { work: "집중", break: "짧은 휴식", longBreak: "긴 휴식", rounds: "세트당 횟수" } as Record<Setting, string>,
    round: (n: number, of: number) => `이번 세트 ${of}회 중 ${n}회째`,
    pause: "일시 정지",
    start: "시작",
    skip: "다음 단계로",
    resetPhase: "현재 단계 초기화",
    resetAll: "모두 초기화",
    soundOn: "소리 켜짐",
    soundOff: "소리 꺼짐",
    sessions: "완료한 집중",
    focusTime: "집중 시간",
    focusTimeSub: "집중 중에만 집계",
    status: "상태",
    running: "진행 중",
    stopped: "멈춤",
    paused: "일시 정지",
    min: "분",
    footnote:
      "시간 설정은 타이머가 멈춰 있으면 바로, 진행 중이면 다음 단계부터 적용됩니다. 알림 소리를 듣고 탭 제목에서 남은 시간을 보려면 이 탭을 열어 두세요.",
  },
};

const clamp = (value: number, [min, max]: [number, number]) =>
  Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), max) : min;

const formatClock = (total: number) => {
  const safe = Math.max(0, total);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

export default function PomodoroTimer() {
  const m = useMessages(messages);
  const [raw, setRaw] = useState(DEFAULTS);
  const value = (key: Setting) => clamp(parseInt(raw[key], 10), LIMITS[key]);
  const roundsPerSet = value("rounds");

  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(Number(DEFAULTS.work) * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [notice, setNotice] = useState<Phase | null>(null);

  const audioRef = useRef<AudioContext | null>(null);
  const baseTitleRef = useRef("");

  const workMin = value("work");
  const breakMin = value("break");
  const longBreakMin = value("longBreak");
  const phaseSeconds = useCallback(
    (target: Phase) => 60 * (target === "work" ? workMin : target === "break" ? breakMin : longBreakMin),
    [workMin, breakMin, longBreakMin],
  );

  // Created lazily from a click so browsers allow audio playback.
  const ensureAudio = useCallback(() => {
    audioRef.current ??= new AudioContext();
    if (audioRef.current.state === "suspended") void audioRef.current.resume();
    return audioRef.current;
  }, []);

  const playAlert = useCallback(() => {
    if (!soundOn) return;
    const ctx = ensureAudio();
    const start = ctx.currentTime + 0.02;
    [0, 0.32, 0.64].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
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

  const nextPhase = useCallback(() => {
    if (phase === "work") {
      const done = completed + 1;
      const next: Phase = done % roundsPerSet === 0 ? "longBreak" : "break";
      setCompleted(done);
      setPhase(next);
      setSecondsLeft(phaseSeconds(next));
      return next;
    }
    setPhase("work");
    setSecondsLeft(phaseSeconds("work"));
    return "work" as const;
  }, [phase, completed, roundsPerSet, phaseSeconds]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
      if (phase === "work") setFocusSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, phase]);

  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    playAlert();
    setNotice(nextPhase());
  }, [running, secondsLeft, playAlert, nextPhase]);

  // Apply duration edits to the clock while the timer is stopped.
  const durationKey = `${workMin}:${breakMin}:${longBreakMin}`;
  const durationKeyRef = useRef(durationKey);
  useEffect(() => {
    if (durationKeyRef.current === durationKey) return;
    durationKeyRef.current = durationKey;
    if (!running) setSecondsLeft(phaseSeconds(phase));
  }, [durationKey, running, phase, phaseSeconds]);

  useEffect(() => {
    baseTitleRef.current = document.title;
    return () => {
      document.title = baseTitleRef.current;
    };
  }, []);

  useEffect(() => {
    const base = baseTitleRef.current;
    if (running) document.title = `${formatClock(secondsLeft)} ${m.phases[phase]} - ${base}`;
    else document.title = notice ? `${m.paused} - ${base}` : base;
  }, [running, secondsLeft, phase, notice, m]);

  const total = phaseSeconds(phase);
  const progress = total > 0 ? Math.round((Math.min(total, Math.max(0, total - secondsLeft)) / total) * 100) : 0;

  const resetAll = () => {
    setRunning(false);
    setPhase("work");
    setSecondsLeft(workMin * 60);
    setCompleted(0);
    setFocusSeconds(0);
    setNotice(null);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="rounded-xl border border-tool-border bg-tool-surface p-6 flex flex-col items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-tool-accent">{m.phases[phase]}</span>
        <span className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-tool-text" aria-live="off">
          {formatClock(secondsLeft)}
        </span>
        <div
          className="w-full h-2 rounded-full bg-tool-surface-2 border border-tool-border overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-tool-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-tool-muted">{m.round((completed % roundsPerSet) + 1, roundsPerSet)}</span>
      </div>

      {notice && (
        <p className="rounded-lg border border-tool-accent/40 bg-tool-accent/5 px-4 py-3 text-sm text-tool-accent" role="status">
          {m.notices[notice]}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {running ? (
          <ToolButton onClick={() => setRunning(false)}>{m.pause}</ToolButton>
        ) : (
          <ToolButton
            onClick={() => {
              ensureAudio();
              setRunning(true);
            }}
          >
            {m.start}
          </ToolButton>
        )}
        <ToolButton
          variant="secondary"
          onClick={() => {
            nextPhase();
            setNotice(null);
          }}
        >
          {m.skip}
        </ToolButton>
        <ToolButton
          variant="ghost"
          onClick={() => {
            setRunning(false);
            setSecondsLeft(phaseSeconds(phase));
          }}
        >
          {m.resetPhase}
        </ToolButton>
        <ToolButton variant="ghost" onClick={resetAll}>
          {m.resetAll}
        </ToolButton>
        <ToolButton
          variant="ghost"
          onClick={() => {
            if (!soundOn) ensureAudio();
            setSoundOn(!soundOn);
          }}
          aria-pressed={soundOn}
        >
          {soundOn ? m.soundOn : m.soundOff}
        </ToolButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label={m.sessions} value={completed} accent />
        <StatCard label={m.focusTime} value={formatClock(focusSeconds)} sub={m.focusTimeSub} />
        <StatCard label={m.status} value={running ? m.running : m.stopped} sub={m.phases[phase]} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(LIMITS) as Setting[]).map((key) => (
          <ToolInput
            key={key}
            label={m.settings[key]}
            type="number"
            min={LIMITS[key][0]}
            max={LIMITS[key][1]}
            suffix={key === "rounds" ? undefined : m.min}
            value={raw[key]}
            onChange={(event) => setRaw((r) => ({ ...r, [key]: event.target.value }))}
            onBlur={() => setRaw((r) => ({ ...r, [key]: String(value(key)) }))}
          />
        ))}
      </div>

      <p className="text-xs text-tool-muted leading-relaxed">{m.footnote}</p>
    </div>
  );
}
