import { createFileRoute } from "@tanstack/react-router";

import { CommunityFeed } from "@/components/community-feed";
import { ConsultantLayout, ConsultantPageHeader } from "@/components/consultant-layout";

export const Route = createFileRoute("/consultant/community")({
  component: ConsultantCommunityPage,
});

function ConsultantCommunityPage() {
  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Community"
        description="Share saved crop information and operational updates with AgriLink users."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Community supports messages only. Reactions, likes, followers, and unrelated social
          features are not included.
        </div>
        <CommunityFeed
          title="Post an update"
          placeholder="Share crop guidance or an operational update..."
        />
      </main>
    </ConsultantLayout>
  );
}
