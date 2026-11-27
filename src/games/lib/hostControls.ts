import { createContext, useContext, useEffect } from "react";

/**
 * Sound and fullscreen switches that a host frame (the portal build) owns.
 * On ctrlcat.dev there is no provider: the page shell already has these buttons, so games get null and show nothing.
 */
export interface HostControls {
  muted: boolean;
  toggleMute: () => void;
  canFullscreen: boolean;
  fullscreen: boolean;
  toggleFullscreen: () => void;
}

interface HostControlsValue {
  controls: HostControls;
  /** Tells the frame that the game shows these switches itself. Returns the release function. */
  claim: () => () => void;
}

export const HostControlsContext = createContext<HostControlsValue | null>(null);

/**
 * For games that put sound and fullscreen into their own HUD instead of the frame's corner buttons.
 * Calling it hides the frame's buttons while the game is mounted.
 */
export function useHostControls(): HostControls | null {
  const ctx = useContext(HostControlsContext);
  const claim = ctx?.claim;
  useEffect(() => claim?.(), [claim]);
  return ctx?.controls ?? null;
}

/** Labels for those switches. Spread into a game's own messages next to `common`. */
export const hostLabels = {
  en: {
    soundOn: "Sound: on",
    soundOff: "Sound: off",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
  },
  ko: {
    soundOn: "소리: 켬",
    soundOff: "소리: 끔",
    fullscreen: "전체 화면",
    exitFullscreen: "전체 화면 끄기",
  },
};
