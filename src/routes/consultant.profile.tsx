import { createFileRoute } from "@tanstack/react-router";
import { ConsultantLayout, ConsultantPageHeader } from "@/components/consultant-layout";
import { LiveProfile } from "@/components/live-profile";
export const Route = createFileRoute("/consultant/profile")({ component: ConsultantProfilePage });
function ConsultantProfilePage() {
  return (
    <ConsultantLayout>
      <ConsultantPageHeader
        title="Profile"
        description="View and update your saved Farm Consultant account information."
      />
      <LiveProfile role="Farm Consultant" />
    </ConsultantLayout>
  );
}
