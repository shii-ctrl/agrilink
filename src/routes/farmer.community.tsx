import { createFileRoute } from "@tanstack/react-router";

import { CommunityWorkspace } from "@/features/messaging/components/community-workspace";
import { FarmerLayout, FarmerPageHeader } from "@/components/workspaces/farmer-layout";

export const Route = createFileRoute("/farmer/community")({ component: FarmerCommunityPage });

function FarmerCommunityPage() {
  return (
    <FarmerLayout>
      <FarmerPageHeader
        title="Community"
        description="Share saved updates with the AgriLink community."
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Share production updates, react thoughtfully, and use comments for helpful public
          conversations with other AgriLink members.
        </div>
        <CommunityWorkspace
          postTitle="Share a production update"
          placeholder="What is on your mind? Share a production update..."
        />
      </main>
    </FarmerLayout>
  );
}
