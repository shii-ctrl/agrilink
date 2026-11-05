import { createFileRoute } from "@tanstack/react-router";
import { CommunityWorkspace } from "@/features/messaging/components/community-workspace";
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
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8">
        <CommunityWorkspace
          postTitle="Share an authorized update"
          placeholder="What is on your mind? Share an agricultural or marketplace update..."
        />
      </main>
    </ManagementLayout>
  );
}
