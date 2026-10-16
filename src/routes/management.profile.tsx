import { createFileRoute } from "@tanstack/react-router";
import { ManagementLayout, ManagementPageHeader } from "@/components/workspaces/management-layout";
import { LiveProfile } from "@/features/auth/components/live-profile";
export const Route = createFileRoute("/management/profile")({ component: ManagementProfilePage });
function ManagementProfilePage() {
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Profile"
        description="View and update your saved Management account information."
      />
      <LiveProfile role="Management" showCommunityPosts />
    </ManagementLayout>
  );
}
