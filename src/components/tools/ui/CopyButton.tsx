"use client";
import { useState } from "react";

interface Props {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-all duration-150 ${
        copied
          ? "border-tool-accent/60 text-tool-accent bg-tool-accent/10"
          : "border-tool-border text-tool-muted hover:border-tool-accent hover:text-tool-accent"
      } ${className}`}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}
