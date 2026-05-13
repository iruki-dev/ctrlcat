import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-game-accent text-game-bg font-bold hover:bg-game-accent-dim active:scale-95 shadow-lg shadow-game-accent/20",
  secondary:
    "border-2 border-game-border text-game-text hover:border-game-accent hover:text-game-accent",
  ghost: "text-game-text-dim hover:text-game-accent hover:bg-game-surface",
  danger:
    "border-2 border-red-700 text-red-400 hover:bg-red-900/20 hover:border-red-500",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-7 py-3 text-base rounded-xl",
  xl: "px-10 py-4 text-lg rounded-2xl",
};

export function GameButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {children}
    </button>
  );
}
