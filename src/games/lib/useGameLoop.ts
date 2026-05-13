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
 * - width/height passed to draw() are the LOGICAL game dimensions (canvas.width / dpr),
 *   which always match the coordinate space the 2D context was scaled to by GameCanvas.
 *   This is independent of the CSS display size — draw code never needs to worry about
 *   how the canvas is visually scaled on screen.
 * - dt in update() is capped at 100ms to prevent spiral-of-death on tab switch.
 */
export function useGameLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  callbacks: GameCallbacks,
  running: boolean
): void {
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
      const dpr = window.devicePixelRatio ?? 1;
      // Use buffer dimensions / dpr — these are the logical coordinates the context
      // was scaled to in GameCanvas, regardless of the CSS display size.
      const w = canvas!.width / dpr;
      const h = canvas!.height / dpr;

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
