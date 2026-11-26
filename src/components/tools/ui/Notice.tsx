import type { ReactNode } from "react";

type Tone = "error" | "success";

const toneClass: Record<Tone, string> = {
  error: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900",
  success: "text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/40 dark:border-green-900",
};

export function ToolNotice({ tone = "error", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`text-sm rounded-lg px-3 py-2 border ${toneClass[tone]}`}>
      {children}
    </div>
  );
}
