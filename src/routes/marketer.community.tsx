import { createFileRoute } from "@tanstack/react-router";

import { CommunityFeed } from "@/features/messaging/components/community-feed";
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
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Use reactions and comments to keep operational discussions clear. Community activity is
          saved and visible only to authorized AgriLink members.
        </div>
        <CommunityFeed
          title="Post an operational update"
          placeholder="Share a PROCY operations update..."
        />
      </main>
    </MarketerLayout>
  );
}
