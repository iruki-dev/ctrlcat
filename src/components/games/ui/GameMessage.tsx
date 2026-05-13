type MessageType = "info" | "success" | "warning" | "error" | "hint";

interface Props {
  type?: MessageType;
  children: React.ReactNode;
}

const typeStyles: Record<MessageType, string> = {
  info:    "border-game-border bg-game-surface text-game-text-dim",
  success: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300",
  warning: "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300",
  error:   "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300",
  hint:    "border-game-accent/40 bg-game-accent/10 text-game-accent",
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
