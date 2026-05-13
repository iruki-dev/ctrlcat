import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-tool-accent text-tool-bg font-semibold hover:bg-tool-accent-dim active:scale-95",
  secondary:
    "border border-tool-border text-tool-text hover:border-tool-accent hover:text-tool-accent",
  ghost: "text-tool-text-dim hover:text-tool-accent hover:bg-tool-surface",
  danger:
    "border border-red-700 text-red-400 hover:bg-red-900/20 hover:border-red-500",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-xl",
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
      {...props}
      className={`inline-flex items-center gap-2 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {children}
    </button>
  );
}
