import { useEffect, useRef, useState, type ReactNode } from "react";
import { SoundProvider, useSound } from "../src/components/games/SoundContext";
import { useMessages } from "../src/i18n/react";

const messages = {
  en: { mute: "Mute", unmute: "Unmute", enterFullscreen: "Enter fullscreen", exitFullscreen: "Exit fullscreen" },
  ko: { mute: "음소거", unmute: "음소거 해제", enterFullscreen: "전체 화면", exitFullscreen: "전체 화면 종료" },
};

function Icon({ d }: { d: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      {d}
    </svg>
  );
}

function Controls({ rootRef }: { rootRef: React.RefObject<HTMLDivElement> }) {
  const m = useMessages(messages);
  const { muted, toggleMute } = useSound();
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = typeof document !== "undefined" && !!document.fullscreenEnabled;

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen().catch(() => {});
  };

  const btn =
    "w-10 h-10 flex items-center justify-center rounded-full bg-game-surface/70 text-game-text-dim hover:text-game-text hover:bg-game-surface-2 backdrop-blur transition-colors";

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={toggleMute} aria-label={muted ? m.unmute : m.mute} title={muted ? m.unmute : m.mute} className={btn}>
        {muted ? (
          <Icon d={<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>} />
        ) : (
          <Icon d={<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>} />
        )}
      </button>
      {canFullscreen && (
        <button type="button" onClick={toggleFs} aria-label={fullscreen ? m.exitFullscreen : m.enterFullscreen} title={fullscreen ? m.exitFullscreen : m.enterFullscreen} className={btn}>
          {fullscreen ? (
            <Icon d={<><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" /></>} />
          ) : (
            <Icon d={<><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>} />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Full-bleed frame for portal builds. Portals show the game in their own iframe and page chrome,
 * so the game fills the whole viewport on a themed stage instead of sitting in a site card.
 */
export default function PortalFrame({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null!);
  return (
    <SoundProvider>
      <div ref={rootRef} className="portal-stage relative h-full w-full overflow-hidden text-game-text">
        <div className="absolute right-3 top-3 z-30">
          <Controls rootRef={rootRef} />
        </div>
        <div className="portal-scroll h-full w-full overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </SoundProvider>
  );
}
