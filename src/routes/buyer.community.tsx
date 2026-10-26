import { createFileRoute } from "@tanstack/react-router";

import { BuyerLayout, BuyerPageHeader } from "@/components/workspaces/buyer-layout";
import { CommunityWorkspace } from "@/features/messaging/components/community-workspace";

export const Route = createFileRoute("/buyer/community")({ component: BuyerCommunityPage });

function BuyerCommunityPage() {
  return (
    <BuyerLayout>
      <BuyerPageHeader
        title="Private messages"
        description="Read and reply to saved marketplace messages from the AgriLink team."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <CommunityWorkspace
          postTitle="Share a community update"
          placeholder="What is on your mind? Share an update with the AgriLink community..."
          messagesOnly
        />
      </main>
    </BuyerLayout>
  );
}
