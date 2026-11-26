import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-tool-accent text-tool-on-accent font-semibold hover:bg-tool-accent-dim active:bg-tool-accent-dim focus:ring-2 focus:ring-tool-accent focus:ring-offset-2",
  secondary:
    "border border-tool-accent text-tool-accent bg-transparent hover:bg-tool-accent-light active:bg-tool-accent/20",
  ghost:
    "text-tool-accent bg-transparent hover:bg-tool-accent-light active:bg-tool-accent/20",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs h-8",
  md: "px-4 py-2 text-sm h-10",
  lg: "px-6 py-3 text-sm h-12",
};

export function ToolButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {children}
    </button>
  );
}
