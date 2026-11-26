import { useEffect, useRef, useState } from "react";
import { useMessages } from "../../../i18n/react";

const messages = {
  en: { copy: "Copy", copied: "Copied", failed: "Copy failed" },
  ko: { copy: "복사", copied: "복사됨", failed: "복사 실패" },
};

interface Props {
  text: string;
  className?: string;
  label?: string;
}

export function CopyButton({ text, className = "", label }: Props) {
  const m = useMessages(messages);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-all duration-150 ${
        state === "copied"
          ? "border-tool-accent/60 text-tool-accent bg-tool-accent/10"
          : "border-tool-border text-tool-muted hover:border-tool-accent hover:text-tool-accent"
      } ${className}`}
    >
      {state === "copied" ? `✓ ${m.copied}` : state === "failed" ? m.failed : (label ?? m.copy)}
    </button>
  );
}
