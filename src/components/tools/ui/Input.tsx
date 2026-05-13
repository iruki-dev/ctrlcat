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
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-tool-text-dim uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="flex items-center border border-tool-border rounded-lg bg-tool-bg focus-within:ring-1 focus-within:ring-tool-accent focus-within:border-tool-accent transition-colors overflow-hidden">
        {prefix && (
          <span className="px-3 text-tool-muted text-sm border-r border-tool-border bg-tool-surface select-none">
            {prefix}
          </span>
        )}
        <input
          {...props}
          className={`flex-1 bg-transparent px-3 py-2 text-tool-text text-sm placeholder:text-tool-muted focus:outline-none ${className}`}
        />
        {suffix && (
          <span className="px-3 text-tool-muted text-sm border-l border-tool-border bg-tool-surface select-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-tool-muted">{hint}</p>}
    </div>
  );
}
