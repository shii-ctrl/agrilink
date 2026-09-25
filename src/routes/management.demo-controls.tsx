import { createFileRoute } from "@tanstack/react-router";
import { ArchiveRestore, DatabaseZap, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import {
  deleteDemoDraft,
  getDemoDrafts,
  loadSampleDemoData,
  resetDemoData,
  restoreDemoDraft,
  saveCurrentDemoDraft,
  subscribeDemoDrafts,
  type DemoDraft,
} from "@/lib/demo-controls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/management/demo-controls")({
  head: () => ({ meta: [{ title: "Demo Controls — Management | AgriLink" }] }),
  component: DemoControlsPage,
});

function DemoControlsPage() {
  const [draftName, setDraftName] = useState("");
  const [drafts, setDrafts] = useState<DemoDraft[]>([]);

  useEffect(() => {
    setDrafts(getDemoDrafts());
    return subscribeDemoDrafts(setDrafts);
  }, []);

  const loadSample = () => {
    loadSampleDemoData();
    toast.success("Sample data loaded", {
      description: "Orders, stock, prices, carts, and alerts are ready for another walkthrough.",
    });
  };

  const saveDraft = () => {
    const draft = saveCurrentDemoDraft(draftName);
    setDraftName("");
    toast.success(`Saved “${draft.name}”`, { description: "You can restore this setup anytime." });
  };

  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Demo Controls"
        description="Prepare repeatable demonstrations without changing accounts or permanent system settings."
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-primary/20 bg-card p-6 shadow-card">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <DatabaseZap className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Load sample data</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Restores the built-in demonstration inventory, buyer orders, completed sale, and
              published price history. It also clears temporary carts and notifications.
            </p>
            <Button className="mt-5 rounded-full" onClick={loadSample}>
              <RotateCcw className="size-4" /> Load sample data
            </Button>
          </article>
          <article className="rounded-3xl border border-destructive/25 bg-card p-6 shadow-card">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Trash2 className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Reset demo data</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Clears all temporary orders, available stock, daily prices, carts, and notifications.
              Your demo accounts and saved drafts remain available.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-5 rounded-full">
                  <Trash2 className="size-4" /> Reset demo data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all temporary demo records?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the active demo orders, stock, prices, carts, and alerts. You can
                    load the sample data again afterward.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      resetDemoData();
                      toast.success("Demo records reset", {
                        description:
                          "The active workspace is now empty and ready for a fresh demonstration.",
                      });
                    }}
                  >
                    Reset records
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Save className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Save this demonstration setup</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep a snapshot of the current orders, stock, price history, carts, and
                notifications before moving to the next scenario.
              </p>
            </div>
          </div>
          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              saveDraft();
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="draft-name">Draft name</Label>
              <Input
                id="draft-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Example: Payment walkthrough"
              />
            </div>
            <Button type="submit" className="mt-auto rounded-full">
              <Save className="size-4" /> Save draft
            </Button>
          </form>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <ArchiveRestore className="size-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Saved drafts</h2>
              <p className="text-sm text-muted-foreground">
                Restoring a draft replaces only the current temporary demo records.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {drafts.map((draft) => (
              <article
                key={draft.id}
                className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{draft.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Saved {draft.savedAt}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      restoreDemoDraft(draft);
                      toast.success(`Restored “${draft.name}”`, {
                        description: "The workspace now matches this saved demonstration.",
                      });
                    }}
                  >
                    <ArchiveRestore className="size-4" /> Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-destructive hover:text-destructive"
                    aria-label={`Delete ${draft.name}`}
                    onClick={() => {
                      deleteDemoDraft(draft.id);
                      toast.success("Draft deleted");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </article>
            ))}
            {!drafts.length && (
              <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                No saved drafts yet. Set up a scenario and save it here before demonstrating the
                next workflow.
              </p>
            )}
          </div>
        </section>
      </main>
    </ManagementLayout>
  );
}
