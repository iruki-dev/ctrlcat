import type { PortalProvider } from "./types";
import { setSilenced } from "../audio";

/**
 * Preview build: shows where a portal would place its ad between rounds, with a 3-second
 * placeholder instead of a real ad. Used for demo pages only, never uploaded to a portal.
 */
function showPlaceholder(): Promise<void> {
  return new Promise((resolve) => {
    const ko = document.documentElement.lang === "ko";
    const el = document.createElement("div");
    el.setAttribute("role", "dialog");
    el.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(15,15,20,.92);color:#fff;font:600 16px system-ui,sans-serif;text-align:center;padding:24px";
    const title = document.createElement("div");
    title.style.cssText = "font-size:20px";
    title.textContent = ko ? "광고 자리" : "Ad break";
    const sub = document.createElement("div");
    sub.style.cssText = "font-weight:400;opacity:.75;max-width:320px;line-height:1.5";
    sub.textContent = ko
      ? "실제 포털에서는 여기서 포털이 광고를 보여주고, 그 수익을 나눠 받아요."
      : "On a real portal, the portal shows an ad here and shares the revenue.";
    const count = document.createElement("div");
    count.style.cssText = "font-size:28px;font-variant-numeric:tabular-nums";
    el.append(title, sub, count);
    document.body.appendChild(el);
    setSilenced("ad", true);
    let n = 3;
    count.textContent = String(n);
    const t = window.setInterval(() => {
      n -= 1;
      count.textContent = String(n);
      if (n <= 0) {
        window.clearInterval(t);
        el.remove();
        setSilenced("ad", false);
        resolve();
      }
    }, 1000);
  });
}

export const demo: PortalProvider = {
  name: "demo",
  async init() {},
  host: { requestBreak: showPlaceholder },
};
export default demo;
