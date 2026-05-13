import type { TextareaHTMLAttributes } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function ToolTextarea({ label, hint, className = "", ...props }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">
          {label}
        </label>
      )}
      <textarea
        {...props}
        className={`w-full bg-tool-surface border border-tool-border px-3 py-2.5 text-tool-text text-sm font-mono resize-y placeholder:text-tool-muted focus:outline-none focus:ring-2 focus:ring-tool-accent focus:border-tool-accent transition-colors ${className}`}
      />
      {hint && <p className="text-xs text-tool-muted leading-relaxed">{hint}</p>}
    </div>
  );
}
