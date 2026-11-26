// Must run before any game code creates an AudioContext.
import "./audio";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import "./portal.css";
import { LangProvider } from "../src/i18n/react";
import GameShell from "../src/components/games/GameShell";
import { setGameHost } from "../src/games/lib/gameEvents";
// Resolved by vite.config.mjs to portal/providers/<portal>.ts, so a bundle carries only its own SDK code.
import provider from "virtual-provider";

// Resolved by vite.config.mjs to the one game this bundle is built for.
import Game from "virtual-game";

const lang = (navigator.language || "en").toLowerCase().startsWith("ko") ? "ko" : "en";
document.documentElement.lang = lang;

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

provider.init().then(() => {
  setGameHost(provider.host);
  const done = () => provider.loadingFinished?.();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <LangProvider lang={lang}>
        <main className="min-h-full px-3 py-4 sm:px-6 sm:py-6">
          <GameShell>
            <Game />
          </GameShell>
          <Ready onReady={done} />
        </main>
      </LangProvider>
    </StrictMode>,
  );
});
