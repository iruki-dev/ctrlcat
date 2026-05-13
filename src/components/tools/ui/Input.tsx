import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
}

export function ToolInput({
  label,
  hint,
  prefix,
  suffix,
  className = "",
  ...props
}: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-tool-text-dim uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="flex items-center border border-tool-border bg-tool-surface focus-within:ring-2 focus-within:ring-tool-accent focus-within:border-tool-accent transition-colors overflow-hidden">
        {prefix && (
          <span className="px-3 py-2 text-tool-muted text-sm border-r border-tool-border bg-tool-surface-2 select-none whitespace-nowrap">
            {prefix}
          </span>
        )}
        <input
          {...props}
          className={`flex-1 bg-transparent px-3 py-2 text-tool-text text-sm placeholder:text-tool-muted focus:outline-none ${className}`}
        />
        {suffix && (
          <span className="px-3 py-2 text-tool-muted text-sm border-l border-tool-border bg-tool-surface-2 select-none whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-tool-muted leading-relaxed">{hint}</p>}
    </div>
  );
}
