import { createFileRoute } from "@tanstack/react-router";

import { CommunityFeed } from "@/features/messaging/components/community-feed";
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
          conversations. Use Crop Guidance for private advice from your consultant.
        </div>
        <CommunityFeed title="Post an update" placeholder="Share a production update..." />
      </main>
    </FarmerLayout>
  );
}
