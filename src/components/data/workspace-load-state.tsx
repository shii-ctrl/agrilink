import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
        Loading {label}…
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
