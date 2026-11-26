export function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/** Resolves after `ms` at the latest, so a stuck SDK callback cannot freeze the game. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}
