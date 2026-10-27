import { createFileRoute } from "@tanstack/react-router";

import { RiderLayout, RiderPageHeader } from "@/components/workspaces/rider-layout";
import { LiveProfile } from "@/features/auth/components/live-profile";

export const Route = createFileRoute("/rider/profile")({ component: RiderProfilePage });

function RiderProfilePage() {
  return (
    <RiderLayout>
      <RiderPageHeader
        title="Profile"
        description="View and update your saved Rider account information."
      />
      <LiveProfile role="Rider" />
    </RiderLayout>
  );
}
