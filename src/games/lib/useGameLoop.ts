import { useRef, useEffect } from "react";

interface GameCallbacks {
  /** Called every frame before draw. dt is elapsed seconds (capped at 0.1). */
  update: (dt: number) => void;
  /** Called every frame after update. Use logical width/height, not canvas.width/height. */
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

/**
 * Runs a requestAnimationFrame game loop tied to a canvas element.
 *
 * - When running is false the loop stops and cleans up automatically.
 * - width/height passed to draw() are the CSS (logical) dimensions,
 *   so game code doesn't need to think about device pixel ratio.
 * - dt in update() is capped at 100ms to prevent spiral-of-death on tab switch.
 *
 * Usage:
 *   useGameLoop(canvasRef, { update, draw }, isPlaying);
 */
export function useGameLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  callbacks: GameCallbacks,
  running: boolean
): void {
  // Keep callbacks in a ref so the loop always uses the latest version
  // without needing to restart when they change.
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    let lastTime = performance.now();

    function loop(now: number) {
      // Read CSS size each frame so it stays correct if canvas is resized.
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      cbRef.current.update(dt);
      cbRef.current.draw(ctx!, w, h);

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [running, canvasRef]);
}
