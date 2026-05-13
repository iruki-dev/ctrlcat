type MessageType = "info" | "success" | "warning" | "error" | "hint";

interface Props {
  type?: MessageType;
  children: React.ReactNode;
}

const typeStyles: Record<MessageType, string> = {
  info: "border-game-border bg-game-surface text-game-text-dim",
  success: "border-green-200 bg-green-50 text-green-700",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-700",
  error: "border-red-200 bg-red-50 text-red-700",
  hint: "border-game-accent/40 bg-game-accent/10 text-game-accent",
};

const typeIcon: Record<MessageType, string> = {
  info: "i",
  success: "✓",
  warning: "!",
  error: "×",
  hint: "→",
};

export function GameMessage({ type = "info", children }: Props) {
  return (
    <div
      className={`border-2 rounded-xl px-4 py-3 flex items-start gap-3 text-sm font-medium ${typeStyles[type]}`}
    >
      <span>{typeIcon[type]}</span>
      <div>{children}</div>
    </div>
  );
}
