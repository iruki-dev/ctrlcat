import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/* Carbon Design System button tokens */
const variantClass: Record<Variant, string> = {
  primary:
    "bg-tool-accent text-white font-semibold hover:bg-tool-accent-dim active:bg-[#002d9c] focus:ring-2 focus:ring-tool-accent focus:ring-offset-2",
  secondary:
    "border border-tool-accent text-tool-accent bg-transparent hover:bg-tool-accent-light active:bg-tool-accent/20",
  ghost:
    "text-tool-accent bg-transparent hover:bg-tool-accent-light active:bg-tool-accent/20",
  danger:
    "bg-[#da1e28] text-white hover:bg-[#b81921] active:bg-[#750e13]",
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
      {...props}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {children}
    </button>
  );
}
