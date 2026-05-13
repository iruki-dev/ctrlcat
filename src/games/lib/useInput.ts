import { useRef, useEffect, useCallback } from "react";

/**
 * Tracks keyboard state for use inside a game loop.
 *
 * Returns:
 *   held     — Set of currently held keys. Poll in update(): held.current.has("ArrowLeft")
 *   consume  — Check and clear a key in one call. Good for single-press actions
 *              like rotating a Tetris piece. Returns true if the key was just pressed.
 *
 * Arrow keys and Space are preventDefault'd to stop the page from scrolling.
 *
 * Usage:
 *   const { held, consume } = useKeys();
 *   // in update():
 *   if (held.current.has("ArrowLeft")) moveLeft();
 *   if (consume("ArrowUp")) rotate();
 */
export function useKeys() {
  const held = useRef(new Set<string>());
  // pressed tracks keys that were pressed this "frame" (ignores auto-repeat).
  // consume() reads and clears from this set.
  const pressed = useRef(new Set<string>());

  useEffect(() => {
    const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];

    const onDown = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.includes(e.key)) e.preventDefault();
      if (!e.repeat) pressed.current.add(e.key);
      held.current.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => {
      held.current.delete(e.key);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      held.current.clear();
      pressed.current.clear();
    };
  }, []);

  const consume = useCallback((key: string): boolean => {
    if (pressed.current.has(key)) {
      pressed.current.delete(key);
      return true;
    }
    return false;
  }, []);

  return { held, consume };
}

type SwipeDir = "up" | "down" | "left" | "right";

/**
 * Detects touch swipes on mobile. Calls onSwipe when the user lifts their finger
 * after moving at least 20px. Useful for giving Snake/similar games touch controls.
 *
 * Usage:
 *   useSwipe((dir) => {
 *     if (dir === "left") setDirection("left");
 *   });
 */
export function useSwipe(onSwipe: (dir: SwipeDir) => void) {
  const startRef = useRef({ x: 0, y: 0 });
  // Keep onSwipe in a ref so we don't re-attach listeners when it changes.
  const cbRef = useRef(onSwipe);
  cbRef.current = onSwipe;

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      startRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startRef.current.x;
      const dy = e.changedTouches[0].clientY - startRef.current.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        cbRef.current(dx > 0 ? "right" : "left");
      } else {
        cbRef.current(dy > 0 ? "down" : "up");
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);
}
