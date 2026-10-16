import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { CommunityFeed } from "@/features/messaging/components/community-feed";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";

export const Route = createFileRoute("/management/community")({
  component: ManagementCommunityPage,
});

function ManagementCommunityPage() {
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Community"
        description="Authorized, saved agricultural and marketplace updates."
      />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_18rem] md:px-8">
        <div>
          <CommunityFeed
            title="Post an authorized update"
            placeholder="Share an authorized agricultural or marketplace update..."
          />
        </div>
        <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-card">
          <MessageCircle className="size-6 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">Community guidelines</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Posts, reactions, and comments are saved in AgriLink. Use Crop Guidance for private
            farmer-to-consultant conversations.
          </p>
        </aside>
      </main>
    </ManagementLayout>
  );
}
