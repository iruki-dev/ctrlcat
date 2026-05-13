import { forwardRef, useEffect } from "react";

interface Props {
  width: number;
  height: number;
  className?: string;
}

/**
 * A <canvas> that:
 * - Renders at device pixel ratio for crisp output on retina screens
 * - Sets CSS size via style so canvas.clientWidth/clientHeight == width/height
 * - Scales the 2D context so game code can always use logical coordinates
 *
 * Usage:
 *   const canvasRef = useRef<HTMLCanvasElement>(null);
 *   <GameCanvas ref={canvasRef} width={400} height={400} />
 *
 * In draw callbacks, use (width, height) passed by useGameLoop — not canvas.width/height.
 */
export const GameCanvas = forwardRef<HTMLCanvasElement, Props>(
  ({ width, height, className }, ref) => {
    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio ?? 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    }, [width, height, ref]);

    return <canvas ref={ref} className={className} />;
  }
);

GameCanvas.displayName = "GameCanvas";
