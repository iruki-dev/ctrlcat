import { forwardRef, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const GameInput = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-bold text-game-text-dim uppercase tracking-widest">
          {label}
        </label>
      )}
      <input
        ref={ref}
        {...props}
        className={`w-full bg-game-bg border-2 border-game-border rounded-xl px-4 py-3 text-game-text text-center text-lg font-bold placeholder:text-game-muted focus:outline-none focus:ring-2 focus:ring-game-accent focus:border-game-accent transition-all ${className}`}
      />
      {hint && <p className="text-xs text-game-muted text-center">{hint}</p>}
    </div>
  )
);

GameInput.displayName = "GameInput";
