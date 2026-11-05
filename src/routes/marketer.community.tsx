import { createFileRoute } from "@tanstack/react-router";

import { CommunityWorkspace } from "@/features/messaging/components/community-workspace";
import { MarketerLayout, MarketerPageHeader } from "@/components/workspaces/marketer-layout";

export const Route = createFileRoute("/marketer/community")({
  head: () => ({ meta: [{ title: "Community — Marketer | AgriLink" }] }),
  component: MarketerCommunityPage,
});

function MarketerCommunityPage() {
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Community"
        description="Share saved operational updates with the AgriLink community."
      />
      <main className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8">
        <div className="mb-6 hidden rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground sm:block">
          Use reactions and comments to keep operational discussions clear. Community activity is
          saved and visible only to authorized AgriLink members.
        </div>
        <CommunityWorkspace
          postTitle="Share an operational update"
          placeholder="What is happening in the marketplace today?"
        />
      </main>
    </MarketerLayout>
  );
}
