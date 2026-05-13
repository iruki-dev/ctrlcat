import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/* Material Design 3 button tokens */
const variantClass: Record<Variant, string> = {
  primary:
    "bg-game-accent text-white font-bold hover:bg-game-accent-dim active:bg-game-accent-dim shadow-md-1 hover:shadow-md-2",
  secondary:
    "bg-game-accent-light text-game-accent font-semibold hover:bg-game-accent/20 active:bg-game-accent/25",
  ghost:
    "text-game-accent hover:bg-game-accent/[.08] active:bg-game-accent/[.12]",
  danger:
    "bg-red-600 text-white font-bold hover:bg-red-700 active:bg-red-800 shadow-md-1",
};

const sizeClass: Record<Size, string> = {
  sm: "px-4 py-1.5 text-sm rounded-full h-8",
  md: "px-6 py-2.5 text-sm rounded-full h-10",
  lg: "px-8 py-3 text-base rounded-full h-12",
  xl: "px-10 py-4 text-lg rounded-full h-14",
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
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-game-accent focus:ring-offset-2 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {children}
    </button>
  );
}
