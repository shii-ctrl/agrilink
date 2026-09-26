import { createFileRoute } from "@tanstack/react-router";
import { MarketerLayout, MarketerPageHeader } from "@/components/marketer-layout";
import { LiveProfile } from "@/components/live-profile";
export const Route = createFileRoute("/marketer/profile")({ component: MarketerProfilePage });
function MarketerProfilePage() {
  return (
    <MarketerLayout>
      <MarketerPageHeader
        title="Profile"
        description="View and update your saved Marketer account information."
      />
      <LiveProfile role="Marketer" />
    </MarketerLayout>
  );
}
