import { lazy, Suspense } from "react";

// Vite resolves this glob statically at build time.
// Each entry is a lazy import fn -> automatic code splitting per tool.
const toolModules = import.meta.glob<{ default: React.ComponentType }>(
  "/src/tools/**/*.tsx"
);

// Build the lazy component map once at module init (outside component = stable reference)
const toolLazy: Record<string, React.LazyExoticComponent<React.ComponentType>> = {};
for (const [path, importFn] of Object.entries(toolModules)) {
  // '/src/tools/word-counter/WordCounter.tsx' → 'word-counter/WordCounter'
  const key = path.replace("/src/tools/", "").replace(".tsx", "");
  toolLazy[key] = lazy(importFn);
}

interface Props {
  component: string;
}

export default function ToolRenderer({ component }: Props) {
  const Tool = toolLazy[component];

  if (!Tool) {
    return (
      <div className="rounded-xl border border-red-800/40 bg-red-900/10 p-8 text-center">
        <p className="text-red-400 font-medium">Component not found</p>
        <p className="text-tool-muted font-mono text-sm mt-2">{component}.tsx</p>
        <p className="text-tool-muted text-xs mt-1">
          Check the <code>component</code> field in the content entry.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<ToolSkeleton />}>
      <Tool />
    </Suspense>
  );
}

function ToolSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-32 rounded-lg bg-tool-surface border border-tool-border" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-tool-surface border border-tool-border" />
        ))}
      </div>
    </div>
  );
}
