import { createFileRoute } from "@tanstack/react-router";

import { CommunityWorkspace } from "@/features/messaging/components/community-workspace";
import { ConsultantLayout, ConsultantPageHeader } from "@/components/workspaces/consultant-layout";

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
          Use posts, reactions, and comments for public crop discussions. Keep farmer-specific
          recommendations in Crop Guidance.
        </div>
        <CommunityWorkspace
          postTitle="Share a crop or operational update"
          placeholder="What is on your mind? Share crop guidance or an operational update..."
        />
      </main>
    </ConsultantLayout>
  );
}
