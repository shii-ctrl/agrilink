import { createFileRoute } from "@tanstack/react-router";
import { ConsultantLayout, ConsultantPageHeader } from "@/components/workspaces/consultant-layout";
import { LiveProfile } from "@/features/auth/components/live-profile";
export const Route = createFileRoute("/consultant/profile")({ component: ConsultantProfilePage });
function ConsultantProfilePage() {
  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Profile"
        description="View and update your saved Farm Consultant account information."
      />
      <LiveProfile role="Farm Consultant" showCommunityPosts />
    </ConsultantLayout>
  );
}
