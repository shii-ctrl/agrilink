import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RiderLayout, RiderPageHeader } from "@/components/workspaces/rider-layout";
import { CommunityWorkspace } from "@/features/messaging/components/community-workspace";

export const Route = createFileRoute("/rider/community")({
  validateSearch: z.object({ contact: z.string().uuid().optional() }),
  component: RiderCommunityPage,
});

function RiderCommunityPage() {
  const { contact } = Route.useSearch();
  return (
    <RiderLayout>
      <RiderPageHeader
        title="Private messages"
        description="Coordinate securely with Buyers assigned to your deliveries."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-0 sm:py-6 md:px-8 md:py-8">
        <CommunityWorkspace
          postTitle="Share a delivery update"
          placeholder="Write a delivery update..."
          messagesOnly
          initialContactId={contact}
        />
      </main>
    </RiderLayout>
  );
}
