// Must run before any game code creates an AudioContext.
import "./audio";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import "./portal.css";
// Resolved by vite.config.mjs to portal/themes/<slug>.css (or default.css); loads after the base tokens to override them.
import "virtual-theme";
import { LangProvider } from "../src/i18n/react";
import PortalFrame from "./PortalFrame";
import { setGameHost } from "../src/games/lib/gameEvents";
// Resolved by vite.config.mjs to portal/providers/<portal>.ts, so a bundle carries only its own SDK code.
import provider from "virtual-provider";

// Resolved by vite.config.mjs to the one game this bundle is built for.
import Game from "virtual-game";

// Same rule as the site: Korean browsers get Korean, everyone else English.
const browserLang = ((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase();
const lang = browserLang.startsWith("ko") ? "ko" : "en";
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
        <main className="h-full">
          <PortalFrame>
            <Game />
          </PortalFrame>
          <Ready onReady={done} />
        </main>
      </LangProvider>
    </StrictMode>,
  );
});
