import { forwardRef, useEffect } from "react";

interface Props {
  width: number;
  height: number;
  cssWidth?: number;  // override CSS display width; defaults to width
  cssHeight?: number; // override CSS display height; defaults to height
  className?: string;
}

/**
 * A <canvas> that:
 * - Renders at device pixel ratio for crisp output on retina screens
 * - Scales the 2D context so game code always uses logical (width × height) coordinates
 * - Accepts optional cssWidth/cssHeight to display at a different size than the buffer
 *   (e.g. responsive scaling while keeping game logic at fixed resolution)
 *
 * The two concerns are intentionally separated into two effects:
 * - Buffer setup runs only when width/height change (resets context transform)
 * - CSS display size runs on every cssWidth/cssHeight change (no context reset)
 */
export const GameCanvas = forwardRef<HTMLCanvasElement, Props>(
  ({ width, height, cssWidth, cssHeight, className }, ref) => {

    // Effect 1: set up the canvas buffer and scale the context.
    // Runs only when logical game dimensions change (rarely — usually once on mount).
    // Setting canvas.width resets the 2D context, so ctx.scale must be re-applied here.
    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio ?? 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    }, [width, height, ref]);

    // Effect 2: update CSS display size (no canvas reset, no context modification).
    // Runs whenever display size changes (e.g. on window resize).
    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!canvas) return;
      canvas.style.width = `${cssWidth ?? width}px`;
      canvas.style.height = `${cssHeight ?? height}px`;
    }, [width, height, cssWidth, cssHeight, ref]);

    return <canvas ref={ref} className={className} />;
  }
);

GameCanvas.displayName = "GameCanvas";
