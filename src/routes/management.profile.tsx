import { createFileRoute } from "@tanstack/react-router";
import { ManagementLayout, ManagementPageHeader } from "@/components/management-layout";
import { LiveProfile } from "@/components/live-profile";
export const Route = createFileRoute("/management/profile")({ component: ManagementProfilePage });
function ManagementProfilePage() {
  return (
    <ManagementLayout>
      <ManagementPageHeader
        title="Profile"
        description="View and update your saved Management account information."
      />
      <LiveProfile role="Management" />
    </ManagementLayout>
  );
}
