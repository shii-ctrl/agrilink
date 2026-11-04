import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceLoadState({
  loading,
  error,
  onRetry,
  label = "workspace",
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  label?: string;
}) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-border bg-card p-5 shadow-card" role="status" aria-live="polite">
        <span className="sr-only">Loading {label}…</span>
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-2xl" />
          <div className="w-full space-y-2">
            <Skeleton className="h-4 w-40 max-w-[55%]" />
            <Skeleton className="h-3 w-64 max-w-[80%]" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }
  if (!error) return null;
  return (
    <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center shadow-card">
      <p className="font-semibold text-foreground">Could not load this {label}</p>
      <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      <Button type="button" variant="outline" className="mt-4 rounded-full" onClick={onRetry}>
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  );
}
