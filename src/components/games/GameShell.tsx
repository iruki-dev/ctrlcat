import { useRef, useState, useEffect, type ReactNode } from "react";
import { SoundProvider, useSound } from "./SoundContext";

function ShellControls({ gameRef }: { gameRef: React.RefObject<HTMLDivElement> }) {
  const { muted, toggleMute } = useSound();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      gameRef.current?.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
        className="w-8 h-8 flex items-center justify-center rounded-full text-game-muted hover:bg-game-surface-2 hover:text-game-text transition-colors"
      >
        {muted ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        )}
      </button>
      <button
        onClick={toggleFs}
        aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="w-8 h-8 flex items-center justify-center rounded-full text-game-muted hover:bg-game-surface-2 hover:text-game-text transition-colors"
      >
        {fullscreen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="4 14 10 14 10 20"/>
            <polyline points="20 10 14 10 14 4"/>
            <line x1="10" y1="14" x2="3" y2="21"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        )}
      </button>
    </div>
  );
}

export default function GameShell({ children }: { children: ReactNode }) {
  const gameRef = useRef<HTMLDivElement>(null!);

  return (
    <SoundProvider>
      {/*
        gameRef is the fullscreen root. h-full so it fills the game-box in [slug].astro.
        When fullscreen is entered, the browser sets this element to 100vw × 100vh.
      */}
      <div ref={gameRef} className="h-full flex flex-col overflow-hidden rounded-xl border border-game-border bg-game-bg">
        {/* Game content area — fills available height, scrollable for form-based games */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
        {/* Controls bar — fixed height, always outside the game */}
        <div className="shrink-0 h-10 flex items-center justify-center border-t border-game-border-dim bg-game-surface/60 px-4">
          <ShellControls gameRef={gameRef} />
        </div>
      </div>
    </SoundProvider>
  );
}
