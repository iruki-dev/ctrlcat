interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent }: Props) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        accent
          ? "border-tool-accent/40 bg-tool-accent/5"
          : "border-tool-border bg-tool-surface"
      }`}
    >
      <span className="text-xs font-medium text-tool-muted uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`text-2xl font-bold ${accent ? "text-tool-accent" : "text-tool-text"}`}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-tool-muted">{sub}</span>}
    </div>
  );
}
