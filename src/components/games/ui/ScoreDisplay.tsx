interface Props {
  label: string;
  value: string | number;
  highlight?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: { wrapper: "p-3", value: "text-xl", label: "text-xs" },
  md: { wrapper: "p-5", value: "text-3xl", label: "text-xs" },
  lg: { wrapper: "p-6", value: "text-5xl", label: "text-sm" },
};

export function ScoreDisplay({ label, value, highlight, size = "md" }: Props) {
  const s = sizeClass[size];
  return (
    <div
      className={`rounded-2xl border-2 flex flex-col items-center gap-1 ${s.wrapper} ${
        highlight
          ? "border-game-accent bg-game-accent/10"
          : "border-game-border bg-game-surface"
      }`}
    >
      <span
        className={`font-black tabular-nums ${s.value} ${highlight ? "text-game-accent" : "text-game-text"}`}
      >
        {value}
      </span>
      <span
        className={`font-bold uppercase tracking-widest text-game-muted ${s.label}`}
      >
        {label}
      </span>
    </div>
  );
}
