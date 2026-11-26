import { useCallback, useEffect, useState } from "react";

function read(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable: the best score stays in memory for this visit.
  }
}

/**
 * A personal best kept in localStorage under `key`.
 * `record(value)` stores the value when it beats the current best and returns true in that case.
 * Pass `lowerIsBetter` for games where a smaller number wins (times, move counts).
 */
export function useBestScore(key: string, lowerIsBetter = false) {
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => setBest(read(key)), [key]);

  const record = useCallback(
    (value: number): boolean => {
      if (!(value > 0)) return false;
      const current = read(key) ?? best;
      const beats = current === null || (lowerIsBetter ? value < current : value > current);
      if (!beats) return false;
      write(key, value);
      setBest(value);
      return true;
    },
    [key, best, lowerIsBetter],
  );

  return { best, record };
}
